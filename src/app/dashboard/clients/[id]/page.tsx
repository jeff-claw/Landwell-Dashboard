'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { Client, Quote, Order, PipelineDeal, Formula, Ticket } from '@/lib/types'
import { TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG } from '@/lib/types'
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  Building2, 
  MapPin, 
  FileText, 
  ShoppingCart, 
  TrendingUp, 
  Clock,
  Calendar,
  DollarSign,
  User,
  Pencil,
  ChevronRight,
  Plus,
  Headset,
} from 'lucide-react'

interface TimelineEvent {
  id: string
  type: 'quote' | 'order' | 'pipeline' | 'created'
  title: string
  subtitle?: string
  date: Date
  status?: string
  value?: number
  icon: 'quote' | 'order' | 'pipeline' | 'user'
}

function daysBetween(date1: Date, date2: Date): number {
  const diff = date2.getTime() - date1.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(val || 0)
}

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

function calculateQuoteTotal(quote: Quote, formula: Formula | null): number {
  const isUSD = quote.currency === 'USD'
  let subtotal = 0

  quote.line_items?.forEach(item => {
    const zarPrice = isUSD
      ? calculateZarPrice(Number(item.unitPrice), quote.client_type, formula, quote.region, quote.include_installation)
      : Number(item.unitPrice)
    subtotal += Number(item.qty) * zarPrice
  })

  let discountAmount = 0
  if (quote.discount) {
    if (quote.discount_type === 'percent') {
      discountAmount = subtotal * (Number(quote.discount) / 100)
    } else {
      discountAmount = Number(quote.discount)
    }
  }

  const afterDiscount = subtotal - discountAmount
  const vat = afterDiscount * 0.15
  return afterDiscount + vat
}

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const clientId = params.id as string

  const [client, setClient] = useState<Client | null>(null)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [pipeline, setPipeline] = useState<PipelineDeal[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [formula, setFormula] = useState<Formula | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()

      // Fetch client
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()

      if (clientError || !clientData) {
        console.error('Client not found')
        router.push('/clients')
        return
      }

      setClient(clientData)

      // Fetch related data
      const [quotesRes, ordersRes, pipelineRes, ticketsRes, formulaRes] = await Promise.all([
        supabase.from('quotes').select('*').or(`client_id.eq.${clientId},client_name.ilike.${clientData.name}`).order('created_at', { ascending: false }),
        supabase.from('orders').select('*').or(`client_id.eq.${clientId},client_name.ilike.${clientData.name}`).order('created_at', { ascending: false }),
        supabase.from('pipeline').select('*').or(`client_id.eq.${clientId},client_name.ilike.${clientData.name}`).order('updated_at', { ascending: false }),
        supabase.from('tickets').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(10),
        supabase.from('formula').select('*').limit(1).single(),
      ])

      setQuotes(quotesRes.data || [])
      setOrders(ordersRes.data || [])
      setPipeline(pipelineRes.data || [])
      setTickets(ticketsRes.data || [])
      if (formulaRes.data) setFormula(formulaRes.data)

      setLoading(false)
    }

    if (clientId) {
      fetchData()
    }
  }, [clientId, router])

  // Build activity timeline
  const timeline = useMemo((): TimelineEvent[] => {
    if (!client) return []

    const events: TimelineEvent[] = []

    // Client creation
    events.push({
      id: `client-${client.id}`,
      type: 'created',
      title: 'Client Added',
      subtitle: `${client.name} was added to the system`,
      date: new Date(client.created_at),
      icon: 'user'
    })

    // Quotes
    quotes.forEach(quote => {
      events.push({
        id: `quote-${quote.id}`,
        type: 'quote',
        title: `Quote ${quote.quote_number}`,
        subtitle: quote.project_title || 'Quote created',
        date: new Date(quote.created_at),
        status: quote.status,
        value: calculateQuoteTotal(quote, formula),
        icon: 'quote'
      })
    })

    // Orders
    orders.forEach(order => {
      events.push({
        id: `order-${order.id}`,
        type: 'order',
        title: `Order ${order.order_number}`,
        subtitle: order.notes || 'Order placed',
        date: new Date(order.created_at),
        status: order.status,
        value: order.value_zar,
        icon: 'order'
      })
    })

    // Pipeline status changes (using updated_at as proxy)
    pipeline.forEach(deal => {
      events.push({
        id: `pipeline-${deal.id}`,
        type: 'pipeline',
        title: `Pipeline: ${deal.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`,
        subtitle: deal.title,
        date: new Date(deal.updated_at || deal.created_at),
        status: deal.status,
        value: deal.value,
        icon: 'pipeline'
      })
    })

    // Sort by date descending
    return events.sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [client, quotes, orders, pipeline, formula])

  // Calculate stats
  const stats = useMemo(() => {
    if (!client) return null

    const now = new Date()
    
    // Total quotes value
    const totalQuoted = quotes.reduce((sum, q) => sum + calculateQuoteTotal(q, formula), 0)
    
    // Won quotes
    const wonQuotes = quotes.filter(q => q.status === 'accepted' || q.status === 'Accepted')
    const wonValue = wonQuotes.reduce((sum, q) => sum + calculateQuoteTotal(q, formula), 0)
    
    // Total orders
    const totalOrders = orders.reduce((sum, o) => sum + (Number(o.value_zar) || 0), 0)
    
    // Days since last activity
    const lastActivityDate = timeline.length > 0 ? timeline[0].date : new Date(client.created_at)
    const daysSinceActivity = daysBetween(lastActivityDate, now)
    
    // Win rate
    const decidedQuotes = quotes.filter(q => 
      q.status === 'accepted' || q.status === 'Accepted' || 
      q.status === 'declined' || q.status === 'Declined'
    )
    const winRate = decidedQuotes.length > 0 
      ? Math.round((wonQuotes.length / decidedQuotes.length) * 100) 
      : 0

    return {
      quotesCount: quotes.length,
      ordersCount: orders.length,
      totalQuoted,
      wonValue,
      totalOrders,
      daysSinceActivity,
      winRate,
      pipelineStatus: pipeline[0]?.status || null
    }
  }, [client, quotes, orders, pipeline, timeline, formula])

  const getStatusColor = (status: string) => {
    const s = status?.toLowerCase()
    if (s === 'accepted' || s === 'closed_won' || s === 'completed') return 'bg-green-100 text-green-700'
    if (s === 'declined' || s === 'closed_lost' || s === 'cancelled') return 'bg-red-100 text-red-700'
    if (s === 'sent' || s === 'proposal_sent' || s === 'processing') return 'bg-blue-100 text-blue-700'
    if (s === 'po_received') return 'bg-amber-100 text-amber-700'
    return 'bg-slate-100 text-slate-700'
  }

  const getIconComponent = (icon: string) => {
    switch (icon) {
      case 'quote': return <FileText className="w-4 h-4" />
      case 'order': return <ShoppingCart className="w-4 h-4" />
      case 'pipeline': return <TrendingUp className="w-4 h-4" />
      case 'user': return <User className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const getIconBgColor = (icon: string) => {
    switch (icon) {
      case 'quote': return 'bg-indigo-100 text-indigo-600'
      case 'order': return 'bg-emerald-100 text-emerald-600'
      case 'pipeline': return 'bg-purple-100 text-purple-600'
      case 'user': return 'bg-teal-100 text-teal-600'
      default: return 'bg-slate-100 text-slate-600'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!client) {
    return null
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <button 
          onClick={() => router.push('/clients')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm mb-4 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Clients
        </button>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                client.type === 'reseller' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {client.type === 'reseller' ? 'Reseller' : 'End User'}
              </span>
            </div>
            {stats && stats.daysSinceActivity > 0 && (
              <p className="text-sm text-slate-500 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Last activity {stats.daysSinceActivity} days ago
              </p>
            )}
          </div>
          
          <div className="flex gap-2">
            <Link 
              href={`/quotes?new=true&client=${client.id}`}
              className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition"
            >
              <Plus className="w-4 h-4" />
              New Quote
            </Link>
            <button 
              onClick={() => router.push(`/clients`)}
              className="flex items-center gap-2 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* Client Info & Stats */}
      <div className="grid md:grid-cols-3 gap-6 mb-6">
        {/* Contact Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Contact Information</h3>
          <div className="space-y-3">
            {client.contact_person && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{client.contact_person}</p>
                  <p className="text-xs text-slate-500">Contact Person</p>
                </div>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Mail className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <a href={`mailto:${client.email}`} className="text-sm font-medium text-teal-600 hover:underline">
                    {client.email}
                  </a>
                  <p className="text-xs text-slate-500">Email</p>
                </div>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Phone className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <a href={`tel:${client.phone}`} className="text-sm font-medium text-teal-600 hover:underline">
                    {client.phone}
                  </a>
                  <p className="text-xs text-slate-500">Phone</p>
                </div>
              </div>
            )}
            {client.vat_number && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{client.vat_number}</p>
                  <p className="text-xs text-slate-500">VAT Number</p>
                </div>
              </div>
            )}
            {client.address && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{client.address}</p>
                  <p className="text-xs text-slate-500">Address</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
              <FileText className="w-4 h-4" />
              Quotes
            </div>
            <div className="text-2xl font-bold text-slate-900">{stats?.quotesCount || 0}</div>
            <div className="text-xs text-slate-500 mt-1">{stats?.winRate || 0}% win rate</div>
          </div>
          
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
              <ShoppingCart className="w-4 h-4" />
              Orders
            </div>
            <div className="text-2xl font-bold text-slate-900">{stats?.ordersCount || 0}</div>
            <div className="text-xs text-slate-500 mt-1">{formatCurrency(stats?.totalOrders || 0)}</div>
          </div>
          
          <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
            <div className="flex items-center gap-2 text-emerald-600 text-sm mb-1">
              <DollarSign className="w-4 h-4" />
              Won Value
            </div>
            <div className="text-2xl font-bold text-emerald-700">{formatCurrency(stats?.wonValue || 0)}</div>
          </div>
          
          <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4">
            <div className="flex items-center gap-2 text-indigo-600 text-sm mb-1">
              <TrendingUp className="w-4 h-4" />
              Total Quoted
            </div>
            <div className="text-2xl font-bold text-indigo-700">{formatCurrency(stats?.totalQuoted || 0)}</div>
          </div>
        </div>
      </div>

      {/* Pipeline Status Banner */}
      {stats?.pipelineStatus && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-purple-600">Current Pipeline Stage</p>
                <p className="font-bold text-purple-900">
                  {stats.pipelineStatus.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </p>
              </div>
            </div>
            <Link 
              href="/pipeline"
              className="flex items-center gap-1 text-sm text-purple-600 font-medium hover:underline"
            >
              View Pipeline <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Support Tickets */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Headset className="w-5 h-5 text-orange-600" />
            Support Tickets
          </h3>
          <Link
            href={`/tickets/new?client=${client.id}`}
            className="flex items-center gap-1.5 text-sm text-teal-600 font-medium hover:underline"
          >
            <Plus className="w-4 h-4" />
            New Ticket
          </Link>
        </div>

        {tickets.length === 0 ? (
          <div className="text-center py-8">
            <Headset className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-slate-500 text-sm">No support tickets for this client</p>
            <Link
              href={`/tickets/new?client=${client.id}`}
              className="inline-flex items-center gap-1.5 mt-3 text-sm text-teal-600 font-medium hover:underline"
            >
              <Plus className="w-4 h-4" />
              Create a ticket
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.slice(0, 5).map(ticket => {
              const statusCfg = TICKET_STATUS_CONFIG[ticket.status as keyof typeof TICKET_STATUS_CONFIG] || TICKET_STATUS_CONFIG.open
              const priorityCfg = TICKET_PRIORITY_CONFIG[ticket.priority as keyof typeof TICKET_PRIORITY_CONFIG] || TICKET_PRIORITY_CONFIG.medium
              return (
                <Link
                  key={ticket.id}
                  href={`/tickets/${ticket.id}`}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition group"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate group-hover:text-teal-700 transition">{ticket.subject}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}>
                        {statusCfg.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityCfg.bg} ${priorityCfg.text}`}>
                        {priorityCfg.label}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-teal-500 flex-shrink-0" />
                </Link>
              )
            })}
            {tickets.length > 5 && (
              <Link
                href={`/tickets?client=${client.id}`}
                className="block text-center text-sm text-teal-600 font-medium hover:underline py-2"
              >
                View all {tickets.length} tickets
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Activity Timeline */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Clock className="w-5 h-5 text-teal-600" />
          Activity Timeline
        </h3>
        
        {timeline.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-slate-500">No activity yet</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200" />
            
            <div className="space-y-6">
              {timeline.map((event) => (
                <div key={event.id} className="relative flex gap-4">
                  {/* Icon */}
                  <div className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center ${getIconBgColor(event.icon)}`}>
                    {getIconComponent(event.icon)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 bg-slate-50 rounded-xl p-4 hover:bg-slate-100 transition">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-slate-900">{event.title}</p>
                        {event.subtitle && (
                          <p className="text-sm text-slate-600 mt-0.5">{event.subtitle}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        {event.status && (
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mb-1 ${getStatusColor(event.status)}`}>
                            {event.status}
                          </span>
                        )}
                        {event.value !== undefined && event.value > 0 && (
                          <p className="text-sm font-semibold text-slate-700">{formatCurrency(event.value)}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                      <Calendar className="w-3 h-3" />
                      {event.date.toLocaleDateString('en-ZA', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      {client.notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mt-6">
          <h3 className="text-sm font-semibold text-amber-700 uppercase tracking-wide mb-2">Notes</h3>
          <p className="text-slate-700 whitespace-pre-wrap">{client.notes}</p>
        </div>
      )}
    </div>
  )
}
