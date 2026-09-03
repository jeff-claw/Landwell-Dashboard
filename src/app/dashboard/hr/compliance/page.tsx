'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { HRComplianceItem, ComplianceStatus } from '@/lib/types'
import { HR_COMPLIANCE_CATEGORIES, COMPLIANCE_STATUS_CONFIG } from '@/lib/types'
import { ChevronDown, ChevronRight, CheckCircle, XCircle, AlertTriangle, Upload, Paperclip, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export default function HRCompliancePage() {
  const [items, setItems] = useState<HRComplianceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})
  const router = useRouter()
  const supabase = createClient()

  // Auth check
  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!profile || !['founder', 'admin', 'hr'].includes(profile.role)) {
        router.push('/')
        return
      }
      setAuthorized(true)
    }
    checkAccess()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from('hr_compliance_items')
      .select('*')
      .order('category')
      .order('item_name')

    if (data && data.length > 0) {
      setItems(data)
    } else {
      // Pre-seed compliance items on first load
      await seedComplianceItems()
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const seedComplianceItems = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const rows: Partial<HRComplianceItem>[] = []

    for (const cat of HR_COMPLIANCE_CATEGORIES) {
      for (const itemName of cat.items) {
        rows.push({
          category: cat.category,
          item_name: itemName,
          status: 'no' as ComplianceStatus,
          updated_by: user?.id || null,
        })
      }
    }

    const { data, error } = await supabase.from('hr_compliance_items').insert(rows).select()
    if (error) {
      console.error('Error seeding compliance items:', error)
      return
    }
    if (data) setItems(data)
  }

  useEffect(() => {
    if (authorized) fetchItems()
  }, [authorized, fetchItems])

  // Group items by category
  const grouped = useMemo(() => {
    const map = new Map<string, HRComplianceItem[]>()
    for (const item of items) {
      const existing = map.get(item.category) || []
      existing.push(item)
      map.set(item.category, existing)
    }
    return map
  }, [items])

  // Overall stats
  const overallStats = useMemo(() => {
    const total = items.length
    const yes = items.filter(i => i.status === 'yes').length
    const partial = items.filter(i => i.status === 'partial').length
    const na = items.filter(i => i.status === 'not_applicable').length
    const applicable = total - na
    const score = applicable > 0 ? Math.round(((yes + partial * 0.5) / applicable) * 100) : 0
    return { total, yes, partial, na, score }
  }, [items])

  // Category progress
  const categoryProgress = useCallback((category: string) => {
    const catItems = grouped.get(category) || []
    const total = catItems.length
    const na = catItems.filter(i => i.status === 'not_applicable').length
    const applicable = total - na
    const yes = catItems.filter(i => i.status === 'yes').length
    const partial = catItems.filter(i => i.status === 'partial').length
    const score = applicable > 0 ? Math.round(((yes + partial * 0.5) / applicable) * 100) : 100
    return { total, yes, partial, score, applicable }
  }, [grouped])

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const updateItem = async (itemId: string, field: string, value: string) => {
    setSaving(itemId)
    const { data: { user } } = await supabase.auth.getUser()

    const updateData: Record<string, unknown> = {
      [field]: value || null,
      updated_by: user?.id || null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('hr_compliance_items')
      .update(updateData)
      .eq('id', itemId)

    setSaving(null)

    if (error) {
      console.error('Error updating compliance item:', error)
      return
    }

    // Update local state
    setItems(prev => prev.map(i =>
      i.id === itemId ? { ...i, [field]: value || null, updated_at: new Date().toISOString() } : i
    ))
  }

  // Evidence is uploaded to Supabase Storage and the public URL is stored on the
  // item, so staff attach the actual policy or certificate instead of pasting a
  // link to a file nobody else can open.
  const uploadEvidence = async (itemId: string, file: File) => {
    setUploading(itemId)
    const body = new FormData()
    body.append('file', file)
    body.append('item_id', itemId)

    const res = await fetch('/api/upload-compliance-doc', { method: 'POST', body })
    const json = await res.json()
    setUploading(null)

    if (!res.ok) {
      toast.error(json.error || 'Upload failed')
      return
    }

    await updateItem(itemId, 'evidence_url', json.url)
    toast.success('Document attached')
  }

  const removeEvidence = async (itemId: string) => {
    await updateItem(itemId, 'evidence_url', '')
    toast.success('Document removed')
  }

  // Storage paths are `<itemId>/<timestamp>-<original name>` — show the human part.
  const evidenceName = (url: string) => {
    const base = decodeURIComponent(url.split('/').pop() || '')
    return base.replace(/^\d+-/, '') || 'document'
  }

  if (!authorized || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Get ordered categories (from the constant)
  const orderedCategories = HR_COMPLIANCE_CATEGORIES.map(c => c.category)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <h1 className="text-2xl font-bold text-slate-900">HR Compliance Tracker</h1>

      {/* Overall Score */}
      <div className="card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
              overallStats.score >= 80 ? 'bg-emerald-100' : overallStats.score >= 50 ? 'bg-amber-100' : 'bg-red-100'
            }`}>
              {overallStats.score >= 80 ? (
                <CheckCircle className={`w-8 h-8 text-emerald-600`} />
              ) : overallStats.score >= 50 ? (
                <AlertTriangle className={`w-8 h-8 text-amber-600`} />
              ) : (
                <XCircle className={`w-8 h-8 text-red-600`} />
              )}
            </div>
            <div>
              <div className="text-3xl font-bold text-slate-900">{overallStats.score}%</div>
              <div className="text-sm text-slate-500">Overall Compliance Score</div>
            </div>
          </div>
          <div className="flex gap-6 text-sm">
            <div className="text-center">
              <div className="font-bold text-emerald-600">{overallStats.yes}</div>
              <div className="text-slate-500">Compliant</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-amber-600">{overallStats.partial}</div>
              <div className="text-slate-500">Partial</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-red-600">{overallStats.total - overallStats.yes - overallStats.partial - overallStats.na}</div>
              <div className="text-slate-500">Non-Compliant</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-slate-400">{overallStats.na}</div>
              <div className="text-slate-500">N/A</div>
            </div>
          </div>
        </div>
        <div className="mt-4 w-full bg-slate-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${
              overallStats.score >= 80 ? 'bg-emerald-500' : overallStats.score >= 50 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${overallStats.score}%` }}
          />
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-3">
        {orderedCategories.map(category => {
          const progress = categoryProgress(category)
          const isExpanded = expandedCategories.has(category)
          const catItems = grouped.get(category) || []

          return (
            <div key={category} className="card overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between py-1 text-left"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  )}
                  <div>
                    <div className="font-semibold text-slate-900">{category}</div>
                    <div className="text-xs text-slate-500">
                      {progress.yes}/{progress.applicable} items compliant
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold ${
                    progress.score >= 80 ? 'text-emerald-600' : progress.score >= 50 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {progress.score}%
                  </span>
                  <div className="w-24 bg-slate-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        progress.score >= 80 ? 'bg-emerald-500' : progress.score >= 50 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${progress.score}%` }}
                    />
                  </div>
                </div>
              </button>

              {/* Category Items */}
              {isExpanded && (
                <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
                  {catItems.map(item => {
                    const statusConf = COMPLIANCE_STATUS_CONFIG[item.status]
                    return (
                      <div key={item.id} className="bg-slate-50 rounded-lg p-3">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-900">{item.item_name}</div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <select
                              value={item.status}
                              onChange={(e) => updateItem(item.id, 'status', e.target.value)}
                              className={`text-xs font-medium rounded-lg px-2 py-1 border-0 cursor-pointer ${statusConf.bg} ${statusConf.text}`}
                            >
                              <option value="yes">Yes</option>
                              <option value="no">No</option>
                              <option value="partial">Partial</option>
                              <option value="not_applicable">N/A</option>
                            </select>
                            {saving === item.id && (
                              <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                            )}
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="flex items-center gap-2">
                            <input
                              ref={(el) => { fileInputs.current[item.id] = el }}
                              type="file"
                              accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0]
                                if (f) uploadEvidence(item.id, f)
                                e.target.value = ''
                              }}
                            />
                            {item.evidence_url ? (
                              <div className="flex items-center gap-2 flex-1 min-w-0 px-2 py-1.5 bg-white border border-slate-200 rounded-lg">
                                <Paperclip className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                <a
                                  href={item.evidence_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-teal-700 hover:underline truncate flex-1"
                                >
                                  {evidenceName(item.evidence_url)}
                                </a>
                                <button
                                  onClick={() => fileInputs.current[item.id]?.click()}
                                  disabled={uploading === item.id}
                                  className="text-xs font-medium text-slate-500 hover:text-teal-700 disabled:opacity-50"
                                >
                                  {uploading === item.id ? 'Uploading...' : 'Replace'}
                                </button>
                                <button
                                  onClick={() => removeEvidence(item.id)}
                                  className="p-0.5 rounded text-slate-400 hover:text-red-600 transition"
                                  aria-label="Remove document"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => fileInputs.current[item.id]?.click()}
                                disabled={uploading === item.id}
                                className="flex items-center justify-center gap-1.5 flex-1 text-xs font-medium px-2 py-1.5 border border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-teal-500 hover:text-teal-700 transition disabled:opacity-50"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                {uploading === item.id ? 'Uploading...' : 'Upload document'}
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            value={item.notes || ''}
                            onBlur={(e) => {
                              if (e.target.value !== (item.notes || '')) {
                                updateItem(item.id, 'notes', e.target.value)
                              }
                            }}
                            onChange={(e) => {
                              setItems(prev => prev.map(i =>
                                i.id === item.id ? { ...i, notes: e.target.value } : i
                              ))
                            }}
                            placeholder="Notes..."
                            className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
