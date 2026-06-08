'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  GitBranch,
  FileText,
  Package,
  CreditCard,
  CheckSquare,
  Calendar,
  Shield,
  Calculator,
  LogOut,
  Bell,
  BarChart2,
  CalendarDays,
  Wallet,
  Receipt,
  BookOpen,
  Bug,
  Banknote,
  ClipboardList,
  Headset,
  Briefcase,
  ClipboardCheck,
  Megaphone,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useReportIssue } from '@/components/ReportIssue'
import GlobalSearch from '@/components/GlobalSearch'
import ThemeToggle from '@/components/ThemeToggle'
import type { UserRole } from '@/lib/types'

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
  { href: '/accounts-payable', label: 'Accounts Payable', icon: Wallet },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/reminders', label: 'Reminders', icon: Bell },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/tickets', label: 'Tickets', icon: Headset },
  { href: '/reports', label: 'Reports', icon: BarChart2 },
  { href: '/marketing', label: 'Marketing', icon: Megaphone },
]

const adminItems = [
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

export default function Sidebar({ userRole }: { userRole?: UserRole }) {
  const pathname = usePathname()
  const { open: openReportIssue } = useReportIssue()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    // Force full page reload to clear all cached state
    window.location.href = '/login'
  }

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-slate-900 text-white min-h-screen">
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-teal-400">Landwell Africa</h1>
          <button
            onClick={openReportIssue}
            className="p-1.5 rounded-lg hover:bg-slate-700 transition text-amber-400 hover:text-amber-300"
            title="Report an Issue"
          >
            <Bug className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1">Dashboard</p>
        <div className="mt-4">
          <GlobalSearch variant="sidebar" />
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          )
        })}

        <div className="pt-4 mt-4 border-t border-slate-700">
          <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Admin
          </p>
          {adminItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            )
          })}
        </div>

        {(userRole === 'founder' || userRole === 'admin' || userRole === 'hr') && (
          <div className="pt-4 mt-4 border-t border-slate-700">
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              HR
            </p>
            {hrItems.map((item) => {
              const isActive = pathname === item.href || (item.href === '/hr' && pathname.startsWith('/hr') && pathname !== '/hr/compliance')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        )}

        {userRole === 'founder' && (
          <div className="pt-4 mt-4 border-t border-slate-700">
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Founder
            </p>
            {founderItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-slate-700 space-y-1">
        <ThemeToggle />
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors w-full"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
