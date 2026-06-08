import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// Update a profile (status / role / page_access) via the service role, so the
// admin UI works regardless of RLS policies on profiles.
export async function POST(request: Request) {
  try {
    const { userId, status, role, page_access } = await request.json()
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

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
