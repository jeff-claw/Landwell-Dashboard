import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/pages'

// Route handlers that use the service-role key bypass RLS entirely, so they
// have to do their own access control. The middleware only proves a session
// exists; this also enforces the same per-page permissions the UI applies, so
// somebody without Products access cannot POST to the product-image endpoint.
// Returns a response to send back on refusal, or null when the caller is allowed.
export async function requirePageAccess(pageKey: string): Promise<NextResponse | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, page_access')
    .eq('id', user.id)
    .single()

  if (!canAccess(profile?.role, profile?.page_access as string[] | null, pageKey)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  return null
}
