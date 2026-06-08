'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { Ticket } from '@/lib/types'
type ClientOption = { id: string; name: string }
import { TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG, TICKET_ISSUE_TYPE_CONFIG } from '@/lib/types'
import {
  Headset,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowUpDown,
  ChevronRight,
} from 'lucide-react'

const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return '1d ago'
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(dateStr)
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'date' | 'priority'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const [ticketsRes, clientsRes] = await Promise.all([
        supabase.from('tickets').select('*').order('created_at', { ascending: false }),
        supabase.from('clients').select('id, name').order('name'),
      ])

      const ticketData = ticketsRes.data || []
      const clientData = clientsRes.data || []

      // Enrich tickets with client names
      const clientMap = new Map(clientData.map(c => [c.id, c.name]))
      const enriched = ticketData.map(t => ({
        ...t,
        client_name: t.client_id ? clientMap.get(t.client_id) || 'Unknown' : undefined,
      }))

      setTickets(enriched)
      setClients(clientData)
      setLoading(false)
    }
    fetchData()
  }, [])

  const stats = useMemo(() => {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    return {
      open: tickets.filter(t => t.status === 'open').length,
      inProgress: tickets.filter(t => t.status === 'in_progress' || t.status === 'awaiting_parts').length,
      resolvedThisWeek: tickets.filter(t =>
        (t.status === 'resolved' || t.status === 'closed') &&
        t.resolved_at && new Date(t.resolved_at) >= weekAgo
      ).length,
      critical: tickets.filter(t => (t.priority === 'critical' || t.priority === 'high') && t.status !== 'resolved' && t.status !== 'closed').length,
    }
  }, [tickets])

  const filteredTickets = useMemo(() => {
    let result = tickets

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(t =>
        t.subject.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.client_name?.toLowerCase().includes(q) ||
        t.device_serial?.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== 'all') {
      result = result.filter(t => t.status === statusFilter)
    }

    if (priorityFilter !== 'all') {
      result = result.filter(t => t.priority === priorityFilter)
    }

    if (clientFilter !== 'all') {
      result = result.filter(t => t.client_id === clientFilter)
    }

    result = [...result].sort((a, b) => {
      if (sortBy === 'priority') {
        const diff = (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
        return sortDir === 'asc' ? diff : -diff
      }
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
      return sortDir === 'desc' ? dateB - dateA : dateA - dateB
    })

    return result
  }, [tickets, search, statusFilter, priorityFilter, clientFilter, sortBy, sortDir])

  const toggleSort = (field: 'date' | 'priority') => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('desc')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-16 skeleton rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 skeleton rounded-xl" />)}
        </div>
        <div className="h-64 skeleton rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in pb-24 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Headset className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Support Tickets</h1>
            <p className="text-sm text-slate-500">{tickets.length} total tickets</p>
          </div>
        </div>
        <Link
          href="/tickets/new"
          className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-teal-700 transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Ticket
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-yellow-600 text-sm mb-1">
            <AlertTriangle className="w-4 h-4" />
            Open
          </div>
          <div className="text-2xl font-bold text-yellow-700">{stats.open}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-blue-600 text-sm mb-1">
            <Clock className="w-4 h-4" />
            In Progress
          </div>
          <div className="text-2xl font-bold text-blue-700">{stats.inProgress}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-emerald-600 text-sm mb-1">
            <CheckCircle2 className="w-4 h-4" />
            Resolved This Week
          </div>
          <div className="text-2xl font-bold text-emerald-700">{stats.resolvedThisWeek}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-600 text-sm mb-1">
            <AlertTriangle className="w-4 h-4" />
            Critical/High
          </div>
          <div className="text-2xl font-bold text-red-700">{stats.critical}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tickets..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-slate-400" />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">All Status</option>
              {Object.entries(TICKET_STATUS_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">All Priority</option>
              {Object.entries(TICKET_PRIORITY_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
            <select
              value={clientFilter}
              onChange={e => setClientFilter(e.target.value)}
              className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">All Clients</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="flex gap-2 mt-3 border-t border-slate-100 pt-3">
          <button
            onClick={() => toggleSort('date')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              sortBy === 'date' ? 'bg-teal-100 text-teal-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ArrowUpDown className="w-3 h-3" />
            Date {sortBy === 'date' && (sortDir === 'desc' ? '(Newest)' : '(Oldest)')}
          </button>
          <button
            onClick={() => toggleSort('priority')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              sortBy === 'priority' ? 'bg-teal-100 text-teal-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ArrowUpDown className="w-3 h-3" />
            Priority {sortBy === 'priority' && (sortDir === 'desc' ? '(Highest)' : '(Lowest)')}
          </button>
        </div>
      </div>

      {/* Tickets List */}
      {filteredTickets.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Headset className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-lg font-medium text-slate-500">No tickets found</p>
          <p className="text-sm text-slate-400 mt-1">
            {tickets.length === 0 ? 'Create your first support ticket' : 'Try adjusting your filters'}
          </p>
          {tickets.length === 0 && (
            <Link
              href="/tickets/new"
              className="inline-flex items-center gap-2 mt-4 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition"
            >
              <Plus className="w-4 h-4" />
              New Ticket
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map(ticket => {
            const statusCfg = TICKET_STATUS_CONFIG[ticket.status as keyof typeof TICKET_STATUS_CONFIG] || TICKET_STATUS_CONFIG.open
            const priorityCfg = TICKET_PRIORITY_CONFIG[ticket.priority as keyof typeof TICKET_PRIORITY_CONFIG] || TICKET_PRIORITY_CONFIG.medium
            const issueTypeCfg = TICKET_ISSUE_TYPE_CONFIG[ticket.issue_type as keyof typeof TICKET_ISSUE_TYPE_CONFIG]

            return (
              <Link
                key={ticket.id}
                href={`/tickets/${ticket.id}`}
                className="block bg-white rounded-xl border border-slate-200 p-4 hover:border-teal-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-start gap-4">
                  {/* Priority indicator */}
                  <div className={`w-2 h-full min-h-[48px] rounded-full flex-shrink-0 ${
                    ticket.priority === 'critical' ? 'bg-red-500' :
                    ticket.priority === 'high' ? 'bg-orange-500' :
                    ticket.priority === 'medium' ? 'bg-blue-400' :
                    'bg-slate-300'
                  }`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900 group-hover:text-teal-700 transition truncate">
                          {ticket.subject}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {ticket.client_name && (
                            <span className="text-sm text-slate-600">{ticket.client_name}</span>
                          )}
                          {ticket.device_serial && (
                            <span className="text-xs text-slate-400 font-mono">SN: {ticket.device_serial}</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-teal-500 transition flex-shrink-0 mt-1" />
                    </div>

                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}>
                        {statusCfg.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityCfg.bg} ${priorityCfg.text}`}>
                        {priorityCfg.label}
                      </span>
                      {issueTypeCfg && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          {issueTypeCfg.label}
                        </span>
                      )}
                      <span className="text-xs text-slate-400 ml-auto">
                        {formatRelativeTime(ticket.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
