import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// Creates the profile row for a freshly signed-up user, bypassing RLS via the
// service-role key. If the email is pre-approved (approved_emails), the profile
// is created already-approved with that role; otherwise it lands as pending/viewer.
export async function POST(request: Request) {
  try {
    const { userId, email, fullName } = await request.json()

    if (!userId || !email) {
      return NextResponse.json({ error: 'Missing userId or email' }, { status: 400 })
    }

    const supabase = getServiceClient()
    const normalizedEmail = String(email).toLowerCase()

    // This route takes no session: it runs during sign-up, before one may
    // exist. So it proves the caller owns the account it is about to write,
    // by checking the id against the auth record. Without this, anyone could
    // post somebody else's user id with a pre-approved email and be handed
    // that role.
    const { data: authUser, error: lookupError } = await supabase.auth.admin.getUserById(String(userId))
    if (lookupError || !authUser?.user) {
      return NextResponse.json({ error: 'Unknown user' }, { status: 403 })
    }
    if ((authUser.user.email || '').toLowerCase() !== normalizedEmail) {
      return NextResponse.json({ error: 'Email does not match this account' }, { status: 403 })
    }

    // Never overwrite a profile that already exists. This used to upsert on
    // id, which let a second call rewrite anyone's role and status.
    const { data: existing } = await supabase
      .from('profiles')
      .select('id, role, status')
      .eq('id', userId)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ ok: true, status: existing.status, role: existing.role })
    }

    // Pre-approved?
    const { data: approved } = await supabase
      .from('approved_emails')
      .select('role')
      .eq('email', normalizedEmail)
      .maybeSingle()

    const role = approved?.role || 'viewer'
    const status = approved ? 'approved' : 'pending'

    const { error } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: normalizedEmail,
        full_name: fullName || null,
        role,
        status,
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, status, role })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
