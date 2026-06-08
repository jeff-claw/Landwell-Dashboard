import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// Logs an access request from the Access Denied page (service role).
export async function POST(request: Request) {
  try {
    const { userId, email, page } = await request.json()
    const admin = getServiceClient()
    const { error } = await admin.from('access_requests').insert({
      user_id: userId || null,
      email: email || null,
      page: page || null,
      status: 'open',
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
