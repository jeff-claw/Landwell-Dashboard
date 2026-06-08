'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  GitBranch,
  FileText,
  Menu,
  X,
  Package,
  CreditCard,
  CheckSquare,
  Calendar,
  Shield,
  Calculator,
  Megaphone,
  LogOut,
  Bell,
  BarChart2,
  CalendarDays,
  Receipt,
  BookOpen,
  Bug,
  Banknote,
  ClipboardList,
  Headset,
  Briefcase,
  ClipboardCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { useReportIssue } from '@/components/ReportIssue'
import type { UserRole } from '@/lib/types'
import { canAccess, pathToPageKey } from '@/lib/pages'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/weekly-review', label: 'Weekly Review', icon: CalendarDays },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/pipeline', label: 'Pipeline', icon: GitBranch },
  { href: '/quotes', label: 'Quotes', icon: FileText },
  { href: '/calculator', label: 'Calculator', icon: Calculator },
  { href: '/orders', label: 'Orders', icon: Package },
  { href: '/purchase-orders', label: 'Purchase Orders', icon: ClipboardList },
  { href: '/invoices', label: 'Invoices', icon: Receipt },
  { href: '/payments', label: 'Payments', icon: CreditCard },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/reminders', label: 'Reminders', icon: Bell },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/tickets', label: 'Tickets', icon: Headset },
  { href: '/reports', label: 'Reports', icon: BarChart2 },
  { href: '/marketing', label: 'Marketing', icon: Megaphone },
  { href: '/admin/users', label: 'Users', icon: Shield },
  { href: '/admin/formula', label: 'Formula', icon: Calculator },
  { href: '/admin/issues', label: 'Issue Reports', icon: Bug },
  { href: '/project-log', label: 'Project Log', icon: BookOpen },
]

const hrItems = [
  { href: '/hr', label: 'Employee Directory', icon: Briefcase },
  { href: '/hr/compliance', label: 'Compliance', icon: ClipboardCheck },
]

const founderItems = [
  { href: '/expenses', label: 'Expenses', icon: Banknote },
]

const bottomNav = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/pipeline', label: 'Pipeline', icon: GitBranch },
  { href: '/quotes', label: 'Quotes', icon: FileText },
]

export default function MobileNav({ userRole, pageAccess }: { userRole?: UserRole; pageAccess?: string[] | null }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const { open: openReportIssue } = useReportIssue()
  const allow = (href: string) => canAccess(userRole, pageAccess, pathToPageKey(href))

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    // Force full page reload to clear all cached state
    window.location.href = '/login'
  }

  return (
    <>
      {/* Top bar */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-slate-900 text-white">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-teal-400">Landwell Africa</h1>
          <button
            onClick={openReportIssue}
            className="p-1 rounded hover:bg-slate-700 transition text-amber-400"
            title="Report an Issue"
          >
            <Bug className="w-4 h-4" />
          </button>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Slide-out menu */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-900/95 pt-16 px-4 overflow-y-auto">
          <button
            onClick={() => setMenuOpen(false)}
            className="absolute top-4 right-4 text-white"
          >
            <X className="w-6 h-6" />
          </button>
          <nav className="space-y-1">
            {navItems.filter(i => allow(i.href)).map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              )
            })}
            {(userRole === 'founder' || userRole === 'admin' || userRole === 'hr') && (
              <>
                <div className="pt-3 mt-3 border-t border-slate-700">
                  <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">HR</p>
                </div>
                {hrItems.filter(i => allow(i.href)).map((item) => {
                  const isActive = pathname === item.href || (item.href === '/hr' && pathname.startsWith('/hr') && pathname !== '/hr/compliance')
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-teal-600 text-white'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  )
                })}
              </>
            )}
            {userRole === 'founder' && (
              <>
                <div className="pt-3 mt-3 border-t border-slate-700">
                  <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Founder</p>
                </div>
                {founderItems.filter(i => allow(i.href)).map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-teal-600 text-white'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  )
                })}
              </>
            )}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 w-full mt-4"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </nav>
        </div>
      )}

      {/* Bottom tab bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex z-40">
        {bottomNav.filter(i => allow(i.href)).map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center py-2 text-xs ${
                isActive ? 'text-teal-600' : 'text-slate-500'
              }`}
            >
              <item.icon className="w-5 h-5 mb-0.5" />
              {item.label}
            </Link>
          )
        })}
        <button
          onClick={() => setMenuOpen(true)}
          className="flex-1 flex flex-col items-center py-2 text-xs text-slate-500"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          More
        </button>
      </div>
    </>
  )
}
