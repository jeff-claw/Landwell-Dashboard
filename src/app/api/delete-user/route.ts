import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// Deletes a user: removes their profile row and their auth account.
// Service-role only; called from the admin Users page.
export async function DELETE(request: Request) {
  try {
    const { userId } = await request.json()
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    const admin = getServiceClient()

    // Remove the profile row first (ignore if absent).
    await admin.from('profiles').delete().eq('id', userId)

    // Remove the auth user.
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
