import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { createClient } from '@/lib/supabase/server'

// Logs an access request from the Access Denied page (service role).
//
// This one stays open to any signed-in user — being refused a page is exactly
// when you need it — but it no longer believes the caller about who they are.
// It used to take user_id and email straight from the request body, so anyone
// could file a request in a colleague's name.
export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }

    const { page } = await request.json()
    const admin = getServiceClient()
    const { error } = await admin.from('access_requests').insert({
      user_id: user.id,
      email: user.email || null,
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
