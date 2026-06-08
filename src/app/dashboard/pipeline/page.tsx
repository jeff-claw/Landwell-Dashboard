'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { PipelineDeal, PipelineStatus, Quote, Client, Formula } from '@/lib/types'
import { Plus, X, ChevronDown, ChevronRight, Search, Expand, Shrink, User, FileText, ExternalLink, Calendar, DollarSign, Mail, Phone, Clock, AlertTriangle, TrendingUp } from 'lucide-react'

// Calculate ZAR price from USD using formula
function calculateZarPrice(
  usdPrice: number,
  clientType: string,
  formula: Formula | null,
  region: string | null = null,
  includeInstallation: boolean = false
): number {
  if (!formula) return usdPrice * 17.5
  const exchangeRate = Number(formula.exchange_rate) || 17.5
  const shipping = Number(formula.shipping_multiplier) || 1.4
  const gp = Number(formula.gp_divisor) || 0.7
  const endUserDivisor = Number(formula.end_user_divisor) || 0.75
  const deliveryMult = 1 + (Number(formula.delivery_percent) || 10) / 100
  const regionMult = (region && formula.region_markups?.[region]) ? 1 + formula.region_markups[region] / 100 : 1

  const resellerNoInstall = (usdPrice * exchangeRate * shipping * deliveryMult) / gp
  const resellerWithInstall = (usdPrice * exchangeRate * shipping * deliveryMult * regionMult) / gp

  if (clientType === 'end_user' || clientType === 'End User') {
    return resellerWithInstall / endUserDivisor
  }
  return includeInstallation ? resellerWithInstall : resellerNoInstall
}

// Get probability based on pipeline status
function getStageProbability(status: string): number {
  const probabilities: Record<string, number> = {
    'lead_generated': 0.1,
    'qualification': 0.2,
    'meeting_scheduled': 0.3,
    'demo': 0.5,
    'proposal_sent': 0.6,
    'po_received': 0.9,
    'closed_won': 1.0,
    'closed_lost': 0,
  }
  return probabilities[status] ?? 0.2
}

function daysBetween(date1: Date, date2: Date): number {
  const diff = date2.getTime() - date1.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(val || 0)
}

const STAGES: { key: PipelineStatus; label: string; color: string; borderColor: string; probability: number }[] = [
  { key: 'lead_generated', label: 'New Lead', color: 'bg-slate-50', borderColor: 'border-slate-300', probability: 0.1 },
  { key: 'qualification', label: 'Qualification', color: 'bg-blue-50', borderColor: 'border-blue-300', probability: 0.2 },
  { key: 'proposal_sent', label: 'Quoted', color: 'bg-indigo-50', borderColor: 'border-indigo-300', probability: 0.6 },
  { key: 'demo', label: 'Demo', color: 'bg-purple-50', borderColor: 'border-purple-300', probability: 0.5 },
  { key: 'po_received', label: 'PO Received', color: 'bg-amber-50', borderColor: 'border-amber-300', probability: 0.9 },
  { key: 'closed_won', label: 'Closed Won', color: 'bg-green-50', borderColor: 'border-green-300', probability: 1.0 },
  { key: 'closed_lost', label: 'Closed Lost', color: 'bg-red-50', borderColor: 'border-red-300', probability: 0 },
]

const DEALS_PER_COLUMN = 10 // Limit for display per column

const emptyDeal = { title: '', value: 0, status: 'lead_generated' as PipelineStatus, client_id: '', notes: '' }

// Quote status badge component
function QuoteStatusBadge({ status }: { status: 'none' | 'quoted' | 'approved' }) {
  const styles = {
    none: 'bg-slate-100 text-slate-600 border-slate-200',
    quoted: 'bg-amber-100 text-amber-700 border-amber-200',
    approved: 'bg-green-100 text-green-700 border-green-200',
  }
  const labels = {
    none: 'Not Started',
    quoted: 'Quoted',
    approved: 'Approved',
  }
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

// Stale indicator component
function StaleIndicator({ days }: { days: number }) {
  if (days < 7) return null
  
  const isVeryStale = days >= 14
  
  return (
    <div className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
      isVeryStale ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
    }`}>
      <AlertTriangle className="w-3 h-3" />
      {days}d stale
    </div>
  )
}

// Detail Modal Component
function DealDetailModal({
  deal,
  client,
  quotes,
  formula,
  onClose,
  onStatusChange,
  stages,
}: {
  deal: PipelineDeal
  client: Client | null
  quotes: Quote[]
  formula: Formula | null
  onClose: () => void
  onStatusChange: (id: string, status: PipelineStatus) => void
  stages: typeof STAGES
}) {
  const router = useRouter()
  const quotesStatus = quotes.length === 0 ? 'none' : quotes.some(q => q.status === 'approved' || q.status === 'Accepted') ? 'approved' : 'quoted'
  const totalQuoteValue = quotes.reduce((sum, q) => {
    const isUSD = q.currency === 'USD'
    const lineTotal = q.line_items?.reduce((s, item) => {
      const price = isUSD 
        ? calculateZarPrice(item.unitPrice, q.client_type || 'end_user', formula, q.region, q.include_installation)
        : item.unitPrice
      return s + (item.qty * price)
    }, 0) || 0
    return sum + lineTotal
  }, 0)

  const daysInStage = daysBetween(new Date(deal.updated_at || deal.created_at), new Date())
  const probability = getStageProbability(deal.status)
  const weightedValue = (Number(deal.value) || 0) * probability

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{deal.client_name || deal.title}</h2>
              {deal.title && deal.title !== deal.client_name && (
                <p className="text-teal-100 text-sm mt-0.5">{deal.title}</p>
              )}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Days in Stage & Stale Warning */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-sm">
              <Clock className="w-4 h-4 text-slate-500" />
              <span className="text-slate-600">{daysInStage} days in stage</span>
            </div>
            {daysInStage >= 14 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 rounded-lg text-sm text-red-700">
                <AlertTriangle className="w-4 h-4" />
                Needs attention!
              </div>
            )}
          </div>

          {/* Client Info */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Client Information</h3>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-700">{client?.contact_person || deal.client_name || 'N/A'}</span>
              </div>
              {client?.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <a href={`mailto:${client.email}`} className="text-sm text-teal-600 hover:underline">{client.email}</a>
                </div>
              )}
              {client?.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <a href={`tel:${client.phone}`} className="text-sm text-teal-600 hover:underline">{client.phone}</a>
                </div>
              )}
            </div>
          </div>

          {/* Status & Value */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Pipeline Status</h3>
              <select
                value={deal.status}
                onChange={(e) => onStatusChange(deal.id, e.target.value as PipelineStatus)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
              >
                {stages.map(s => <option key={s.key} value={s.key}>{s.label} ({Math.round(s.probability * 100)}%)</option>)}
              </select>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Quotes Status</h3>
              <div className="flex items-center gap-2 h-[38px]">
                <QuoteStatusBadge status={quotesStatus} />
                {quotes.length > 0 && (
                  <span className="text-sm text-slate-500">({quotes.length} quote{quotes.length !== 1 ? 's' : ''})</span>
                )}
              </div>
            </div>
          </div>

          {/* Value Cards */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-teal-50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-teal-700 mb-1">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Deal Value</span>
              </div>
              <p className="text-2xl font-bold text-teal-700">{formatCurrency(deal.value || 0)}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-emerald-700 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Weighted Value</span>
              </div>
              <p className="text-2xl font-bold text-emerald-700">{formatCurrency(weightedValue)}</p>
              <p className="text-xs text-emerald-600 mt-1">{Math.round(probability * 100)}% probability</p>
            </div>
          </div>

          {totalQuoteValue > 0 && (
            <div className="bg-indigo-50 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 text-indigo-700 mb-1">
                <FileText className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Total Quoted Value</span>
              </div>
              <p className="text-2xl font-bold text-indigo-700">{formatCurrency(totalQuoteValue)}</p>
            </div>
          )}

          {/* Quick Actions */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Quick Actions</h3>
            <div className="flex flex-wrap gap-2">
              {deal.client_id && (
                <button
                  onClick={() => router.push(`/clients/${deal.client_id}`)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                >
                  <User className="w-4 h-4" />
                  View Client
                </button>
              )}
              <button
                onClick={() => router.push(`/quotes/new${deal.client_id ? `?client=${deal.client_id}` : ''}`)}
                className="flex items-center gap-2 px-4 py-2 bg-teal-100 hover:bg-teal-200 text-teal-700 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Quote
              </button>
              {quotes.length > 0 && (
                <button
                  onClick={() => router.push(`/quotes?search=${encodeURIComponent(deal.client_name || '')}`)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-sm font-medium transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  View Quotes
                </button>
              )}
            </div>
          </div>

          {/* Quotes List */}
          {quotes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Client Quotes</h3>
              <div className="space-y-2">
                {quotes.map((quote) => {
                  const isUSD = quote.currency === 'USD'
                  const lineTotal = quote.line_items?.reduce((s, item) => {
                    const price = isUSD 
                      ? calculateZarPrice(item.unitPrice, quote.client_type || 'end_user', formula, quote.region, quote.include_installation)
                      : item.unitPrice
                    return s + (item.qty * price)
                  }, 0) || 0
                  const quoteAge = daysBetween(new Date(quote.date || quote.created_at), new Date())
                  
                  return (
                    <div
                      key={quote.id}
                      onClick={() => router.push(`/quotes/${quote.id}`)}
                      className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-sm font-medium text-slate-700">{quote.quote_number}</p>
                          <p className="text-xs text-slate-500">{quote.project_title || 'No title'} • {quoteAge}d ago</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-700">{formatCurrency(lineTotal)}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            quote.status === 'approved' || quote.status === 'Accepted' ? 'bg-green-100 text-green-700' :
                            quote.status === 'sent' || quote.status === 'Sent' ? 'bg-blue-100 text-blue-700' :
                            quote.status === 'rejected' || quote.status === 'Declined' ? 'bg-red-100 text-red-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {quote.status}
                          </span>
                        </div>
                        <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-teal-500 transition-colors" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          {deal.notes && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Notes</h3>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{deal.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 bg-slate-50">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>Updated: {new Date(deal.updated_at || deal.created_at).toLocaleDateString()}</span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PipelinePage() {
  const [deals, setDeals] = useState<PipelineDeal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyDeal)
  const [saving, setSaving] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [formula, setFormula] = useState<Formula | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDeal, setSelectedDeal] = useState<PipelineDeal | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    return STAGES.reduce((acc, stage) => ({ ...acc, [stage.key]: true }), {})
  })
  const [expandedColumns, setExpandedColumns] = useState<Record<string, boolean>>({})

  const supabase = createClient()

  const toggleCollapse = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const expandAll = () => {
    setCollapsed(STAGES.reduce((acc, stage) => ({ ...acc, [stage.key]: false }), {}))
  }

  const collapseAll = () => {
    setCollapsed(STAGES.reduce((acc, stage) => ({ ...acc, [stage.key]: true }), {}))
  }

  const fetchDeals = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('pipeline')
      .select('*')
      .order('updated_at', { ascending: false })
    setDeals(data || [])
    setLoading(false)
  }

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('*').order('name')
    setClients(data || [])
  }

  const fetchQuotes = async () => {
    const { data } = await supabase.from('quotes').select('*').order('created_at', { ascending: false })
    setQuotes(data || [])
  }

  const fetchFormula = async () => {
    const { data } = await supabase.from('formula').select('*').limit(1).single()
    setFormula(data)
  }

  useEffect(() => { 
    fetchDeals()
    fetchClients()
    fetchQuotes()
    fetchFormula()

    // Real-time subscription for quotes changes (so deleted quotes disappear)
    const quotesChannel = supabase
      .channel('quotes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, () => {
        fetchQuotes()
      })
      .subscribe()

    // Real-time subscription for pipeline changes
    const pipelineChannel = supabase
      .channel('pipeline-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pipeline' }, () => {
        fetchDeals()
      })
      .subscribe()

    // Refetch when window regains focus (in case data changed in another tab)
    const handleFocus = () => {
      fetchQuotes()
      fetchDeals()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      quotesChannel.unsubscribe()
      pipelineChannel.unsubscribe()
      window.removeEventListener('focus', handleFocus)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Filter deals by search query
  const filteredDeals = useMemo(() => {
    if (!searchQuery.trim()) return deals
    const query = searchQuery.toLowerCase()
    return deals.filter(deal => 
      deal.client_name?.toLowerCase().includes(query) ||
      deal.title?.toLowerCase().includes(query)
    )
  }, [deals, searchQuery])

  // Calculate 90-day forecast
  const forecast90Days = useMemo(() => {
    // For simplicity, include all active deals in the forecast
    // In production, you might want to add an "expected_close_date" field
    const activeDeals = deals.filter(d => d.status !== 'closed_won' && d.status !== 'closed_lost')
    
    return activeDeals.reduce((sum, deal) => {
      const probability = getStageProbability(deal.status)
      return sum + ((Number(deal.value) || 0) * probability)
    }, 0)
  }, [deals])

  // Total weighted pipeline value
  const totalWeightedValue = useMemo(() => {
    const activeDeals = deals.filter(d => d.status !== 'closed_won' && d.status !== 'closed_lost')
    return activeDeals.reduce((sum, deal) => {
      const probability = getStageProbability(deal.status)
      return sum + ((Number(deal.value) || 0) * probability)
    }, 0)
  }, [deals])

  // Total unweighted pipeline value
  const totalPipelineValue = useMemo(() => {
    const activeDeals = deals.filter(d => d.status !== 'closed_won' && d.status !== 'closed_lost')
    return activeDeals.reduce((sum, deal) => sum + (Number(deal.value) || 0), 0)
  }, [deals])

  // Get quotes status for a deal
  const getQuotesStatus = (clientName: string): 'none' | 'quoted' | 'approved' => {
    const clientQuotes = quotes.filter(q => q.client_name?.toLowerCase() === clientName?.toLowerCase())
    if (clientQuotes.length === 0) return 'none'
    if (clientQuotes.some(q => q.status === 'approved' || q.status === 'Accepted')) return 'approved'
    return 'quoted'
  }

  // Get client for a deal
  const getClientForDeal = (deal: PipelineDeal): Client | null => {
    if (deal.client_id) {
      return clients.find(c => c.id === deal.client_id) || null
    }
    return clients.find(c => c.name?.toLowerCase() === deal.client_name?.toLowerCase()) || null
  }

  // Get quotes for a deal
  const getQuotesForDeal = (deal: PipelineDeal): Quote[] => {
    return quotes.filter(q => q.client_name?.toLowerCase() === deal.client_name?.toLowerCase())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const selectedClient = clients.find(c => c.id === form.client_id)
    await supabase.from('pipeline').insert({
      ...form,
      client_name: selectedClient?.name || ''
    })
    setSaving(false)
    setShowForm(false)
    setForm(emptyDeal)
    fetchDeals()
  }

  const handleStatusChange = async (id: string, status: PipelineStatus) => {
    await supabase.from('pipeline').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    fetchDeals()
  }

  const allExpanded = Object.values(collapsed).every(v => !v)
  const allCollapsed = Object.values(collapsed).every(v => v)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-900">Pipeline</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={expandAll}
              disabled={allExpanded}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Expand className="w-3 h-3" />
              Expand
            </button>
            <button
              onClick={collapseAll}
              disabled={allCollapsed}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Shrink className="w-3 h-3" />
              Collapse
            </button>
          </div>
        </div>
        <button 
          onClick={() => setShowForm(true)} 
          className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Deal
        </button>
      </div>

      {/* Pipeline Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-sm text-slate-500 mb-1">Active Deals</div>
          <div className="text-2xl font-bold text-slate-900">
            {deals.filter(d => d.status !== 'closed_won' && d.status !== 'closed_lost').length}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-sm text-slate-500 mb-1">Total Pipeline</div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalPipelineValue)}</div>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
          <div className="text-sm text-emerald-600 mb-1 flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            Weighted Value
          </div>
          <div className="text-2xl font-bold text-emerald-700">{formatCurrency(totalWeightedValue)}</div>
        </div>
        <div className="bg-teal-50 rounded-xl border border-teal-200 p-4">
          <div className="text-sm text-teal-600 mb-1 flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            90-Day Forecast
          </div>
          <div className="text-2xl font-bold text-teal-700">{formatCurrency(forecast90Days)}</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search pipeline by client name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="text-xs text-slate-500 mt-2">
            Found {filteredDeals.length} deal{filteredDeals.length !== 1 ? 's' : ''} matching &ldquo;{searchQuery}&rdquo;
          </p>
        )}
      </div>

      {/* New Deal Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">New Deal</h2>
            <button onClick={() => setShowForm(false)} className="p-1 hover:bg-slate-100 rounded">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input 
                type="text" 
                value={form.title} 
                onChange={e => setForm({...form, title: e.target.value})} 
                required 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Value (ZAR)</label>
              <input 
                type="number" 
                value={form.value} 
                onChange={e => setForm({...form, value: Number(e.target.value)})} 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Client</label>
              <select 
                value={form.client_id} 
                onChange={e => setForm({...form, client_id: e.target.value})} 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Stage</label>
              <select 
                value={form.status} 
                onChange={e => setForm({...form, status: e.target.value as PipelineStatus})} 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {STAGES.map(s => <option key={s.key} value={s.key}>{s.label} ({Math.round(s.probability * 100)}%)</option>)}
              </select>
            </div>
            <div className="md:col-span-2 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="bg-teal-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pipeline Boards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAGES.map((stage) => {
          const stageDeals = filteredDeals.filter(d => d.status === stage.key)
          const isCollapsed = collapsed[stage.key]
          const stageWeightedValue = stageDeals.reduce((sum, d) => sum + ((Number(d.value) || 0) * stage.probability), 0)
          
          return (
            <div 
              key={stage.key} 
              className={`rounded-xl border-2 ${stage.borderColor} ${stage.color} transition-all duration-200 ${isCollapsed ? 'p-3' : 'p-4'}`}
            >
              <button
                onClick={() => toggleCollapse(stage.key)}
                className="flex items-center justify-between w-full text-left group"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded group-hover:bg-white/50 transition-colors">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700">{stage.label}</h3>
                    <span className="text-xs text-slate-500">{Math.round(stage.probability * 100)}% prob</span>
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                  stageDeals.length > 0 ? 'bg-white text-slate-700 shadow-sm' : 'bg-white/50 text-slate-500'
                }`}>
                  {stageDeals.length}
                </span>
              </button>

              {/* Stage Value Summary */}
              {!isCollapsed && stageDeals.length > 0 && (
                <div className="mt-2 mb-3 p-2 bg-white/60 rounded-lg text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Weighted:</span>
                    <span className="font-semibold">{formatCurrency(stageWeightedValue)}</span>
                  </div>
                </div>
              )}

              {!isCollapsed && (
                <div className="mt-3 space-y-2">
                  {stageDeals.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      No deals in this stage
                    </div>
                  ) : (
                    <>
                      {(expandedColumns[stage.key] ? stageDeals : stageDeals.slice(0, DEALS_PER_COLUMN)).map((deal) => {
                        const quotesStatus = getQuotesStatus(deal.client_name || '')
                        const daysInStage = daysBetween(new Date(deal.updated_at || deal.created_at), new Date())
                        const probability = getStageProbability(deal.status)
                        const weightedValue = (Number(deal.value) || 0) * probability
                        const isStale = daysInStage >= 14
                        
                        return (
                          <div
                            key={deal.id}
                            onClick={() => setSelectedDeal(deal)}
                            className={`bg-white rounded-lg border p-3 shadow-sm cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group ${
                              isStale ? 'border-red-300 bg-red-50/50' : 'border-slate-200 hover:border-teal-400'
                            }`}
                          >
                            {/* Client Name */}
                            <p className="font-semibold text-sm text-slate-900 group-hover:text-teal-700 transition-colors">
                              {deal.client_name || deal.title}
                            </p>
                            
                            {/* Status Badges */}
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <QuoteStatusBadge status={quotesStatus} />
                              <StaleIndicator days={daysInStage} />
                            </div>

                            {/* Value & Weighted */}
                            {deal.value > 0 && (
                              <div className="mt-2 space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-slate-500">Value:</span>
                                  <span className="font-semibold text-slate-700">{formatCurrency(deal.value)}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-emerald-600">Weighted:</span>
                                  <span className="font-semibold text-emerald-600">{formatCurrency(weightedValue)}</span>
                                </div>
                              </div>
                            )}

                            {/* Days in Stage */}
                            <div className="mt-2 flex items-center gap-1 text-slate-400">
                              <Clock className="w-3 h-3" />
                              <span className="text-[10px]">{daysInStage}d in stage</span>
                            </div>
                          </div>
                        )
                      })}
                      {stageDeals.length > DEALS_PER_COLUMN && !expandedColumns[stage.key] && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedColumns(prev => ({ ...prev, [stage.key]: true }))
                          }}
                          className="w-full py-2 text-sm text-teal-600 hover:text-teal-700 font-medium bg-white/80 rounded-lg border border-dashed border-teal-300 hover:border-teal-400 transition-colors"
                        >
                          Show {stageDeals.length - DEALS_PER_COLUMN} more...
                        </button>
                      )}
                      {stageDeals.length > DEALS_PER_COLUMN && expandedColumns[stage.key] && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedColumns(prev => ({ ...prev, [stage.key]: false }))
                          }}
                          className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 font-medium bg-white/80 rounded-lg border border-dashed border-slate-300 hover:border-slate-400 transition-colors"
                        >
                          Show less
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Detail Modal */}
      {selectedDeal && (
        <DealDetailModal
          deal={selectedDeal}
          client={getClientForDeal(selectedDeal)}
          quotes={getQuotesForDeal(selectedDeal)}
          formula={formula}
          onClose={() => setSelectedDeal(null)}
          onStatusChange={(id, status) => {
            handleStatusChange(id, status)
            setSelectedDeal(prev => prev ? { ...prev, status } : null)
          }}
          stages={STAGES}
        />
      )}
    </div>
  )
}
