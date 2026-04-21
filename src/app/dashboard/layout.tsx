'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import {
  TrendingUp, FileText, Package, Users, DollarSign,
  ShoppingCart, BarChart3, Warehouse, Truck, Calendar, Receipt,
  Ticket, UserCircle, Settings, Search, LogOut, Menu, X
} from 'lucide-react'

const navItems = [
  { href: '/dashboard/pipeline', label: 'Pipeline', icon: TrendingUp },
  { href: '/dashboard/quotes', label: 'Quotes', icon: FileText },
  { href: '/dashboard/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/dashboard/clients', label: 'Clients', icon: Users },
  { href: '/dashboard/pricelist', label: 'Pricelist', icon: Package },
  { href: '/dashboard/stock', label: 'Stock', icon: Warehouse },
  { href: '/dashboard/suppliers', label: 'Suppliers', icon: Truck },
  { href: '/dashboard/payables', label: 'Accounts Payable', icon: DollarSign },
  { href: '/dashboard/tenders', label: 'Tenders', icon: BarChart3 },
  { href: '/dashboard/calendar', label: 'Calendar', icon: Calendar },
  { href: '/dashboard/invoices', label: 'Invoices', icon: Receipt },
  { href: '/dashboard/tickets', label: 'Tickets', icon: Ticket },
  { href: '/dashboard/team', label: 'Team', icon: UserCircle },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [userEmail, setUserEmail] = useState('')
  const [userRole, setUserRole] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserEmail(data.user.email || '')
        setUserRole(data.user.user_metadata?.role || 'team_member')
      }
    })
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isAdmin = userRole === 'admin'

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-gray-900 text-white transform transition-transform lg:transform-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex flex-col h-full">
          <div className="px-6 py-4 border-b border-gray-800">
            <h1 className="text-xl font-bold">Landwell</h1>
            <p className="text-xs text-gray-400 mt-1">Business Dashboard</p>
          </div>
          <div className="px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-800 text-gray-200 rounded-lg pl-10 pr-4 py-2 text-sm border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
            {navItems
              .filter(item => !searchQuery || item.label.toLowerCase().includes(searchQuery.toLowerCase()))
              .filter(item => isAdmin || !['settings', 'team'].includes(item.label.toLowerCase()))
              .map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {item.label}
                  </Link>
                )
              })}
          </nav>
          <div className="px-4 py-3 border-t border-gray-800">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{userEmail}</p>
                <p className="text-xs text-gray-400 capitalize">{userRole}</p>
              </div>
              <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-white" title="Sign out">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-gray-600">
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Landwell</h1>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}