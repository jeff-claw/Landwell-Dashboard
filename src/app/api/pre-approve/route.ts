import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// Manage pre-approved emails via the service role, so the admin UI doesn't
// depend on an INSERT/DELETE RLS policy existing on approved_emails.

export async function POST(request: Request) {
  try {
    const { email, fullName, role } = await request.json()
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

    const admin = getServiceClient()
    const { error } = await admin.from('approved_emails').upsert(
      {
        email: String(email).toLowerCase(),
        full_name: fullName || null,
        role: role || 'viewer',
      },
      { onConflict: 'email' }
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { email } = await request.json()
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

    const admin = getServiceClient()
    const { error } = await admin.from('approved_emails').delete().eq('email', String(email).toLowerCase())
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
