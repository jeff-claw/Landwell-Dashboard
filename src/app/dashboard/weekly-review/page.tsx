'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Quote, PipelineDeal, OrderWithShipping, Task, Formula } from '@/lib/types'
import { 
  CalendarDays, 
  TrendingUp, 
  Users, 
  FileText, 
  Target, 
  DollarSign, 
  Percent,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Clock,
  Package,
  Truck,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CheckCircle,
  XCircle,
  Loader2,
  BarChart3,
  ShoppingCart,
  Sparkles,
  RefreshCw,
  Presentation,
  Play,
  CheckCircle2
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-ZA', { 
    style: 'currency', 
    currency: 'ZAR', 
    maximumFractionDigits: 0 
  }).format(val || 0)
}

function daysBetween(date1: Date, date2: Date): number {
  const diff = date2.getTime() - date1.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Sunday
  const start = new Date(d.setDate(diff))
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function formatDateRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const startStr = start.toLocaleDateString('en-ZA', opts)
  const endStr = end.toLocaleDateString('en-ZA', { ...opts, year: 'numeric' })
  return `${startStr} - ${endStr}`
}

function calculateQuoteTotal(quote: Quote, formula: Formula | null): number {
  const isUSD = quote.currency === 'USD'
  let total = 0

  quote.line_items?.forEach(item => {
    const price = isUSD
      ? calculateZarPrice(Number(item.unitPrice), quote.client_type, formula, quote.region, quote.include_installation)
      : Number(item.unitPrice)
    total += Number(item.qty) * price
  })

  // Apply discount
  if (quote.discount) {
    if (quote.discount_type === 'percent') {
      total = total * (1 - Number(quote.discount) / 100)
    } else {
      total -= Number(quote.discount)
    }
  }

  // Add VAT
  total = total * 1.15

  return total
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

  if (clientType === 'End User' || clientType === 'end_user') {
    return resellerWithInstall / endUserDivisor
  }
  return includeInstallation ? resellerWithInstall : resellerNoInstall
}

// ============================================================================
// COMPONENTS
// ============================================================================

// Clickable card wrapper component
function ClickableCard({ 
  href, 
  children, 
  className = '',
  empty = false 
}: { 
  href: string
  children: React.ReactNode
  className?: string
  empty?: boolean
}) {
  const router = useRouter()
  return (
    <div 
      onClick={() => router.push(href)}
      className={`cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-md ${className} ${empty ? 'opacity-70 hover:opacity-100' : ''}`}
    >
      {children}
    </div>
  )
}

// Clickable row wrapper component
function ClickableRow({ 
  href, 
  children, 
  className = '' 
}: { 
  href: string
  children: React.ReactNode
  className?: string
}) {
  const router = useRouter()
  return (
    <div 
      onClick={() => router.push(href)}
      className={`cursor-pointer transition-colors hover:bg-slate-100 ${className}`}
    >
      {children}
    </div>
  )
}

// Trend Indicator Component
function TrendIndicator({ current, previous, isGoodUp = true }: { current: number; previous: number; isGoodUp?: boolean }) {
  if (previous === 0 && current === 0) {
    return <Minus className="w-4 h-4 text-slate-400" />
  }
  
  const diff = current - previous
  const percentChange = previous !== 0 ? Math.round((diff / previous) * 100) : (current > 0 ? 100 : 0)
  const isUp = diff > 0
  const isNeutral = diff === 0
  
  const isGood = isGoodUp ? isUp : !isUp
  
  if (isNeutral) {
    return <Minus className="w-4 h-4 text-slate-400" />
  }
  
  return (
    <div className={`flex items-center gap-1 text-xs font-semibold ${isGood ? 'text-green-600' : 'text-red-600'}`}>
      {isUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
      <span>{Math.abs(percentChange)}%</span>
    </div>
  )
}

// Metric Card Component - Now Clickable!
function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  subValue, 
  current, 
  previous, 
  isGoodUp = true,
  gradient,
  href
}: { 
  icon: React.ElementType
  label: string
  value: string | number
  subValue?: string
  current: number
  previous: number
  isGoodUp?: boolean
  gradient: string
  href: string
}) {
  const router = useRouter()
  return (
    <div 
      onClick={() => router.push(href)}
      className={`rounded-2xl p-5 text-white ${gradient} shadow-lg relative overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.03] hover:shadow-xl`}
    >
      <div className="absolute top-0 right-0 w-24 h-24 opacity-10">
        <div className="absolute -top-6 -right-6 w-24 h-24 bg-white rounded-full" />
      </div>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Icon className="w-5 h-5" />
          </div>
          <TrendIndicator current={current} previous={previous} isGoodUp={isGoodUp} />
        </div>
        <div className="text-3xl font-bold">{value}</div>
        <div className="text-white/80 text-sm font-medium">{label}</div>
        {subValue && <div className="text-white/60 text-xs mt-1">{subValue}</div>}
      </div>
    </div>
  )
}

// Section Header Component - Now Clickable!
function SectionHeader({ icon: Icon, title, action, href }: { icon: React.ElementType; title: string; action?: React.ReactNode; href?: string }) {
  const router = useRouter()
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 
        onClick={href ? () => router.push(href) : undefined}
        className={`text-lg font-bold text-slate-900 flex items-center gap-2 ${href ? 'cursor-pointer hover:text-teal-600 transition-colors' : ''}`}
      >
        <Icon className="w-5 h-5 text-teal-600" />
        {title}
      </h2>
      {action}
    </div>
  )
}

// Status Badge Component
function StatusBadge({ status, className = '' }: { status: string; className?: string }) {
  const styles: Record<string, string> = {
    accepted: 'bg-green-100 text-green-700',
    Accepted: 'bg-green-100 text-green-700',
    sent: 'bg-blue-100 text-blue-700',
    Sent: 'bg-blue-100 text-blue-700',
    declined: 'bg-red-100 text-red-700',
    Declined: 'bg-red-100 text-red-700',
    draft: 'bg-slate-100 text-slate-600',
    Draft: 'bg-slate-100 text-slate-600',
  }
  
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status] || 'bg-slate-100 text-slate-600'} ${className}`}>
      {status}
    </span>
  )
}

// Priority Badge Component
function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    urgent: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-slate-100 text-slate-600',
  }
  
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${styles[priority] || styles.medium}`}>
      {priority}
    </span>
  )
}

// Empty State Component - Now Clickable!
function EmptyState({ 
  icon: Icon, 
  message, 
  actionText, 
  href 
}: { 
  icon: React.ElementType
  message: string
  actionText: string
  href: string 
}) {
  const router = useRouter()
  return (
    <div 
      onClick={() => router.push(href)}
      className="text-center py-6 text-slate-400 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors group"
    >
      <Icon className="w-8 h-8 mx-auto mb-2 opacity-50 group-hover:opacity-70 transition-opacity" />
      <p className="text-sm">{message}</p>
      <p className="text-xs text-teal-600 mt-1 font-medium group-hover:underline">{actionText} →</p>
    </div>
  )
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function WeeklyReviewPage() {
  const [loading, setLoading] = useState(true)
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const { start } = getWeekRange(new Date())
    return start
  })
  
  // Data states
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [pipeline, setPipeline] = useState<PipelineDeal[]>([])
  const [orders, setOrders] = useState<OrderWithShipping[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [formula, setFormula] = useState<Formula | null>(null)
  const [clients, setClients] = useState<{ id: string; name: string; created_at: string }[]>([])
  const [meetingNotes, setMeetingNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  // Calculate week ranges
  const { start: weekStart, end: weekEnd } = useMemo(() => {
    const end = new Date(currentWeekStart)
    end.setDate(end.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return { start: currentWeekStart, end }
  }, [currentWeekStart])

  const { start: lastWeekStart, end: lastWeekEnd } = useMemo(() => {
    const start = new Date(currentWeekStart)
    start.setDate(start.getDate() - 7)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }, [currentWeekStart])

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true)
    
    const [quotesRes, pipelineRes, ordersRes, tasksRes, formulaRes, clientsRes] = await Promise.all([
      supabase.from('quotes').select('*').order('created_at', { ascending: false }),
      supabase.from('pipeline').select('*').order('updated_at', { ascending: false }),
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('tasks').select('*'),
      supabase.from('formula').select('*').limit(1).single(),
      supabase.from('clients').select('id, name, created_at').order('created_at', { ascending: false }),
    ])

    setQuotes(quotesRes.data || [])
    setPipeline(pipelineRes.data || [])
    setOrders(ordersRes.data || [])
    setTasks(tasksRes.data || [])
    setFormula(formulaRes.data)
    setClients(clientsRes.data || [])
    
    // Load meeting notes from localStorage
    const weekKey = `meeting_notes_${currentWeekStart.toISOString().split('T')[0]}`
    const savedNotes = localStorage.getItem(weekKey)
    if (savedNotes) setMeetingNotes(savedNotes)
    
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWeekStart])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Week navigation
  const goToPreviousWeek = () => {
    setCurrentWeekStart(prev => {
      const newDate = new Date(prev)
      newDate.setDate(newDate.getDate() - 7)
      return newDate
    })
  }

  const goToNextWeek = () => {
    setCurrentWeekStart(prev => {
      const newDate = new Date(prev)
      newDate.setDate(newDate.getDate() + 7)
      return newDate
    })
  }

  const goToCurrentWeek = () => {
    const { start } = getWeekRange(new Date())
    setCurrentWeekStart(start)
  }

  const isCurrentWeek = useMemo(() => {
    const { start } = getWeekRange(new Date())
    return currentWeekStart.getTime() === start.getTime()
  }, [currentWeekStart])

  // Save meeting notes
  const saveMeetingNotes = () => {
    setSavingNotes(true)
    const weekKey = `meeting_notes_${currentWeekStart.toISOString().split('T')[0]}`
    localStorage.setItem(weekKey, meetingNotes)
    setTimeout(() => setSavingNotes(false), 500)
  }

  // ============================================================================
  // COMPUTED METRICS
  // ============================================================================

  // Filter data by date range
  const filterByDateRange = useCallback(<T extends { created_at: string }>(items: T[], start: Date, end: Date): T[] => {
    return items.filter(item => {
      const date = new Date(item.created_at)
      return date >= start && date <= end
    })
  }, [])

  const filterByUpdatedDateRange = useCallback(<T extends { updated_at?: string; created_at: string }>(items: T[], start: Date, end: Date): T[] => {
    return items.filter(item => {
      const date = new Date(item.updated_at || item.created_at)
      return date >= start && date <= end
    })
  }, [])

  // This Week's Stats
  const thisWeekStats = useMemo(() => {
    const thisWeekQuotes = filterByDateRange(quotes, weekStart, weekEnd)
    const thisWeekOrders = filterByDateRange(orders, weekStart, weekEnd)
    const thisWeekClients = filterByDateRange(clients, weekStart, weekEnd)
    const thisWeekPipelineUpdates = filterByUpdatedDateRange(pipeline, weekStart, weekEnd)

    // Quotes stats
    const quotesSent = thisWeekQuotes.filter(q => q.status === 'sent' || q.status === 'Sent' || q.status === 'accepted' || q.status === 'Accepted' || q.status === 'declined' || q.status === 'Declined')
    const quotesWon = thisWeekQuotes.filter(q => q.status === 'accepted' || q.status === 'Accepted')
    const quotesLost = thisWeekQuotes.filter(q => q.status === 'declined' || q.status === 'Declined')
    
    const quotesSentValue = quotesSent.reduce((sum, q) => sum + calculateQuoteTotal(q, formula), 0)
    const quotesWonValue = quotesWon.reduce((sum, q) => sum + calculateQuoteTotal(q, formula), 0)
    
    const totalDecided = quotesWon.length + quotesLost.length
    const winRate = totalDecided > 0 ? Math.round((quotesWon.length / totalDecided) * 100) : 0
    
    // Revenue from orders
    const revenue = thisWeekOrders.reduce((sum, o) => sum + (Number(o.value_zar) || 0), 0)

    // Demo tracking
    // Active demos = pipeline entries currently in 'demo' stage
    const demosActive = pipeline.filter(p => p.status === 'demo')
    
    // Demos completed this week = deals that moved FROM demo TO a later stage (po_received, won) this week
    const demosCompleted = pipeline.filter(p => {
      const updatedDate = new Date(p.updated_at || p.created_at)
      const isThisWeek = updatedDate >= weekStart && updatedDate <= weekEnd
      const isCompletedStage = ['po_received', 'won', 'closed_won'].includes(p.status)
      return isThisWeek && isCompletedStage
    })

    return {
      newLeads: thisWeekClients.length,
      newPipelineDeals: thisWeekPipelineUpdates.filter(p => {
        const createdDate = new Date(p.created_at)
        return createdDate >= weekStart && createdDate <= weekEnd
      }).length,
      quotesSent: quotesSent.length,
      quotesSentValue,
      quotesWon: quotesWon.length,
      quotesWonValue,
      quotesLost: quotesLost.length,
      winRate,
      revenue,
      ordersCount: thisWeekOrders.length,
      demosActive: demosActive.length,
      demosCompleted: demosCompleted.length,
    }
  }, [quotes, orders, clients, pipeline, weekStart, weekEnd, formula, filterByDateRange, filterByUpdatedDateRange])

  // Last Week's Stats (for comparison)
  const lastWeekStats = useMemo(() => {
    const lastWeekQuotes = filterByDateRange(quotes, lastWeekStart, lastWeekEnd)
    const lastWeekOrders = filterByDateRange(orders, lastWeekStart, lastWeekEnd)
    const lastWeekClients = filterByDateRange(clients, lastWeekStart, lastWeekEnd)

    const quotesSent = lastWeekQuotes.filter(q => q.status === 'sent' || q.status === 'Sent' || q.status === 'accepted' || q.status === 'Accepted' || q.status === 'declined' || q.status === 'Declined')
    const quotesWon = lastWeekQuotes.filter(q => q.status === 'accepted' || q.status === 'Accepted')
    const quotesLost = lastWeekQuotes.filter(q => q.status === 'declined' || q.status === 'Declined')
    
    const totalDecided = quotesWon.length + quotesLost.length
    const winRate = totalDecided > 0 ? Math.round((quotesWon.length / totalDecided) * 100) : 0
    
    const revenue = lastWeekOrders.reduce((sum, o) => sum + (Number(o.value_zar) || 0), 0)

    // Demo tracking for last week (for comparison)
    // Demos completed last week = deals that moved to po_received/won/closed_won last week
    const lastWeekDemosCompleted = pipeline.filter(p => {
      const updatedDate = new Date(p.updated_at || p.created_at)
      const isLastWeek = updatedDate >= lastWeekStart && updatedDate <= lastWeekEnd
      const isCompletedStage = ['po_received', 'won', 'closed_won'].includes(p.status)
      return isLastWeek && isCompletedStage
    })

    return {
      newLeads: lastWeekClients.length,
      quotesSent: quotesSent.length,
      quotesWon: quotesWon.length,
      quotesLost: quotesLost.length,
      winRate,
      revenue,
      demosCompleted: lastWeekDemosCompleted.length,
    }
  }, [quotes, orders, clients, pipeline, lastWeekStart, lastWeekEnd, filterByDateRange])

  // Demos This Week
  const demosThisWeek = useMemo(() => {
    // Active demos (currently in demo stage)
    const active = pipeline.filter(p => p.status === 'demo')
    
    // Demos completed this week (moved to po_received or won)
    const completed = pipeline.filter(p => {
      const updatedDate = new Date(p.updated_at || p.created_at)
      const isThisWeek = updatedDate >= weekStart && updatedDate <= weekEnd
      const isCompletedStage = ['po_received', 'won', 'closed_won'].includes(p.status)
      return isThisWeek && isCompletedStage
    }).map(deal => ({
      ...deal,
      outcome: deal.status === 'won' || deal.status === 'closed_won' ? 'won' : 'po_received'
    }))
    
    // All demo-related deals for the list view (active + recently completed)
    const allDemos = [
      ...active.map(d => ({ ...d, demoStatus: 'active' as const })),
      ...completed.map(d => ({ ...d, demoStatus: d.outcome === 'won' ? 'won' as const : 'completed' as const }))
    ].sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())

    return {
      active,
      completed,
      allDemos,
      totalActive: active.length,
      totalCompleted: completed.length,
      wonCount: completed.filter(d => d.outcome === 'won').length,
      poReceivedCount: completed.filter(d => d.outcome === 'po_received').length,
    }
  }, [pipeline, weekStart, weekEnd])

  // Pipeline Movement
  const pipelineMovement = useMemo(() => {
    const now = new Date()
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    
    // Active deals (exclude closed)
    const activeDeals = pipeline.filter(d => d.status !== 'closed_won' && d.status !== 'closed_lost')
    
    // Deals that moved forward this week (updated within week range)
    const movedForward = pipeline.filter(p => {
      const updatedDate = new Date(p.updated_at || p.created_at)
      const createdDate = new Date(p.created_at)
      return updatedDate >= weekStart && updatedDate <= weekEnd && updatedDate.getTime() !== createdDate.getTime()
    })
    
    // Cold deals (no activity in 14+ days)
    const coldDeals = activeDeals.filter(d => {
      const lastUpdate = new Date(d.updated_at || d.created_at)
      return lastUpdate < fourteenDaysAgo
    })
    
    // New opportunities (created this week)
    const newOpportunities = pipeline.filter(p => {
      const createdDate = new Date(p.created_at)
      return createdDate >= weekStart && createdDate <= weekEnd
    })
    
    // Deals expected to close this week (using updated_at as proxy since we don't have expected_close_date)
    // In a real implementation, you'd filter by expected_close_date
    const expectedToClose = activeDeals.filter(d => d.status === 'po_received')

    return {
      movedForward,
      coldDeals,
      newOpportunities,
      expectedToClose,
    }
  }, [pipeline, weekStart, weekEnd])

  // Quote Activity
  const quoteActivity = useMemo(() => {
    const thisWeekQuotes = filterByDateRange(quotes, weekStart, weekEnd)
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    
    // All quotes sent this week
    const allSent = thisWeekQuotes.map(q => ({
      ...q,
      value: calculateQuoteTotal(q, formula),
      daysSinceSent: daysBetween(new Date(q.date || q.created_at), new Date()),
    }))
    
    // Quotes needing follow-up (sent > 3 days, still in sent status)
    const needFollowUp = quotes.filter(q => {
      if (q.status !== 'sent' && q.status !== 'Sent') return false
      const sentDate = new Date(q.date || q.created_at)
      return sentDate < threeDaysAgo
    }).map(q => ({
      ...q,
      value: calculateQuoteTotal(q, formula),
      daysSinceSent: daysBetween(new Date(q.date || q.created_at), new Date()),
    }))

    return { allSent, needFollowUp }
  }, [quotes, weekStart, weekEnd, formula, filterByDateRange])

  // Orders & Shipments
  const ordersAndShipments = useMemo(() => {
    const thisWeekOrders = filterByDateRange(orders, weekStart, weekEnd)
    const thisWeekShipmentUpdates = orders.filter(o => {
      const updatedDate = new Date(o.updated_at)
      return updatedDate >= weekStart && updatedDate <= weekEnd && o.shipment_status && o.shipment_status !== 'pending'
    })

    return {
      newOrders: thisWeekOrders,
      shipmentUpdates: thisWeekShipmentUpdates,
    }
  }, [orders, weekStart, weekEnd, filterByDateRange])

  // Action Items
  const actionItems = useMemo(() => {
    const now = new Date()
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    // Quotes needing follow-up
    const quotesNeedFollowUp = quotes.filter(q => {
      if (q.status !== 'sent' && q.status !== 'Sent') return false
      const sentDate = new Date(q.date || q.created_at)
      return sentDate < threeDaysAgo
    })

    // Stale pipeline deals
    const activeDeals = pipeline.filter(d => d.status !== 'closed_won' && d.status !== 'closed_lost')
    const staleDeals = activeDeals.filter(d => {
      const lastUpdate = new Date(d.updated_at || d.created_at)
      return lastUpdate < fourteenDaysAgo
    })

    // Deals expected to close
    const dealsToClose = activeDeals.filter(d => d.status === 'po_received')

    // Overdue tasks
    const overdueTasks = tasks.filter(t => {
      if (t.completed) return false
      if (!t.due_date) return false
      return new Date(t.due_date) < now
    })

    return {
      quotesNeedFollowUp,
      staleDeals,
      dealsToClose,
      overdueTasks,
    }
  }, [quotes, pipeline, tasks])

  // Top Products
  const topProducts = useMemo(() => {
    const thisWeekQuotes = filterByDateRange(quotes, weekStart, weekEnd)
    const wonQuotes = thisWeekQuotes.filter(q => q.status === 'accepted' || q.status === 'Accepted')

    // Count product mentions in quotes
    const productCounts: Record<string, { quoted: number; sold: number }> = {}

    thisWeekQuotes.forEach(q => {
      q.line_items?.forEach(item => {
        const product = item.product || 'Unknown'
        if (!productCounts[product]) {
          productCounts[product] = { quoted: 0, sold: 0 }
        }
        productCounts[product].quoted += item.qty
      })
    })

    wonQuotes.forEach(q => {
      q.line_items?.forEach(item => {
        const product = item.product || 'Unknown'
        if (productCounts[product]) {
          productCounts[product].sold += item.qty
        }
      })
    })

    // Sort by quoted count
    const sorted = Object.entries(productCounts)
      .sort((a, b) => b[1].quoted - a[1].quoted)
      .slice(0, 5)

    return sorted.map(([name, counts]) => ({ name, ...counts }))
  }, [quotes, weekStart, weekEnd, filterByDateRange])

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-20 print:pb-0 animate-fade-in">
      {/* ================================================================== */}
      {/* HEADER SECTION */}
      {/* ================================================================== */}
      <div className="relative overflow-hidden rounded-3xl p-6 md:p-8 text-white bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800">
        <div className="absolute top-0 right-0 w-64 h-64 opacity-5">
          <CalendarDays className="w-full h-full" />
        </div>
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-1">Weekly Sales Review</h1>
              <p className="text-slate-300 text-lg">{formatDateRange(weekStart, weekEnd)}</p>
            </div>
            
            {/* Week Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={goToPreviousWeek}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={goToCurrentWeek}
                disabled={isCurrentWeek}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isCurrentWeek 
                    ? 'bg-teal-500 text-white cursor-default' 
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                {isCurrentWeek ? 'This Week' : 'Go to This Week'}
              </button>
              <button
                onClick={goToNextWeek}
                disabled={isCurrentWeek}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* KEY METRICS CARDS - ALL CLICKABLE */}
      {/* ================================================================== */}
      <div>
        <SectionHeader icon={BarChart3} title="Key Metrics" action={
          <span className="text-xs text-slate-500">vs last week</span>
        } />
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
          <MetricCard
            icon={Users}
            label="New Leads"
            value={thisWeekStats.newLeads}
            current={thisWeekStats.newLeads}
            previous={lastWeekStats.newLeads}
            gradient="bg-gradient-to-br from-blue-500 to-blue-600"
            href="/clients"
          />
          <MetricCard
            icon={FileText}
            label="Quotes Sent"
            value={thisWeekStats.quotesSent}
            subValue={formatCurrency(thisWeekStats.quotesSentValue)}
            current={thisWeekStats.quotesSent}
            previous={lastWeekStats.quotesSent}
            gradient="bg-gradient-to-br from-indigo-500 to-indigo-600"
            href="/quotes"
          />
          <MetricCard
            icon={Presentation}
            label="Demos Active"
            value={thisWeekStats.demosActive}
            subValue="In demo stage"
            current={thisWeekStats.demosActive}
            previous={thisWeekStats.demosActive}
            gradient="bg-gradient-to-br from-cyan-500 to-cyan-600"
            href="/pipeline"
          />
          <MetricCard
            icon={CheckCircle2}
            label="Demos Done"
            value={thisWeekStats.demosCompleted}
            subValue="Moved to PO/Won"
            current={thisWeekStats.demosCompleted}
            previous={lastWeekStats.demosCompleted}
            gradient="bg-gradient-to-br from-teal-500 to-teal-600"
            href="/pipeline"
          />
          <MetricCard
            icon={Target}
            label="Quotes Won"
            value={thisWeekStats.quotesWon}
            subValue={formatCurrency(thisWeekStats.quotesWonValue)}
            current={thisWeekStats.quotesWon}
            previous={lastWeekStats.quotesWon}
            gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
            href="/quotes?status=accepted"
          />
          <MetricCard
            icon={XCircle}
            label="Quotes Lost"
            value={thisWeekStats.quotesLost}
            current={thisWeekStats.quotesLost}
            previous={lastWeekStats.quotesLost}
            isGoodUp={false}
            gradient="bg-gradient-to-br from-red-500 to-red-600"
            href="/quotes?status=declined"
          />
          <MetricCard
            icon={Percent}
            label="Win Rate"
            value={`${thisWeekStats.winRate}%`}
            current={thisWeekStats.winRate}
            previous={lastWeekStats.winRate}
            gradient="bg-gradient-to-br from-violet-500 to-violet-600"
            href="/quotes"
          />
          <MetricCard
            icon={DollarSign}
            label="Revenue Booked"
            value={formatCurrency(thisWeekStats.revenue)}
            subValue={`${thisWeekStats.ordersCount} orders`}
            current={thisWeekStats.revenue}
            previous={lastWeekStats.revenue}
            gradient="bg-gradient-to-br from-amber-500 to-amber-600"
            href="/payments"
          />
        </div>
      </div>

      {/* ================================================================== */}
      {/* TWO COLUMN LAYOUT */}
      {/* ================================================================== */}
      <div className="grid lg:grid-cols-2 gap-6">
        
        {/* ================================================================ */}
        {/* PIPELINE MOVEMENT - ALL CLICKABLE */}
        {/* ================================================================ */}
        <div className="card">
          <SectionHeader 
            icon={TrendingUp} 
            title="Pipeline Movement" 
            href="/pipeline"
            action={
              <Link href="/pipeline" className="text-sm text-teal-600 font-medium hover:underline">
                View Pipeline →
              </Link>
            }
          />
          
          <div className="space-y-4">
            {/* Stats Grid - All Clickable */}
            <div className="grid grid-cols-2 gap-3">
              <ClickableCard href="/pipeline" className="bg-emerald-50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-emerald-600 mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs font-semibold">Moved Forward</span>
                </div>
                <div className="text-2xl font-bold text-emerald-700">{pipelineMovement.movedForward.length}</div>
              </ClickableCard>
              <ClickableCard href="/pipeline" className="bg-blue-50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-blue-600 mb-1">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-semibold">New Opportunities</span>
                </div>
                <div className="text-2xl font-bold text-blue-700">{pipelineMovement.newOpportunities.length}</div>
              </ClickableCard>
              <ClickableCard href="/pipeline" className="bg-amber-50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-amber-600 mb-1">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-xs font-semibold">Expected to Close</span>
                </div>
                <div className="text-2xl font-bold text-amber-700">{pipelineMovement.expectedToClose.length}</div>
              </ClickableCard>
              <ClickableCard href="/pipeline" className={`rounded-xl p-4 ${pipelineMovement.coldDeals.length > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
                <div className={`flex items-center gap-2 mb-1 ${pipelineMovement.coldDeals.length > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-xs font-semibold">Gone Cold</span>
                </div>
                <div className={`text-2xl font-bold ${pipelineMovement.coldDeals.length > 0 ? 'text-red-700' : 'text-slate-400'}`}>
                  {pipelineMovement.coldDeals.length}
                </div>
              </ClickableCard>
            </div>

            {/* Cold Deals List - All Clickable */}
            {pipelineMovement.coldDeals.length > 0 && (
              <div className="bg-red-50 rounded-xl p-4">
                <h4 
                  onClick={() => router.push('/pipeline')}
                  className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2 cursor-pointer hover:text-red-900"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Deals Needing Attention
                </h4>
                <div className="space-y-2">
                  {pipelineMovement.coldDeals.slice(0, 3).map(deal => (
                    <ClickableRow key={deal.id} href="/pipeline" className="flex items-center justify-between bg-white rounded-lg p-3">
                      <span className="font-medium text-slate-800">{deal.client_name || deal.title}</span>
                      <span className="text-xs text-red-600 font-semibold">
                        {daysBetween(new Date(deal.updated_at || deal.created_at), new Date())}d idle
                      </span>
                    </ClickableRow>
                  ))}
                  {pipelineMovement.coldDeals.length > 3 && (
                    <Link href="/pipeline" className="text-xs text-red-700 font-semibold hover:underline">
                      +{pipelineMovement.coldDeals.length - 3} more
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Empty State */}
            {pipelineMovement.movedForward.length === 0 && pipelineMovement.newOpportunities.length === 0 && pipelineMovement.coldDeals.length === 0 && (
              <EmptyState 
                icon={TrendingUp}
                message="No pipeline movement this week"
                actionText="View pipeline"
                href="/pipeline"
              />
            )}
          </div>
        </div>

        {/* ================================================================ */}
        {/* DEMOS THIS WEEK - ALL CLICKABLE */}
        {/* ================================================================ */}
        <div className="card">
          <SectionHeader 
            icon={Presentation} 
            title="Demos This Week" 
            href="/pipeline"
            action={
              <Link href="/pipeline" className="text-sm text-teal-600 font-medium hover:underline">
                View Pipeline →
              </Link>
            }
          />
          
          <div className="space-y-4">
            {/* Demo Stats - All Clickable */}
            <div className="grid grid-cols-2 gap-3">
              <ClickableCard href="/pipeline" className="bg-cyan-50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-cyan-600 mb-1">
                  <Play className="w-4 h-4" />
                  <span className="text-xs font-semibold">Active Demos</span>
                </div>
                <div className="text-2xl font-bold text-cyan-700">{demosThisWeek.totalActive}</div>
              </ClickableCard>
              <ClickableCard href="/pipeline" className="bg-teal-50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-teal-600 mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-xs font-semibold">Completed</span>
                </div>
                <div className="text-2xl font-bold text-teal-700">{demosThisWeek.totalCompleted}</div>
              </ClickableCard>
            </div>

            {/* Demo Outcomes - Clickable */}
            {demosThisWeek.totalCompleted > 0 && (
              <div className="flex gap-2 text-xs">
                {demosThisWeek.poReceivedCount > 0 && (
                  <span 
                    onClick={() => router.push('/pipeline')}
                    className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold cursor-pointer hover:bg-blue-200 transition-colors"
                  >
                    {demosThisWeek.poReceivedCount} → PO Received
                  </span>
                )}
                {demosThisWeek.wonCount > 0 && (
                  <span 
                    onClick={() => router.push('/pipeline')}
                    className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-semibold cursor-pointer hover:bg-emerald-200 transition-colors"
                  >
                    {demosThisWeek.wonCount} → Won! 🎉
                  </span>
                )}
              </div>
            )}

            {/* Demo List - All Clickable */}
            {demosThisWeek.allDemos.length === 0 ? (
              <EmptyState 
                icon={Presentation}
                message="No demos this week"
                actionText="Add a demo"
                href="/pipeline"
              />
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {demosThisWeek.allDemos.map(deal => (
                  <ClickableRow 
                    key={deal.id} 
                    href="/pipeline"
                    className={`flex items-center justify-between p-3 rounded-xl ${
                      deal.demoStatus === 'won' ? 'bg-emerald-50 border border-emerald-200' :
                      deal.demoStatus === 'completed' ? 'bg-blue-50 border border-blue-200' :
                      'bg-slate-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-800 truncate">
                        {deal.client_name || deal.title}
                      </div>
                      {deal.value && (
                        <div className="text-xs text-slate-500">{formatCurrency(deal.value)}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {deal.demoStatus === 'won' && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-semibold flex items-center gap-1">
                          Won! 🎉
                        </span>
                      )}
                      {deal.demoStatus === 'completed' && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> PO Received
                        </span>
                      )}
                      {deal.demoStatus === 'active' && (
                        <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-1 rounded-full font-semibold flex items-center gap-1">
                          <Play className="w-3 h-3" /> In Progress
                        </span>
                      )}
                    </div>
                  </ClickableRow>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* QUOTE ACTIVITY - Full Width, ALL CLICKABLE */}
      {/* ================================================================== */}
      <div className="card">
        <SectionHeader 
          icon={FileText} 
          title="Quote Activity" 
          href="/quotes"
          action={
            <Link href="/quotes" className="text-sm text-teal-600 font-medium hover:underline">
              View Quotes →
            </Link>
          }
        />

        {quoteActivity.allSent.length === 0 ? (
          <EmptyState 
            icon={FileText}
            message="No quotes sent this week"
            actionText="Create one"
            href="/quotes"
          />
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {quoteActivity.allSent.map(quote => {
              const needsFollowUp = (quote.status === 'sent' || quote.status === 'Sent') && quote.daysSinceSent > 3
              return (
                <ClickableRow 
                  key={quote.id} 
                  href="/quotes"
                  className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                    needsFollowUp ? 'bg-amber-50 border border-amber-200 hover:bg-amber-100' : 'bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-slate-500">{quote.quote_number}</span>
                      <StatusBadge status={quote.status} />
                      {needsFollowUp && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Follow up
                        </span>
                      )}
                    </div>
                    <div className="font-medium text-slate-800 truncate">{quote.client_name}</div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="font-semibold text-slate-800">{formatCurrency(quote.value)}</div>
                    <div className="text-xs text-slate-500">{quote.daysSinceSent}d ago</div>
                  </div>
                </ClickableRow>
              )
            })}
          </div>
        )}

        {/* Follow-up Alert - Clickable */}
        {quoteActivity.needFollowUp.length > 0 && (
          <ClickableCard href="/quotes" className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-amber-700 font-semibold mb-2">
              <AlertTriangle className="w-4 h-4" />
              {quoteActivity.needFollowUp.length} quote{quoteActivity.needFollowUp.length !== 1 ? 's' : ''} need follow-up
            </div>
            <p className="text-xs text-amber-600">Sent more than 3 days ago with no response</p>
          </ClickableCard>
        )}
      </div>

      {/* ================================================================== */}
      {/* ORDERS & SHIPMENTS - ALL CLICKABLE */}
      {/* ================================================================== */}
      <div className="card">
        <SectionHeader 
          icon={Package} 
          title="Orders & Shipments" 
          href="/orders"
          action={
            <Link href="/orders" className="text-sm text-teal-600 font-medium hover:underline">
              View Orders →
            </Link>
          }
        />
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* New Orders */}
          <div>
            <h4 
              onClick={() => router.push('/orders')}
              className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2 cursor-pointer hover:text-teal-600 transition-colors"
            >
              <ShoppingCart className="w-4 h-4 text-slate-400" />
              Orders Placed ({ordersAndShipments.newOrders.length})
            </h4>
            {ordersAndShipments.newOrders.length === 0 ? (
              <EmptyState 
                icon={Package}
                message="No orders this week"
                actionText="View all orders"
                href="/orders"
              />
            ) : (
              <div className="space-y-2">
                {ordersAndShipments.newOrders.slice(0, 5).map(order => (
                  <ClickableRow key={order.id} href="/orders" className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div>
                      <span className="font-mono text-sm text-slate-600">{order.order_number}</span>
                      <div className="font-medium text-slate-800">{order.client_name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-slate-800">{formatCurrency(order.value_zar)}</div>
                      <span className="text-xs text-slate-500">{order.shipment_status || 'pending'}</span>
                    </div>
                  </ClickableRow>
                ))}
              </div>
            )}
          </div>

          {/* Shipment Updates */}
          <div>
            <h4 
              onClick={() => router.push('/orders')}
              className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2 cursor-pointer hover:text-teal-600 transition-colors"
            >
              <Truck className="w-4 h-4 text-slate-400" />
              Shipment Updates ({ordersAndShipments.shipmentUpdates.length})
            </h4>
            {ordersAndShipments.shipmentUpdates.length === 0 ? (
              <EmptyState 
                icon={Truck}
                message="No shipment updates"
                actionText="View all orders"
                href="/orders"
              />
            ) : (
              <div className="space-y-2">
                {ordersAndShipments.shipmentUpdates.slice(0, 5).map(order => (
                  <ClickableRow key={order.id} href="/orders" className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div>
                      <span className="font-mono text-sm text-slate-600">{order.order_number}</span>
                      <div className="font-medium text-slate-800">{order.client_name}</div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      order.shipment_status === 'delivered' ? 'bg-green-100 text-green-700' :
                      order.shipment_status === 'shipped' || order.shipment_status === 'in_transit' ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {order.shipment_status}
                    </span>
                  </ClickableRow>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* ACTION ITEMS - ALL CLICKABLE */}
      {/* ================================================================== */}
      <div className="card border-2 border-amber-200 bg-amber-50/50">
        <SectionHeader icon={AlertTriangle} title="This Week's Action Items" />
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Quotes Needing Follow-up - Clickable */}
          <ClickableCard href="/quotes" className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-amber-700 mb-3">
              <Clock className="w-4 h-4" />
              <span className="font-semibold text-sm">Quote Follow-ups</span>
            </div>
            <div className="text-3xl font-bold text-amber-700 mb-2">{actionItems.quotesNeedFollowUp.length}</div>
            {actionItems.quotesNeedFollowUp.length > 0 && (
              <div className="space-y-1">
                {actionItems.quotesNeedFollowUp.slice(0, 2).map(q => (
                  <div key={q.id} className="text-xs text-slate-600 truncate">• {q.client_name}</div>
                ))}
                {actionItems.quotesNeedFollowUp.length > 2 && (
                  <div className="text-xs text-amber-600 font-medium">+{actionItems.quotesNeedFollowUp.length - 2} more</div>
                )}
              </div>
            )}
          </ClickableCard>

          {/* Stale Deals - Clickable */}
          <ClickableCard href="/pipeline" className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-red-700 mb-3">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-semibold text-sm">Stale Deals</span>
            </div>
            <div className={`text-3xl font-bold mb-2 ${actionItems.staleDeals.length > 0 ? 'text-red-700' : 'text-slate-400'}`}>
              {actionItems.staleDeals.length}
            </div>
            {actionItems.staleDeals.length > 0 && (
              <div className="space-y-1">
                {actionItems.staleDeals.slice(0, 2).map(d => (
                  <div key={d.id} className="text-xs text-slate-600 truncate">• {d.client_name || d.title}</div>
                ))}
                {actionItems.staleDeals.length > 2 && (
                  <div className="text-xs text-red-600 font-medium">+{actionItems.staleDeals.length - 2} more</div>
                )}
              </div>
            )}
          </ClickableCard>

          {/* Deals to Close - Clickable */}
          <ClickableCard href="/pipeline" className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-700 mb-3">
              <Target className="w-4 h-4" />
              <span className="font-semibold text-sm">Ready to Close</span>
            </div>
            <div className="text-3xl font-bold text-emerald-700 mb-2">{actionItems.dealsToClose.length}</div>
            {actionItems.dealsToClose.length > 0 && (
              <div className="space-y-1">
                {actionItems.dealsToClose.slice(0, 2).map(d => (
                  <div key={d.id} className="text-xs text-slate-600 truncate">
                    • {d.client_name} ({formatCurrency(d.value)})
                  </div>
                ))}
                {actionItems.dealsToClose.length > 2 && (
                  <div className="text-xs text-emerald-600 font-medium">+{actionItems.dealsToClose.length - 2} more</div>
                )}
              </div>
            )}
          </ClickableCard>

          {/* Overdue Tasks - Clickable */}
          <ClickableCard href="/tasks" className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-700 mb-3">
              <CheckCircle className="w-4 h-4" />
              <span className="font-semibold text-sm">Overdue Tasks</span>
            </div>
            <div className={`text-3xl font-bold mb-2 ${actionItems.overdueTasks.length > 0 ? 'text-slate-700' : 'text-slate-400'}`}>
              {actionItems.overdueTasks.length}
            </div>
            {actionItems.overdueTasks.length > 0 && (
              <div className="space-y-1">
                {actionItems.overdueTasks.slice(0, 2).map(t => (
                  <div key={t.id} className="text-xs text-slate-600 truncate flex items-center gap-1">
                    <PriorityBadge priority={t.priority} />
                    <span className="truncate">{t.title}</span>
                  </div>
                ))}
                {actionItems.overdueTasks.length > 2 && (
                  <div className="text-xs text-slate-600 font-medium">+{actionItems.overdueTasks.length - 2} more</div>
                )}
              </div>
            )}
          </ClickableCard>
        </div>
      </div>

      {/* ================================================================== */}
      {/* TOP PRODUCTS & NOTES - ALL CLICKABLE */}
      {/* ================================================================== */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Products - All Clickable */}
        <div className="card">
          <SectionHeader icon={Package} title="Top Products This Week" href="/pricelist" />
          
          {topProducts.length === 0 ? (
            <EmptyState 
              icon={Package}
              message="No products quoted this week"
              actionText="View pricelist"
              href="/pricelist"
            />
          ) : (
            <div className="space-y-3">
              {topProducts.map((product, index) => (
                <ClickableRow key={product.name} href="/pricelist" className="flex items-center gap-4 p-2 rounded-lg">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                    index === 0 ? 'bg-amber-100 text-amber-700' :
                    index === 1 ? 'bg-slate-200 text-slate-600' :
                    index === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 truncate">{product.name}</div>
                    <div className="text-xs text-slate-500">
                      Quoted: {product.quoted} units • Sold: {product.sold} units
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-teal-500 rounded-full"
                        style={{ width: `${(product.sold / Math.max(product.quoted, 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 w-12 text-right">
                      {Math.round((product.sold / Math.max(product.quoted, 1)) * 100)}%
                    </span>
                  </div>
                </ClickableRow>
              ))}
            </div>
          )}
        </div>

        {/* Meeting Notes - Keep as is (text input) */}
        <div className="card">
          <SectionHeader 
            icon={FileText} 
            title="Meeting Notes" 
            action={
              <button
                onClick={saveMeetingNotes}
                disabled={savingNotes}
                className="flex items-center gap-1 text-sm text-teal-600 font-medium hover:text-teal-700 disabled:opacity-50"
              >
                {savingNotes ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {savingNotes ? 'Saving...' : 'Save'}
              </button>
            }
          />
          
          <textarea
            value={meetingNotes}
            onChange={(e) => setMeetingNotes(e.target.value)}
            onBlur={saveMeetingNotes}
            placeholder="Capture meeting notes here...

• Key discussion points
• Decisions made
• Action items assigned
• Follow-up dates"
            className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
          />
          <p className="text-xs text-slate-400 mt-2">Notes are saved to your browser automatically</p>
        </div>
      </div>

      {/* ================================================================== */}
      {/* PRINT FOOTER */}
      {/* ================================================================== */}
      <div className="hidden print:block text-center text-xs text-slate-400 border-t border-slate-200 pt-4 mt-8">
        <p>Landwell Africa Weekly Sales Review • {formatDateRange(weekStart, weekEnd)}</p>
        <p>Generated {new Date().toLocaleDateString('en-ZA', { dateStyle: 'full' })}</p>
      </div>
    </div>
  )
}
