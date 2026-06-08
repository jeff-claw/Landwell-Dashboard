// Single source of truth for gateable pages. Used by the sidebar, the admin
// access editor, and the middleware enforcement. `key` is what gets stored in
// profiles.page_access (a JSON array of allowed keys; null = full access).

export type PageDef = { key: string; label: string; href: string }

export const PAGES: PageDef[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/' },
  { key: 'weekly-review', label: 'Weekly Review', href: '/weekly-review' },
  { key: 'clients', label: 'Clients', href: '/clients' },
  { key: 'pipeline', label: 'Pipeline', href: '/pipeline' },
  { key: 'quotes', label: 'Quotes', href: '/quotes' },
  { key: 'calculator', label: 'Calculator', href: '/calculator' },
  { key: 'orders', label: 'Orders', href: '/orders' },
  { key: 'purchase-orders', label: 'Purchase Orders', href: '/purchase-orders' },
  { key: 'invoices', label: 'Invoices', href: '/invoices' },
  { key: 'payments', label: 'Payments', href: '/payments' },
  { key: 'accounts-payable', label: 'Accounts Payable', href: '/accounts-payable' },
  { key: 'products', label: 'Products', href: '/products' },
  { key: 'tasks', label: 'Tasks', href: '/tasks' },
  { key: 'reminders', label: 'Reminders', href: '/reminders' },
  { key: 'calendar', label: 'Calendar', href: '/calendar' },
  { key: 'tickets', label: 'Tickets', href: '/tickets' },
  { key: 'reports', label: 'Reports', href: '/reports' },
  { key: 'marketing', label: 'Marketing', href: '/marketing' },
  { key: 'admin', label: 'Admin (Users/Formula/Issues)', href: '/admin/users' },
  { key: 'project-log', label: 'Project Log', href: '/project-log' },
  { key: 'hr', label: 'HR', href: '/hr' },
  { key: 'expenses', label: 'Expenses', href: '/expenses' },
]

// Map a request path to a page key. Handles both the public paths (/clients)
// and the internal /dashboard/* paths, plus nested routes (/clients/123).
export function pathToPageKey(pathname: string): string {
  const p = pathname.replace(/^\/dashboard/, '')
  if (p === '' || p === '/') return 'dashboard'
  const seg = p.split('/').filter(Boolean)[0]
  if (seg === 'admin') return 'admin'
  if (seg === 'hr') return 'hr'
  return seg
}

// A user can see a page if they're a founder, or page_access is unset (full),
// or the page key is in their allowed list. 'dashboard' is always allowed so
// nobody lands on a blank root.
export function canAccess(
  role: string | null | undefined,
  pageAccess: string[] | null | undefined,
  pageKey: string
): boolean {
  if (role === 'founder') return true
  if (pageKey === 'access-denied') return true // the denied screen itself
  if (!pageAccess) return true // null/unset = full access
  return pageAccess.includes(pageKey)
}
