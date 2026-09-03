import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requirePageAccess } from '@/lib/api-auth'

const BUCKET = 'compliance-docs'
const MAX_BYTES = 25 * 1024 * 1024 // scanned policies and signed PDFs get large

// Uploads a compliance evidence document (PDF, scan, photo of a signed policy)
// to Supabase Storage and returns its public URL, which the caller writes to
// hr_compliance_items.evidence_url. Creates the bucket on first use so no
// manual storage setup is required.
export async function POST(request: Request) {
  try {
    const denied = await requirePageAccess('hr')
    if (denied) return denied

    const formData = await request.formData()
    const file = formData.get('file')
    const itemId = formData.get('item_id')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }
    if (typeof itemId !== 'string' || !itemId) {
      return NextResponse.json({ error: 'Missing item_id' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File must be less than 25MB' }, { status: 400 })
    }

    const admin = getServiceClient()

    const { error: bucketError } = await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
    })
    if (bucketError && !/already exists/i.test(bucketError.message)) {
      return NextResponse.json({ error: `Storage bucket error: ${bucketError.message}` }, { status: 500 })
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
    const path = `${itemId}/${Date.now()}-${safeName || 'document'}`

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ url: pub.publicUrl, name: file.name })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
