'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  Search, X, Users, FileText, Receipt, ShoppingCart,
  Target, CheckSquare, Package, Truck, Command,
  ArrowRight, Loader2, Headset
} from 'lucide-react'

type SearchResult = {
  id: string
  type: 'client' | 'quote' | 'invoice' | 'order' | 'deal' | 'task' | 'product' | 'supplier' | 'ticket'
  title: string
  subtitle?: string
  href: string
}

const typeConfig: Record<string, { icon: typeof Users; color: string; bg: string }> = {
  client: { icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
  quote: { icon: FileText, color: 'text-violet-600', bg: 'bg-violet-100' },
  invoice: { icon: Receipt, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  order: { icon: ShoppingCart, color: 'text-amber-600', bg: 'bg-amber-100' },
  deal: { icon: Target, color: 'text-indigo-600', bg: 'bg-indigo-100' },
  task: { icon: CheckSquare, color: 'text-slate-600', bg: 'bg-slate-100' },
  product: { icon: Package, color: 'text-cyan-600', bg: 'bg-cyan-100' },
  supplier: { icon: Truck, color: 'text-rose-600', bg: 'bg-rose-100' },
  ticket: { icon: Headset, color: 'text-orange-600', bg: 'bg-orange-100' },
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(val || 0)
}

type GlobalSearchProps = {
  variant?: 'default' | 'sidebar'
}

export default function GlobalSearch({ variant = 'default' }: GlobalSearchProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Keyboard shortcut: Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
    if (!isOpen) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([])
      return
    }

    setLoading(true)
    const supabase = createClient()
    const searchResults: SearchResult[] = []
    const q = searchQuery.toLowerCase()

    try {
      // Search Clients
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, contact_person, email')
        .or(`name.ilike.%${q}%,contact_person.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(5)

      clients?.forEach(c => {
        searchResults.push({
          id: c.id,
          type: 'client',
          title: c.name,
          subtitle: c.contact_person || c.email,
          href: `/clients/${c.id}`
        })
      })

      // Search Quotes
      const { data: quotes } = await supabase
        .from('quotes')
        .select('id, quote_number, client_name, total')
        .or(`quote_number.ilike.%${q}%,client_name.ilike.%${q}%`)
        .limit(5)

      quotes?.forEach(quote => {
        searchResults.push({
          id: quote.id,
          type: 'quote',
          title: quote.quote_number,
          subtitle: `${quote.client_name} • ${formatCurrency(quote.total || 0)}`,
          href: '/quotes'
        })
      })

      // Search Invoices
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, client_name, total')
        .or(`invoice_number.ilike.%${q}%,client_name.ilike.%${q}%`)
        .limit(5)

      invoices?.forEach(inv => {
        searchResults.push({
          id: inv.id,
          type: 'invoice',
          title: inv.invoice_number,
          subtitle: `${inv.client_name} • ${formatCurrency(inv.total || 0)}`,
          href: '/invoices'
        })
      })

      // Search Orders
      const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, client_name, value_zar')
        .or(`order_number.ilike.%${q}%,client_name.ilike.%${q}%`)
        .limit(5)

      orders?.forEach(o => {
        searchResults.push({
          id: o.id,
          type: 'order',
          title: o.order_number,
          subtitle: `${o.client_name} • ${formatCurrency(o.value_zar || 0)}`,
          href: '/orders'
        })
      })

      // Search Pipeline Deals
      const { data: deals } = await supabase
        .from('pipeline')
        .select('id, title, client_name, value, status')
        .or(`title.ilike.%${q}%,client_name.ilike.%${q}%`)
        .limit(5)

      deals?.forEach(d => {
        searchResults.push({
          id: d.id,
          type: 'deal',
          title: d.client_name || d.title,
          subtitle: `${d.title} • ${formatCurrency(d.value || 0)}`,
          href: '/pipeline'
        })
      })

      // Search Tasks
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, client_name')
        .ilike('title', `%${q}%`)
        .limit(5)

      tasks?.forEach(t => {
        searchResults.push({
          id: t.id,
          type: 'task',
          title: t.title,
          subtitle: t.client_name || undefined,
          href: '/tasks'
        })
      })

      // Search Products/Pricelist
      const { data: products } = await supabase
        .from('pricelist')
        .select('id, name, sku, sell_price_zar')
        .or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
        .limit(5)

      products?.forEach(p => {
        searchResults.push({
          id: p.id,
          type: 'product',
          title: p.name,
          subtitle: `${p.sku || 'No SKU'} • ${formatCurrency(p.sell_price_zar || 0)}`,
          href: '/pricelist'
        })
      })

      // Search Tickets
      const { data: tickets } = await supabase
        .from('tickets')
        .select('id, subject, status, priority')
        .or(`subject.ilike.%${q}%,description.ilike.%${q}%,device_serial.ilike.%${q}%`)
        .limit(5)

      tickets?.forEach(t => {
        searchResults.push({
          id: t.id,
          type: 'ticket',
          title: t.subject,
          subtitle: `${t.status} - ${t.priority}`,
          href: `/tickets/${t.id}`
        })
      })

      // Search Suppliers
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id, name, contact_person, email')
        .or(`name.ilike.%${q}%,contact_person.ilike.%${q}%`)
        .limit(5)

      suppliers?.forEach(s => {
        searchResults.push({
          id: s.id,
          type: 'supplier',
          title: s.name,
          subtitle: s.contact_person || s.email,
          href: '/accounts-payable'
        })
      })

      setResults(searchResults)
      setSelectedIndex(0)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, performSearch])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      navigateToResult(results[selectedIndex])
    }
  }

  const navigateToResult = (result: SearchResult) => {
    setIsOpen(false)
    router.push(result.href)
  }

  // Group results by type
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) acc[result.type] = []
    acc[result.type].push(result)
    return acc
  }, {} as Record<string, SearchResult[]>)

  const typeLabels: Record<string, string> = {
    client: 'Clients',
    quote: 'Quotes',
    invoice: 'Invoices',
    order: 'Orders',
    deal: 'Pipeline Deals',
    task: 'Tasks',
    product: 'Products',
    supplier: 'Suppliers',
    ticket: 'Support Tickets',
  }

  if (!isOpen) {
    if (variant === 'sidebar') {
      return (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 w-full px-3 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
        >
          <Search className="w-4 h-4" />
          <span className="text-sm flex-1 text-left">Search...</span>
          <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-700 rounded text-xs font-medium text-slate-500">
            <Command className="w-3 h-3" />K
          </kbd>
        </button>
      )
    }
    
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-500 transition-colors"
      >
        <Search className="w-4 h-4" />
        <span className="text-sm hidden sm:inline">Search...</span>
        <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 bg-white rounded text-xs font-medium text-slate-400 border border-slate-200">
          <Command className="w-3 h-3" />K
        </kbd>
      </button>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 animate-fade-in"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl z-50 animate-slide-up">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-200">
            <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search clients, quotes, invoices, orders..."
              className="flex-1 text-lg outline-none placeholder:text-slate-400"
              autoComplete="off"
            />
            {loading && <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />}
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {query.length < 2 ? (
              <div className="p-8 text-center text-slate-500">
                <Search className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-lg font-medium">Search everything</p>
                <p className="text-sm mt-1">Find clients, quotes, invoices, orders, and more</p>
              </div>
            ) : results.length === 0 && !loading ? (
              <div className="p-8 text-center text-slate-500">
                <p className="text-lg font-medium">No results found</p>
                <p className="text-sm mt-1">Try a different search term</p>
              </div>
            ) : (
              <div className="py-2">
                {Object.entries(groupedResults).map(([type, typeResults]) => {
                  const config = typeConfig[type]
                  const Icon = config?.icon || FileText

                  return (
                    <div key={type}>
                      <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                        {typeLabels[type] || type}
                      </div>
                      {typeResults.map((result) => {
                        const globalIndex = results.indexOf(result)
                        const isSelected = globalIndex === selectedIndex

                        return (
                          <button
                            key={result.id}
                            onClick={() => navigateToResult(result)}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                              isSelected ? 'bg-teal-50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className={`w-10 h-10 ${config?.bg || 'bg-slate-100'} rounded-xl flex items-center justify-center flex-shrink-0`}>
                              <Icon className={`w-5 h-5 ${config?.color || 'text-slate-600'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-slate-900 truncate">{result.title}</div>
                              {result.subtitle && (
                                <div className="text-sm text-slate-500 truncate">{result.subtitle}</div>
                              )}
                            </div>
                            {isSelected && (
                              <ArrowRight className="w-4 h-4 text-teal-600 flex-shrink-0" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 font-mono">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 font-mono">↓</kbd>
                to navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 font-mono">↵</kbd>
                to select
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 font-mono">esc</kbd>
              to close
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
