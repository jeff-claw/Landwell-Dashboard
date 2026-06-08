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
      .upsert(
        {
          id: userId,
          email: normalizedEmail,
          full_name: fullName || null,
          role,
          status,
        },
        { onConflict: 'id' }
      )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, status, role })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
