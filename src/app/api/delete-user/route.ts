import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/api-auth'

// Deletes a user: removes their profile row and their auth account.
// Runs with the service role, which bypasses RLS entirely, so it has to
// establish for itself that the caller may do this. Until this check existed,
// any signed-in user could delete any account by calling the endpoint.
export async function DELETE(request: Request) {
  try {
    const caller = await requireRole(['founder', 'admin'])
    if (caller instanceof NextResponse) return caller

    const { userId } = await request.json()
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }
    if (userId === caller.userId) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
    }

    const admin = getServiceClient()

    // An admin must not be able to remove a founder — that is the one
    // direction in which this endpoint would hand over control of the account.
    const { data: target } = await admin.from('profiles').select('role').eq('id', userId).single()
    if (target?.role === 'founder' && caller.role !== 'founder') {
      return NextResponse.json({ error: 'Only a founder can delete a founder' }, { status: 403 })
    }

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
