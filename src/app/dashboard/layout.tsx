import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.status !== 'approved') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base px-4">
        <div className="bg-surface rounded-xl shadow-sm border border-line p-8 max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-strong mb-2">Pending Approval</h2>
          <p className="text-soft text-sm mb-4">Your account is awaiting admin approval.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base overflow-x-hidden">
      <MobileNav userRole={profile.role} />
      <div className="flex">
        <Sidebar userRole={profile.role} />
        <main className="flex-1 p-4 lg:p-8 pb-24 lg:pb-8 min-h-screen overflow-x-hidden w-full max-w-full">
          {children}
        </main>
      </div>
    </div>
  )
}