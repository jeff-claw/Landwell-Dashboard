import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { createClient } from '@/lib/supabase/server'

const BUCKET = 'employee-docs'
const MAX_BYTES = 25 * 1024 * 1024

// Employee files are ID copies, medical certificates and disciplinary records —
// personal information under POPIA — so this bucket is PRIVATE. The row stores
// the storage path, and /api/employee-docs/view issues a short-lived signed URL
// to whoever is allowed to see it.
export async function POST(request: Request) {
  try {
    // Only a signed-in HR/admin/founder may attach employee documents.
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['founder', 'admin', 'hr'].includes(profile.role)) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const employeeId = formData.get('employee_id')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }
    if (typeof employeeId !== 'string' || !employeeId) {
      return NextResponse.json({ error: 'Missing employee_id' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File must be less than 25MB' }, { status: 400 })
    }

    const admin = getServiceClient()

    const { error: bucketError } = await admin.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_BYTES,
    })
    if (bucketError && !/already exists/i.test(bucketError.message)) {
      return NextResponse.json({ error: `Storage bucket error: ${bucketError.message}` }, { status: 500 })
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
    const path = `${employeeId}/${Date.now()}-${safeName || 'document'}`

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    return NextResponse.json({ path, name: file.name })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Removes the stored file. Deleting the row alone would leave an employee's ID
// copy or medical certificate sitting in storage after it was "deleted", which
// is exactly what POPIA erasure is meant to prevent.
export async function DELETE(request: Request) {
  const path = new URL(request.url).searchParams.get('path')
  if (!path) {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 })
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['founder', 'admin', 'hr'].includes(profile.role)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const admin = getServiceClient()
  const { error } = await admin.storage.from(BUCKET).remove([path])
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
