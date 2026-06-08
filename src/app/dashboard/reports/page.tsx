'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Quote, Order, PipelineDeal, Client } from '@/lib/types'
import { BarChart2, TrendingUp, Users, MapPin, Package, ArrowRight } from 'lucide-react'

function formatCurrency(val: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(val || 0)
}

// Simple CSS bar chart component
function BarChart({ data, maxValue }: { data: { label: string; value: number; color?: string }[]; maxValue?: number }) {
  const max = maxValue || Math.max(...data.map(d => d.value), 1)
  
  return (
    <div className="space-y-3">
      {data.map((item, index) => (
        <div key={index} className="flex items-center gap-3">
          <div className="w-24 text-sm text-slate-600 truncate text-right">{item.label}</div>
          <div className="flex-1 h-8 bg-slate-100 rounded-lg overflow-hidden relative">
            <div 
              className={`h-full rounded-lg transition-all duration-500 ${item.color || 'bg-teal-500'}`}
              style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-700">
              {formatCurrency(item.value)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// Monthly trend chart
function MonthlyTrendChart({ data }: { data: { month: string; value: number }[] }) {
  const maxValue = Math.max(...data.map(d => d.value), 1)
  
  return (
    <div className="flex items-end justify-between gap-2 h-48 pt-4">
      {data.map((item, index) => {
        const height = (item.value / maxValue) * 100
        return (
          <div key={index} className="flex-1 flex flex-col items-center gap-2">
            <div className="text-xs font-medium text-slate-700 h-8">
              {item.value > 0 && formatCurrency(item.value)}
            </div>
            <div className="w-full flex-1 bg-slate-100 rounded-t-lg relative overflow-hidden">
              <div 
                className="absolute bottom-0 w-full bg-gradient-to-t from-teal-600 to-teal-400 rounded-t-lg transition-all duration-500"
                style={{ height: `${Math.max(height, 2)}%` }}
              />
            </div>
            <div className="text-xs text-slate-500 font-medium">{item.month}</div>
          </div>
        )
      })}
    </div>
  )
}

// Funnel chart
function FunnelChart({ data }: { data: { label: string; count: number; value: number; color: string }[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1)
  
  return (
    <div className="space-y-2">
      {data.map((stage, index) => {
        const widthPercent = Math.max((stage.count / maxCount) * 100, 20)
        const dropoff = index > 0 ? Math.round((1 - stage.count / data[index - 1].count) * 100) : null
        
        return (
          <div key={index} className="flex items-center gap-3">
            <div className="w-28 text-sm text-slate-600 text-right truncate">{stage.label}</div>
            <div className="flex-1 relative">
              <div 
                className={`h-10 ${stage.color} rounded-lg flex items-center justify-end px-3 transition-all duration-500`}
                style={{ width: `${widthPercent}%` }}
              >
                <span className="text-sm font-bold text-white">
                  {stage.count}
                </span>
              </div>
            </div>
            <div className="w-20 text-sm text-slate-500 text-right">
              {formatCurrency(stage.value)}
            </div>
            {dropoff !== null && dropoff > 0 && (
              <div className="w-16 text-xs text-red-500 font-medium">
                -{dropoff}%
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const REGIONS = ['Gauteng', 'Rustenburg', 'Northern Cape', 'KZN', 'Cape Town', 'Other']
const CLIENT_TYPES = ['End User', 'Reseller']

export default function ReportsPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [pipeline, setPipeline] = useState<PipelineDeal[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  const fetchAll = useCallback(async () => {
    const [quotesRes, ordersRes, pipelineRes, clientsRes] = await Promise.all([
      supabase.from('quotes').select('*'),
      supabase.from('orders').select('*'),
      supabase.from('pipeline').select('*'),
      supabase.from('clients').select('*'),
    ])
    
    setQuotes(quotesRes.data || [])
    setOrders(ordersRes.data || [])
    setPipeline(pipelineRes.data || [])
    setClients(clientsRes.data || [])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Sales by product (from quote line items)
  const salesByProduct = useMemo(() => {
    const productMap = new Map<string, { quoted: number; sold: number }>()
    
    quotes.forEach(quote => {
      const isSold = quote.status === 'accepted' || quote.status === 'Accepted'
      quote.line_items?.forEach(item => {
        const product = item.product || 'Unknown'
        const existing = productMap.get(product) || { quoted: 0, sold: 0 }
        const lineValue = (item.qty || 0) * (item.unitPrice || 0)
        existing.quoted += lineValue
        if (isSold) existing.sold += lineValue
        productMap.set(product, existing)
      })
    })

    // Sort by total quoted value and take top 10
    return Array.from(productMap.entries())
      .map(([product, data]) => ({ product, ...data }))
      .sort((a, b) => b.quoted - a.quoted)
      .slice(0, 10)
  }, [quotes])

  // Sales by region
  const salesByRegion = useMemo(() => {
    const regionMap = new Map<string, number>()
    REGIONS.forEach(r => regionMap.set(r, 0))
    
    orders.forEach(order => {
      // Find the quote for this order to get region
      const quote = quotes.find(q => q.id === order.quote_id)
      const region = quote?.region || 'Other'
      const current = regionMap.get(region) || 0
      regionMap.set(region, current + (order.value_zar || 0))
    })

    return Array.from(regionMap.entries())
      .map(([region, value]) => ({ region, value }))
      .filter(r => r.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [orders, quotes])

  // Sales by client type
  const salesByClientType = useMemo(() => {
    const typeMap = new Map<string, { quoted: number; orders: number; clients: number }>()
    CLIENT_TYPES.forEach(t => typeMap.set(t, { quoted: 0, orders: 0, clients: 0 }))

    // Count unique clients by type
    const clientsByType = new Map<string, Set<string>>()
    CLIENT_TYPES.forEach(t => clientsByType.set(t, new Set()))

    quotes.forEach(quote => {
      const type = quote.client_type === 'reseller' || quote.client_type === 'Reseller' ? 'Reseller' : 'End User'
      const existing = typeMap.get(type)!
      
      // Calculate quote total
      const total = quote.line_items?.reduce((sum, item) => 
        sum + (item.qty || 0) * (item.unitPrice || 0), 0) || 0
      
      existing.quoted += total
      
      if (quote.client_name) {
        clientsByType.get(type)!.add(quote.client_name)
      }
    })

    orders.forEach(order => {
      const quote = quotes.find(q => q.id === order.quote_id)
      const type = quote?.client_type === 'reseller' || quote?.client_type === 'Reseller' ? 'Reseller' : 'End User'
      const existing = typeMap.get(type)!
      existing.orders += order.value_zar || 0
    })

    CLIENT_TYPES.forEach(type => {
      const existing = typeMap.get(type)!
      existing.clients = clientsByType.get(type)!.size
    })

    return Array.from(typeMap.entries())
      .map(([type, data]) => ({ type, ...data }))
  }, [quotes, orders])

  // Monthly revenue trend (last 6 months)
  const monthlyTrend = useMemo(() => {
    const months: { month: string; value: number }[] = []
    const now = new Date()
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthKey = date.toLocaleString('default', { month: 'short' })
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)
      
      const monthOrders = orders.filter(order => {
        const orderDate = new Date(order.created_at)
        return orderDate >= monthStart && orderDate <= monthEnd
      })
      
      const total = monthOrders.reduce((sum, o) => sum + (o.value_zar || 0), 0)
      months.push({ month: monthKey, value: total })
    }
    
    return months
  }, [orders])

  // Conversion funnel
  const conversionFunnel = useMemo(() => {
    const stages = [
      { key: 'lead_generated', label: 'New Lead', color: 'bg-slate-500' },
      { key: 'qualification', label: 'Qualified', color: 'bg-blue-500' },
      { key: 'proposal_sent', label: 'Proposal', color: 'bg-indigo-500' },
      { key: 'po_received', label: 'PO Received', color: 'bg-amber-500' },
      { key: 'closed_won', label: 'Won', color: 'bg-emerald-500' },
    ]

    // Count all deals that reached each stage (cumulative)
    // For simplicity, use current status as the furthest stage reached
    const stageCounts = stages.map(stage => {
      const stageIndex = stages.findIndex(s => s.key === stage.key)
      const deals = pipeline.filter(deal => {
        const dealIndex = stages.findIndex(s => s.key === deal.status)
        return dealIndex >= stageIndex || deal.status === 'closed_lost'
      })
      
      const stageDeals = pipeline.filter(d => d.status === stage.key)
      const value = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0)
      
      return {
        label: stage.label,
        count: deals.length,
        value,
        color: stage.color,
      }
    })

    return stageCounts
  }, [pipeline])

  // Summary stats
  const summary = useMemo(() => {
    const totalQuoted = quotes.reduce((sum, q) => {
      const total = q.line_items?.reduce((s, item) => 
        s + (item.qty || 0) * (item.unitPrice || 0), 0) || 0
      return sum + total
    }, 0)

    const totalOrders = orders.reduce((sum, o) => sum + (o.value_zar || 0), 0)
    
    const acceptedQuotes = quotes.filter(q => 
      q.status === 'accepted' || q.status === 'Accepted'
    ).length
    
    const totalQuotes = quotes.length
    const winRate = totalQuotes > 0 ? Math.round((acceptedQuotes / totalQuotes) * 100) : 0

    const pipelineValue = pipeline
      .filter(p => p.status !== 'closed_won' && p.status !== 'closed_lost')
      .reduce((sum, p) => sum + (p.value || 0), 0)

    return { totalQuoted, totalOrders, winRate, pipelineValue, clientCount: clients.length }
  }, [quotes, orders, pipeline, clients])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card-kpi gradient-blue">
          <div className="text-white/80 text-sm mb-1">Total Quoted</div>
          <div className="text-2xl font-bold">{formatCurrency(summary.totalQuoted)}</div>
        </div>
        <div className="card-kpi gradient-emerald">
          <div className="text-white/80 text-sm mb-1">Total Orders</div>
          <div className="text-2xl font-bold">{formatCurrency(summary.totalOrders)}</div>
        </div>
        <div className="card-kpi gradient-violet">
          <div className="text-white/80 text-sm mb-1">Win Rate</div>
          <div className="text-2xl font-bold">{summary.winRate}%</div>
        </div>
        <div className="card-kpi gradient-amber">
          <div className="text-white/80 text-sm mb-1">Pipeline Value</div>
          <div className="text-2xl font-bold">{formatCurrency(summary.pipelineValue)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="text-slate-500 text-sm mb-1">Total Clients</div>
          <div className="text-2xl font-bold text-slate-900">{summary.clientCount}</div>
        </div>
      </div>

      {/* Monthly Revenue Trend */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-bold text-slate-900">Monthly Revenue Trend</h2>
        </div>
        <MonthlyTrendChart data={monthlyTrend} />
      </div>

      {/* Two column layout */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Sales by Product */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-bold text-slate-900">Top Products</h2>
          </div>
          {salesByProduct.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No product data</p>
          ) : (
            <BarChart 
              data={salesByProduct.map(p => ({ 
                label: p.product.length > 20 ? p.product.slice(0, 20) + '...' : p.product,
                value: p.quoted,
                color: 'bg-teal-500'
              }))} 
            />
          )}
        </div>

        {/* Sales by Region */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-bold text-slate-900">Sales by Region</h2>
          </div>
          {salesByRegion.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No regional data</p>
          ) : (
            <BarChart 
              data={salesByRegion.map((r, i) => ({ 
                label: r.region,
                value: r.value,
                color: ['bg-teal-500', 'bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-amber-500', 'bg-slate-500'][i % 6]
              }))} 
            />
          )}
        </div>
      </div>

      {/* Sales by Client Type */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-bold text-slate-900">Performance by Client Type</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {salesByClientType.map(item => (
            <div key={item.type} className="bg-slate-50 rounded-xl p-5">
              <h3 className="font-bold text-slate-900 text-lg mb-4">{item.type}</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-slate-500">Clients</div>
                  <div className="text-2xl font-bold text-slate-900">{item.clients}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">Quoted</div>
                  <div className="text-xl font-bold text-blue-600">{formatCurrency(item.quoted)}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">Orders</div>
                  <div className="text-xl font-bold text-emerald-600">{formatCurrency(item.orders)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-bold text-slate-900">Conversion Funnel</h2>
        </div>
        <div className="mb-4">
          <p className="text-sm text-slate-500">
            Pipeline progression from lead to won. Drop-off % shows deals lost at each stage.
          </p>
        </div>
        <FunnelChart data={conversionFunnel} />
        
        {/* Funnel insights */}
        <div className="mt-6 pt-6 border-t border-slate-200">
          <h3 className="font-semibold text-slate-700 mb-3">Insights</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="text-blue-600 font-medium mb-1">Lead → Qualified</div>
              <div className="text-slate-600">
                {conversionFunnel.length >= 2 && conversionFunnel[0].count > 0
                  ? `${Math.round((conversionFunnel[1].count / conversionFunnel[0].count) * 100)}% conversion`
                  : 'No data'}
              </div>
            </div>
            <div className="bg-indigo-50 rounded-xl p-4">
              <div className="text-indigo-600 font-medium mb-1">Qualified → Proposal</div>
              <div className="text-slate-600">
                {conversionFunnel.length >= 3 && conversionFunnel[1].count > 0
                  ? `${Math.round((conversionFunnel[2].count / conversionFunnel[1].count) * 100)}% conversion`
                  : 'No data'}
              </div>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4">
              <div className="text-emerald-600 font-medium mb-1">Proposal → Won</div>
              <div className="text-slate-600">
                {conversionFunnel.length >= 4 && conversionFunnel[2].count > 0
                  ? `${Math.round((conversionFunnel[4].count / conversionFunnel[2].count) * 100)}% close rate`
                  : 'No data'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <a href="/quotes" className="btn-secondary">
          View Quotes <ArrowRight className="w-4 h-4" />
        </a>
        <a href="/pipeline" className="btn-secondary">
          View Pipeline <ArrowRight className="w-4 h-4" />
        </a>
        <a href="/orders" className="btn-secondary">
          View Orders <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  )
}
