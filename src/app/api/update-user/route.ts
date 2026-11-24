import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/api-auth'

// Update a profile (status / role / page_access) via the service role, so the
// admin UI works regardless of RLS policies on profiles. The service role
// ignores RLS, so without the check below any signed-in user could call this
// and grant themselves whatever role they liked.
export async function POST(request: Request) {
  try {
    const caller = await requireRole(['founder', 'admin'])
    if (caller instanceof NextResponse) return caller

    const { userId, status, role, page_access } = await request.json()
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

    // Only a founder may hand out the founder role, or alter a founder's
    // profile. Otherwise an admin can promote themselves and take the account.
    if (role === 'founder' && caller.role !== 'founder') {
      return NextResponse.json({ error: 'Only a founder can grant the founder role' }, { status: 403 })
    }
    if (caller.role !== 'founder') {
      const check = getServiceClient()
      const { data: target } = await check.from('profiles').select('role').eq('id', userId).single()
      if (target?.role === 'founder') {
        return NextResponse.json({ error: "Only a founder can change a founder's profile" }, { status: 403 })
      }
    }

    const updates: Record<string, unknown> = {}
    if (status !== undefined) updates.status = status
    if (role !== undefined) updates.role = role
    if (page_access !== undefined) updates.page_access = page_access // array or null
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const admin = getServiceClient()
    const { error } = await admin.from('profiles').update(updates).eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
