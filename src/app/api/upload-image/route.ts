import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requirePageAccess } from '@/lib/api-auth'

const BUCKET = 'product-images'
const MAX_BYTES = 5 * 1024 * 1024

// Uploads a product image to Supabase Storage via the service role and
// returns its public URL. Creates the bucket on first use so no manual
// storage setup is required.
export async function POST(request: Request) {
  try {
    const denied = await requirePageAccess('products')
    if (denied) return denied

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image must be less than 5MB' }, { status: 400 })
    }

    const admin = getServiceClient()

    // Ensure the bucket exists (idempotent — ignore "already exists").
    const { error: bucketError } = await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
    })
    if (bucketError && !/already exists/i.test(bucketError.message)) {
      return NextResponse.json({ error: `Storage bucket error: ${bucketError.message}` }, { status: 500 })
    }

    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data } = admin.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
