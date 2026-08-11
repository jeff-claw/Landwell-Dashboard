import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

const BUCKET = 'partner-evidence'
const MAX_BYTES = 25 * 1024 * 1024 // photos and short site videos

// Attaches evidence to a partner issue: uploads to Supabase Storage and records
// the row. Site techs use this from a phone at the mine, so video and log files
// are allowed, not just images.
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const issueId = formData.get('issue_id')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }
    if (typeof issueId !== 'string' || !issueId) {
      return NextResponse.json({ error: 'Missing issue_id' }, { status: 400 })
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
    const path = `${issueId}/${Date.now()}-${safeName || 'evidence'}`

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path)

    const { error: rowError } = await admin.from('partner_issue_evidence').insert({
      issue_id: issueId,
      file_url: pub.publicUrl,
      file_name: file.name,
      mime_type: file.type || '',
    })
    if (rowError) {
      return NextResponse.json({ error: rowError.message }, { status: 500 })
    }

    return NextResponse.json({ url: pub.publicUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
