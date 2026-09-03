import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { createClient } from '@/lib/supabase/server'

const BUCKET = 'employee-docs'
const SIGNED_URL_TTL = 60 // seconds — long enough to open, too short to pass around

// Hands out a short-lived signed URL for a private employee document, so the
// file itself is never publicly addressable. Redirects rather than returning
// JSON so a plain <a href> works.
export async function GET(request: Request) {
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
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL)
  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'File not found' }, { status: 404 })
  }

  return NextResponse.redirect(data.signedUrl)
}
