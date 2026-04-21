import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    redirect('/login')
  }
  
  redirect('/dashboard/pipeline')
}