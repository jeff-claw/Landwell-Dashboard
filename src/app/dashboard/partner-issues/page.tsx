'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { toast } from 'sonner'
import type { PartnerIssue, PartnerLink } from '@/lib/types'
import {
  PARTNER_ISSUE_STATUS_CONFIG,
  PARTNER_ISSUE_PRIORITY_CONFIG,
  PARTNER_ISSUE_CATEGORIES,
  isPartnerIssueOverdue,
  partnerIssueDaysOpen,
} from '@/lib/types'
import {
  Globe2,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronRight,
  Download,
  Link2,
  Copy,
  Eye,
  EyeOff,
  TimerReset,
} from 'lucide-react'

type ClientOption = { id: string; name: string }

const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function PartnerIssuesPage() {
  const [issues, setIssues] = useState<PartnerIssue[]>([])
  const [links, setLinks] = useState<PartnerLink[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [showLinks, setShowLinks] = useState(false)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [issuesRes, clientsRes, linksRes] = await Promise.all([
      supabase.from('partner_issues').select('*').order('ref', { ascending: true }),
      supabase.from('clients').select('id, name'),
      supabase.from('partner_links').select('*').order('created_at', { ascending: false }),
    ])

    const clientMap = new Map((clientsRes.data || []).map((c: ClientOption) => [c.id, c.name]))
    setIssues(
      (issuesRes.data || []).map((i: PartnerIssue) => ({
        ...i,
        client_name: i.client_id ? clientMap.get(i.client_id) || undefined : undefined,
      }))
    )
    setLinks(linksRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const stats = useMemo(() => {
    const live = issues.filter(i => i.status !== 'verified_closed')
    return {
      open: live.length,
      critical: live.filter(i => i.priority === 'critical' || i.priority === 'high').length,
      overdue: issues.filter(isPartnerIssueOverdue).length,
      closed: issues.filter(i => i.status === 'verified_closed').length,
      // Cost of the open items — the number that carries the hardware argument.
      downtime: live.reduce((sum, i) => sum + Number(i.downtime_hours || 0), 0),
      cost: live.reduce((sum, i) => sum + Number(i.cost_zar || 0), 0),
    }
  }, [issues])

  const filtered = useMemo(() => {
    let result = issues

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        i =>
          i.ref?.toLowerCase().includes(q) ||
          i.description_en?.toLowerCase().includes(q) ||
          i.description_cn?.includes(search) ||
          i.site?.toLowerCase().includes(q) ||
          i.client_name?.toLowerCase().includes(q) ||
          i.product_module?.toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'all') result = result.filter(i => i.status === statusFilter)
    if (priorityFilter !== 'all') result = result.filter(i => i.priority === priorityFilter)
    if (categoryFilter !== 'all') result = result.filter(i => i.category === categoryFilter)
    if (overdueOnly) result = result.filter(isPartnerIssueOverdue)

    return [...result].sort((a, b) => {
      const p = (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
      if (p !== 0) return p
      return (a.ref || '').localeCompare(b.ref || '')
    })
  }, [issues, search, statusFilter, priorityFilter, categoryFilter, overdueOnly])

  const createLink = async () => {
    const supabase = createClient()
    const token = crypto.randomUUID().replace(/-/g, '')
    const { error } = await supabase.from('partner_links').insert({ token, label: 'LANDWELL Beijing' })
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Partner link created')
    fetchData()
  }

  const toggleLink = async (link: PartnerLink) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('partner_links')
      .update({ active: !link.active })
      .eq('id', link.id)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(link.active ? 'Link revoked' : 'Link re-enabled')
    fetchData()
  }

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/partner/${token}`
    navigator.clipboard.writeText(url)
    toast.success('Link copied')
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
          <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Globe2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Partner Issues</h1>
            <p className="text-sm text-slate-500">
              LANDWELL Beijing joint tracker · 南非市场联合问题汇总 · {issues.length} logged
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLinks(v => !v)}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition"
          >
            <Link2 className="w-4 h-4" />
            Partner Link
          </button>
          <a
            href="/api/partner-issues/export"
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition"
          >
            <Download className="w-4 h-4" />
            Export xlsx
          </a>
          <Link
            href="/partner-issues/new"
            className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-teal-700 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Issue
          </Link>
        </div>
      </div>

      {/* Partner links panel */}
      {showLinks && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-900">Read-only partner links</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Beijing views live status with no login. Revoke any time — they can never write to the record.
              </p>
            </div>
            <button
              onClick={createLink}
              className="flex items-center gap-2 bg-slate-900 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-slate-800 transition flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              New Link
            </button>
          </div>
          {links.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">No links yet.</p>
          ) : (
            <div className="space-y-2">
              {links.map(link => (
                <div
                  key={link.id}
                  className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100"
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${link.active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-800">{link.label}</div>
                    <div className="text-xs text-slate-400 font-mono truncate">/partner/{link.token}</div>
                  </div>
                  <div className="text-xs text-slate-500 flex-shrink-0 text-right">
                    <div>{link.view_count} views</div>
                    <div>{link.last_viewed_at ? formatDate(link.last_viewed_at) : 'never opened'}</div>
                  </div>
                  <button
                    onClick={() => copyLink(link.token)}
                    className="p-2 rounded-lg hover:bg-white text-slate-500 transition"
                    title="Copy link"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleLink(link)}
                    className="p-2 rounded-lg hover:bg-white text-slate-500 transition"
                    title={link.active ? 'Revoke' : 'Re-enable'}
                  >
                    {link.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-yellow-600 text-sm mb-1">
            <AlertTriangle className="w-4 h-4" />
            Open
          </div>
          <div className="text-2xl font-bold text-yellow-700">{stats.open}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-600 text-sm mb-1">
            <AlertTriangle className="w-4 h-4" />
            Critical/High
          </div>
          <div className="text-2xl font-bold text-red-700">{stats.critical}</div>
        </div>
        <button
          onClick={() => setOverdueOnly(v => !v)}
          className={`text-left rounded-xl p-4 border transition ${
            overdueOnly ? 'bg-orange-100 border-orange-400' : 'bg-orange-50 border-orange-200 hover:border-orange-300'
          }`}
        >
          <div className="flex items-center gap-2 text-orange-600 text-sm mb-1">
            <TimerReset className="w-4 h-4" />
            Overdue
          </div>
          <div className="text-2xl font-bold text-orange-700">{stats.overdue}</div>
        </button>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-emerald-600 text-sm mb-1">
            <CheckCircle2 className="w-4 h-4" />
            Closed
          </div>
          <div className="text-2xl font-bold text-emerald-700">{stats.closed}</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
            <Clock className="w-4 h-4" />
            Downtime (open)
          </div>
          <div className="text-2xl font-bold text-slate-700">{stats.downtime.toFixed(1)}h</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="text-slate-500 text-sm mb-1">Cost (open)</div>
          <div className="text-2xl font-bold text-slate-700">
            R{stats.cost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
          </div>
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
              placeholder="Search ref, description, site..."
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
              {Object.entries(PARTNER_ISSUE_STATUS_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">All Priority</option>
              {Object.entries(PARTNER_ISSUE_PRIORITY_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">All Categories</option>
              {PARTNER_ISSUE_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.value} / {c.labelCn}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Globe2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-lg font-medium text-slate-500">No issues found</p>
          <p className="text-sm text-slate-400 mt-1">
            {issues.length === 0 ? 'Log the first joint issue' : 'Try adjusting your filters'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(issue => {
            const statusCfg = PARTNER_ISSUE_STATUS_CONFIG[issue.status] || PARTNER_ISSUE_STATUS_CONFIG.open
            const priorityCfg = PARTNER_ISSUE_PRIORITY_CONFIG[issue.priority] || PARTNER_ISSUE_PRIORITY_CONFIG.medium
            const overdue = isPartnerIssueOverdue(issue)

            return (
              <Link
                key={issue.id}
                href={`/partner-issues/${issue.id}`}
                className="block bg-white rounded-xl border border-slate-200 p-4 hover:border-teal-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-2 h-full min-h-[48px] rounded-full flex-shrink-0 ${
                    issue.priority === 'critical' ? 'bg-red-500' :
                    issue.priority === 'high' ? 'bg-orange-500' :
                    issue.priority === 'medium' ? 'bg-blue-400' :
                    'bg-slate-300'
                  }`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold text-slate-400">{issue.ref}</span>
                          <span className="text-xs text-slate-400">{issue.category}</span>
                        </div>
                        <h3 className="font-semibold text-slate-900 group-hover:text-teal-700 transition mt-0.5">
                          {issue.description_en}
                        </h3>
                        {issue.description_cn && (
                          <p className="text-sm text-slate-500 mt-0.5">{issue.description_cn}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {(issue.client_name || issue.site) && (
                            <span className="text-sm text-slate-600">{issue.client_name || issue.site}</span>
                          )}
                          {issue.product_module && (
                            <span className="text-xs text-slate-400">{issue.product_module}</span>
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
                      {overdue && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          Overdue
                        </span>
                      )}
                      {issue.times_deferred > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          Deferred ×{issue.times_deferred}
                        </span>
                      )}
                      {Number(issue.downtime_hours) > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          {Number(issue.downtime_hours).toFixed(1)}h down
                        </span>
                      )}
                      <span className="text-xs text-slate-400 ml-auto">
                        {partnerIssueDaysOpen(issue)}d open · target {formatDate(issue.target_date)}
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
