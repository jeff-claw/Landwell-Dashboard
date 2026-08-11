'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type {
  PartnerIssue,
  PartnerIssueUpdate,
  PartnerIssueEvidence,
  PartnerIssueAudit,
  PartnerIssueCategory,
  PartnerIssuePriority,
  PartnerIssueStatus,
  PartnerUpdateSide,
} from '@/lib/types'
import {
  PARTNER_ISSUE_STATUS_CONFIG,
  PARTNER_ISSUE_PRIORITY_CONFIG,
  PARTNER_ISSUE_CATEGORIES,
  isPartnerIssueOverdue,
  partnerIssueDaysOpen,
} from '@/lib/types'
import {
  ArrowLeft,
  Globe2,
  Save,
  Paperclip,
  MessageSquarePlus,
  History,
  Trash2,
  AlertTriangle,
  Upload,
} from 'lucide-react'

type ClientOption = { id: string; name: string }

function formatDateTime(s: string) {
  return new Date(s).toLocaleString('en-ZA', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const SIDE_LABEL: Record<PartnerUpdateSide, string> = {
  distributor: 'Landwell Africa',
  landwell: 'LANDWELL Beijing',
  internal: 'Internal note',
}

export default function PartnerIssueDetailPage() {
  const params = useParams()
  const router = useRouter()
  const issueId = params.id as string
  const fileInput = useRef<HTMLInputElement>(null)

  const [issue, setIssue] = useState<PartnerIssue | null>(null)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [updates, setUpdates] = useState<PartnerIssueUpdate[]>([])
  const [evidence, setEvidence] = useState<PartnerIssueEvidence[]>([])
  const [audit, setAudit] = useState<PartnerIssueAudit[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showAudit, setShowAudit] = useState(false)

  const [newUpdate, setNewUpdate] = useState('')
  const [updateSide, setUpdateSide] = useState<PartnerUpdateSide>('distributor')
  const [updateAuthor, setUpdateAuthor] = useState('')

  const fetchAll = useCallback(async () => {
    const supabase = createClient()
    const [issueRes, clientsRes, updatesRes, evidenceRes, auditRes] = await Promise.all([
      supabase.from('partner_issues').select('*').eq('id', issueId).single(),
      supabase.from('clients').select('id, name').order('name'),
      supabase.from('partner_issue_updates').select('*').eq('issue_id', issueId).order('created_at', { ascending: true }),
      supabase.from('partner_issue_evidence').select('*').eq('issue_id', issueId).order('created_at', { ascending: false }),
      supabase.from('partner_issue_audit').select('*').eq('issue_id', issueId).order('changed_at', { ascending: false }),
    ])

    if (issueRes.error) {
      toast.error('Issue not found')
      router.push('/partner-issues')
      return
    }
    setIssue(issueRes.data)
    setClients(clientsRes.data || [])
    setUpdates(updatesRes.data || [])
    setEvidence(evidenceRes.data || [])
    setAudit(auditRes.data || [])
    setLoading(false)
  }, [issueId, router])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    const loadName = async () => {
      const supabase = createClient()
      const { data: userRes } = await supabase.auth.getUser()
      if (!userRes?.user) return
      const { data: profile } = await supabase
        .from('profiles').select('full_name').eq('id', userRes.user.id).single()
      setUpdateAuthor(profile?.full_name || userRes.user.email?.split('@')[0] || '')
    }
    loadName()
  }, [])

  const set = <K extends keyof PartnerIssue>(key: K, value: PartnerIssue[K]) => {
    setIssue(prev => (prev ? { ...prev, [key]: value } : prev))
  }

  const save = async () => {
    if (!issue) return

    // The DB enforces this too, but a clear message beats a constraint error.
    if (issue.status === 'verified_closed' && !issue.closure_evidence.trim()) {
      toast.error('Closure evidence is required before an issue can be closed')
      return
    }

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('partner_issues')
      .update({
        category: issue.category,
        client_id: issue.client_id || null,
        site: issue.site,
        product_module: issue.product_module,
        description_en: issue.description_en,
        description_cn: issue.description_cn,
        business_impact: issue.business_impact,
        priority: issue.priority,
        landwell_owner: issue.landwell_owner,
        distributor_owner: issue.distributor_owner,
        next_action_en: issue.next_action_en,
        next_action_cn: issue.next_action_cn,
        target_date: issue.target_date || null,
        status: issue.status,
        root_cause: issue.root_cause,
        solution: issue.solution,
        closure_evidence: issue.closure_evidence,
        downtime_hours: Number(issue.downtime_hours) || 0,
        site_visits: Number(issue.site_visits) || 0,
        cost_zar: Number(issue.cost_zar) || 0,
      })
      .eq('id', issue.id)

    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Saved')
    fetchAll()
  }

  const addUpdate = async () => {
    if (!newUpdate.trim()) return
    const supabase = createClient()
    const { data: userRes } = await supabase.auth.getUser()
    const { error } = await supabase.from('partner_issue_updates').insert({
      issue_id: issueId,
      author_side: updateSide,
      author_name: updateAuthor,
      body: newUpdate.trim(),
      created_by: userRes?.user?.id || null,
    })
    if (error) {
      toast.error(error.message)
      return
    }
    setNewUpdate('')
    toast.success('Update recorded')
    fetchAll()
  }

  const uploadEvidence = async (file: File) => {
    setUploading(true)
    const body = new FormData()
    body.append('file', file)
    body.append('issue_id', issueId)

    const res = await fetch('/api/partner-issues/upload', { method: 'POST', body })
    const json = await res.json()
    setUploading(false)

    if (!res.ok) {
      toast.error(json.error || 'Upload failed')
      return
    }
    toast.success('Evidence attached')
    fetchAll()
  }

  const removeEvidence = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase.from('partner_issue_evidence').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
      return
    }
    fetchAll()
  }

  const field = 'w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent'
  const label = 'block text-sm font-medium text-slate-700 mb-1.5'

  if (loading || !issue) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-16 skeleton rounded-2xl" />
        <div className="h-96 skeleton rounded-2xl" />
      </div>
    )
  }

  const statusCfg = PARTNER_ISSUE_STATUS_CONFIG[issue.status]
  const overdue = isPartnerIssueOverdue(issue)

  return (
    <div className="space-y-6 animate-fade-in pb-24 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/partner-issues" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
            <Globe2 className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900">{issue.ref}</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}>
                {statusCfg.label} / {statusCfg.labelCn}
              </span>
              {overdue && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Overdue</span>
              )}
            </div>
            <p className="text-sm text-slate-500 truncate">
              {partnerIssueDaysOpen(issue)} days open
              {issue.times_deferred > 0 && ` · target moved ${issue.times_deferred}×`}
              {issue.first_target_date && ` · first target ${issue.first_target_date}`}
            </p>
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-teal-700 transition shadow-sm disabled:opacity-50 flex-shrink-0"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {issue.times_deferred >= 2 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Target date has moved {issue.times_deferred} times. Per the agreed escalation rule this belongs on the
            monthly review agenda with named executives on both sides.
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Issue detail */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h2 className="font-semibold text-slate-900">Issue</h2>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className={label}>Category</label>
                <select
                  value={issue.category}
                  onChange={e => set('category', e.target.value as PartnerIssueCategory)}
                  className={field}
                >
                  {PARTNER_ISSUE_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.value} / {c.labelCn}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Priority</label>
                <select
                  value={issue.priority}
                  onChange={e => set('priority', e.target.value as PartnerIssuePriority)}
                  className={field}
                >
                  {Object.entries(PARTNER_ISSUE_PRIORITY_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label} / {cfg.labelCn}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Status</label>
                <select
                  value={issue.status}
                  onChange={e => set('status', e.target.value as PartnerIssueStatus)}
                  className={field}
                >
                  {Object.entries(PARTNER_ISSUE_STATUS_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label} / {cfg.labelCn}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className={label}>Client</label>
                <select
                  value={issue.client_id || ''}
                  onChange={e => set('client_id', e.target.value || null)}
                  className={field}
                >
                  <option value="">— none —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Site</label>
                <input type="text" value={issue.site} onChange={e => set('site', e.target.value)} className={field} />
              </div>
              <div>
                <label className={label}>Product / module</label>
                <input type="text" value={issue.product_module} onChange={e => set('product_module', e.target.value)} className={field} />
              </div>
            </div>

            <div>
              <label className={label}>Description (English)</label>
              <textarea value={issue.description_en} onChange={e => set('description_en', e.target.value)} rows={3} className={field} />
            </div>
            <div>
              <label className={label}>问题描述 (中文)</label>
              <textarea value={issue.description_cn} onChange={e => set('description_cn', e.target.value)} rows={3} className={field} />
            </div>
            <div>
              <label className={label}>Business impact</label>
              <input type="text" value={issue.business_impact} onChange={e => set('business_impact', e.target.value)} className={field} />
            </div>
          </div>

          {/* Resolution */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h2 className="font-semibold text-slate-900">Root cause &amp; resolution</h2>
            <div>
              <label className={label}>Root cause</label>
              <textarea
                value={issue.root_cause}
                onChange={e => set('root_cause', e.target.value)}
                rows={2}
                className={field}
                placeholder="Leave blank until proven. Do not record an assumption here."
              />
            </div>
            <div>
              <label className={label}>Solution</label>
              <textarea value={issue.solution} onChange={e => set('solution', e.target.value)} rows={2} className={field} />
            </div>
            <div>
              <label className={label}>
                Verification / closure evidence
                <span className="text-xs font-normal text-slate-400 ml-2">required to close</span>
              </label>
              <textarea
                value={issue.closure_evidence}
                onChange={e => set('closure_evidence', e.target.value)}
                rows={2}
                className={field}
                placeholder="Who verified it on site, when, and what was observed."
              />
            </div>
          </div>

          {/* Updates thread */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div>
              <h2 className="font-semibold text-slate-900">Updates</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Append-only. Nothing here can be edited or deleted, by either side.
              </p>
            </div>

            {updates.length === 0 ? (
              <p className="text-sm text-slate-400">No updates recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {updates.map(u => (
                  <div
                    key={u.id}
                    className={`rounded-lg p-3 border ${
                      u.author_side === 'landwell'
                        ? 'bg-indigo-50 border-indigo-200'
                        : u.author_side === 'internal'
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-teal-50 border-teal-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="text-xs font-semibold text-slate-700">
                        {SIDE_LABEL[u.author_side]}
                        {u.author_name && ` · ${u.author_name}`}
                      </span>
                      <span className="text-xs text-slate-400">{formatDateTime(u.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{u.body}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div className="flex gap-2">
                <select
                  value={updateSide}
                  onChange={e => setUpdateSide(e.target.value as PartnerUpdateSide)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="distributor">Landwell Africa</option>
                  <option value="landwell">LANDWELL Beijing</option>
                  <option value="internal">Internal note</option>
                </select>
                <input
                  type="text"
                  value={updateAuthor}
                  onChange={e => setUpdateAuthor(e.target.value)}
                  placeholder="Author"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <textarea
                value={newUpdate}
                onChange={e => setNewUpdate(e.target.value)}
                rows={3}
                placeholder="Record what was said, by whom, and when. Beijing's replies go here verbatim."
                className={field}
              />
              <button
                onClick={addUpdate}
                disabled={!newUpdate.trim()}
                className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition disabled:opacity-40"
              >
                <MessageSquarePlus className="w-4 h-4" />
                Add Update
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Ownership */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h2 className="font-semibold text-slate-900">Ownership</h2>
            <div>
              <label className={label}>LANDWELL owner</label>
              <input type="text" value={issue.landwell_owner} onChange={e => set('landwell_owner', e.target.value)} className={field} />
            </div>
            <div>
              <label className={label}>Our owner</label>
              <input type="text" value={issue.distributor_owner} onChange={e => set('distributor_owner', e.target.value)} className={field} />
            </div>
            <div>
              <label className={label}>Target date</label>
              <input
                type="date"
                value={issue.target_date || ''}
                onChange={e => set('target_date', e.target.value || null)}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Next action (EN)</label>
              <textarea value={issue.next_action_en} onChange={e => set('next_action_en', e.target.value)} rows={2} className={field} />
            </div>
            <div>
              <label className={label}>下一步行动 (中文)</label>
              <textarea value={issue.next_action_cn} onChange={e => set('next_action_cn', e.target.value)} rows={2} className={field} />
            </div>
          </div>

          {/* Cost */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h2 className="font-semibold text-slate-900">Cost</h2>
            <div>
              <label className={label}>Downtime hours</label>
              <input
                type="number" step="0.5" min="0"
                value={issue.downtime_hours}
                onChange={e => set('downtime_hours', Number(e.target.value))}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Site visits</label>
              <input
                type="number" min="0"
                value={issue.site_visits}
                onChange={e => set('site_visits', Number(e.target.value))}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Cost (ZAR)</label>
              <input
                type="number" step="0.01" min="0"
                value={issue.cost_zar}
                onChange={e => set('cost_zar', Number(e.target.value))}
                className={field}
              />
            </div>
          </div>

          {/* Evidence */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Evidence</h2>
              <button
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-800 disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                {uploading ? 'Uploading...' : 'Attach'}
              </button>
              <input
                ref={fileInput}
                type="file"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) uploadEvidence(f)
                  e.target.value = ''
                }}
              />
            </div>

            {evidence.length === 0 ? (
              <p className="text-sm text-slate-400">
                No evidence attached. Photos, serial numbers and timestamps are what make this record hold up.
              </p>
            ) : (
              <div className="space-y-2">
                {evidence.map(ev => (
                  <div key={ev.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <Paperclip className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <a
                      href={ev.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-teal-700 hover:underline truncate flex-1"
                    >
                      {ev.file_name || 'attachment'}
                    </a>
                    <button
                      onClick={() => removeEvidence(ev.id)}
                      className="p-1 rounded hover:bg-white text-slate-400 hover:text-red-600 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Audit */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <button
              onClick={() => setShowAudit(v => !v)}
              className="flex items-center gap-2 font-semibold text-slate-900 w-full"
            >
              <History className="w-4 h-4 text-slate-400" />
              Change history
              <span className="text-xs font-normal text-slate-400 ml-auto">{audit.length}</span>
            </button>
            {showAudit && (
              <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
                {audit.length === 0 ? (
                  <p className="text-sm text-slate-400">No changes recorded.</p>
                ) : (
                  audit.map(a => (
                    <div key={a.id} className="text-xs border-l-2 border-slate-200 pl-3 py-1">
                      <div className="text-slate-500">{formatDateTime(a.changed_at)}</div>
                      <div className="text-slate-700">
                        <span className="font-medium">{a.field}</span>:{' '}
                        <span className="line-through text-slate-400">{a.old_value || '—'}</span>{' '}
                        → <span className="text-slate-900">{a.new_value || '—'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
