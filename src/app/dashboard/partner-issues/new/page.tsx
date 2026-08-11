'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { PARTNER_ISSUE_PRIORITY_CONFIG, PARTNER_ISSUE_CATEGORIES } from '@/lib/types'
import type { PartnerIssueCategory, PartnerIssuePriority } from '@/lib/types'
import { ArrowLeft, Globe2, Send } from 'lucide-react'

type ClientOption = { id: string; name: string }

export default function NewPartnerIssuePage() {
  const router = useRouter()
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    raised_on: new Date().toISOString().slice(0, 10),
    category: 'Hardware' as PartnerIssueCategory,
    client_id: '',
    site: '',
    product_module: '',
    description_en: '',
    description_cn: '',
    business_impact: '',
    priority: 'medium' as PartnerIssuePriority,
    landwell_owner: '',
    distributor_owner: '',
    next_action_en: '',
    next_action_cn: '',
    target_date: '',
    downtime_hours: '',
    site_visits: '',
    cost_zar: '',
  })

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('clients').select('id, name').order('name')
      setClients(data || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.description_en.trim()) errs.description_en = 'English description is required'
    if (!form.client_id && !form.site.trim()) errs.site = 'Pick a client or name the site'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    const supabase = createClient()
    const { data: userRes } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('partner_issues')
      .insert({
        raised_on: form.raised_on,
        category: form.category,
        client_id: form.client_id || null,
        site: form.site.trim(),
        product_module: form.product_module.trim(),
        description_en: form.description_en.trim(),
        description_cn: form.description_cn.trim(),
        business_impact: form.business_impact.trim(),
        priority: form.priority,
        landwell_owner: form.landwell_owner.trim(),
        distributor_owner: form.distributor_owner.trim(),
        next_action_en: form.next_action_en.trim(),
        next_action_cn: form.next_action_cn.trim(),
        target_date: form.target_date || null,
        downtime_hours: Number(form.downtime_hours) || 0,
        site_visits: Number(form.site_visits) || 0,
        cost_zar: Number(form.cost_zar) || 0,
        created_by: userRes?.user?.id || null,
      })
      .select()
      .single()

    setSubmitting(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success(`${data.ref} logged`)
    router.push(`/partner-issues/${data.id}`)
  }

  const field = 'w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent'
  const label = 'block text-sm font-medium text-slate-700 mb-1.5'

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-16 skeleton rounded-2xl" />
        <div className="h-96 skeleton rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in pb-24 lg:pb-8 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link
          href="/partner-issues"
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
          <Globe2 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">New Partner Issue</h1>
          <p className="text-sm text-slate-500">Reference is assigned automatically (ZA-###)</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* What and where */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">Issue</h2>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className={label}>Date raised</label>
              <input
                type="date"
                value={form.raised_on}
                onChange={e => setForm({ ...form, raised_on: e.target.value })}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Category</label>
              <select
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value as PartnerIssueCategory })}
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
                value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value as PartnerIssuePriority })}
                className={field}
              >
                {Object.entries(PARTNER_ISSUE_PRIORITY_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label} / {cfg.labelCn}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className={label}>Client</label>
              <select
                value={form.client_id}
                onChange={e => setForm({ ...form, client_id: e.target.value })}
                className={field}
              >
                <option value="">— none / not an account —</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Site / description</label>
              <input
                type="text"
                value={form.site}
                onChange={e => setForm({ ...form, site: e.target.value })}
                placeholder="e.g. Mining – underground"
                className={field}
              />
              {errors.site && <p className="text-xs text-red-600 mt-1">{errors.site}</p>}
            </div>
            <div>
              <label className={label}>Product / module</label>
              <input
                type="text"
                value={form.product_module}
                onChange={e => setForm({ ...form, product_module: e.target.value })}
                placeholder="e.g. Android terminal / screen"
                className={field}
              />
            </div>
          </div>

          <div>
            <label className={label}>Description (English) *</label>
            <textarea
              value={form.description_en}
              onChange={e => setForm({ ...form, description_en: e.target.value })}
              rows={3}
              className={field}
              placeholder="Facts and observed behaviour only — do not record assumptions as root cause."
            />
            {errors.description_en && <p className="text-xs text-red-600 mt-1">{errors.description_en}</p>}
          </div>

          <div>
            <label className={label}>问题描述 (中文)</label>
            <textarea
              value={form.description_cn}
              onChange={e => setForm({ ...form, description_cn: e.target.value })}
              rows={3}
              className={field}
            />
          </div>

          <div>
            <label className={label}>Business impact</label>
            <input
              type="text"
              value={form.business_impact}
              onChange={e => setForm({ ...form, business_impact: e.target.value })}
              placeholder="e.g. Critical operational interruption"
              className={field}
            />
          </div>
        </div>

        {/* Cost of the failure */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-slate-900">Cost</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              What the failure actually cost. These roll up into the totals used against hardware pricing.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className={label}>Downtime hours</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={form.downtime_hours}
                onChange={e => setForm({ ...form, downtime_hours: e.target.value })}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Site visits</label>
              <input
                type="number"
                min="0"
                value={form.site_visits}
                onChange={e => setForm({ ...form, site_visits: e.target.value })}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Cost (ZAR)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.cost_zar}
                onChange={e => setForm({ ...form, cost_zar: e.target.value })}
                className={field}
              />
            </div>
          </div>
        </div>

        {/* Ownership and next action */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">Ownership &amp; next action</h2>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className={label}>LANDWELL owner</label>
              <input
                type="text"
                value={form.landwell_owner}
                onChange={e => setForm({ ...form, landwell_owner: e.target.value })}
                placeholder="Beijing-side owner"
                className={field}
              />
            </div>
            <div>
              <label className={label}>Our owner</label>
              <input
                type="text"
                value={form.distributor_owner}
                onChange={e => setForm({ ...form, distributor_owner: e.target.value })}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Target date</label>
              <input
                type="date"
                value={form.target_date}
                onChange={e => setForm({ ...form, target_date: e.target.value })}
                className={field}
              />
              <p className="text-xs text-slate-400 mt-1">Every later change is counted as a deferral.</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className={label}>Next action (English)</label>
              <textarea
                value={form.next_action_en}
                onChange={e => setForm({ ...form, next_action_en: e.target.value })}
                rows={2}
                className={field}
              />
            </div>
            <div>
              <label className={label}>下一步行动 (中文)</label>
              <textarea
                value={form.next_action_cn}
                onChange={e => setForm({ ...form, next_action_cn: e.target.value })}
                rows={2}
                className={field}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-teal-700 transition shadow-sm disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Saving...' : 'Log Issue'}
          </button>
          <Link
            href="/partner-issues"
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
