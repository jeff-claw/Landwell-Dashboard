'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
type ClientOption = { id: string; name: string }
import { TICKET_PRIORITY_CONFIG, TICKET_ISSUE_TYPE_CONFIG } from '@/lib/types'
import type { TicketIssueType, TicketPriority } from '@/lib/types'
import {
  ArrowLeft,
  Headset,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'

export default function NewTicketPage() {
  const router = useRouter()
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [profileName, setProfileName] = useState('')

  const [form, setForm] = useState({
    client_id: '',
    device_serial: '',
    issue_type: 'hardware' as TicketIssueType,
    priority: 'medium' as TicketPriority,
    subject: '',
    description: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const [clientsRes, userRes] = await Promise.all([
        supabase.from('clients').select('id, name').order('name'),
        supabase.auth.getUser(),
      ])
      setClients(clientsRes.data || [])

      if (userRes.data?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', userRes.data.user.id)
          .single()
        setProfileName(profile?.full_name || userRes.data.user.email?.split('@')[0] || '')
      }

      // Check URL params for pre-selected client
      const params = new URLSearchParams(window.location.search)
      const clientParam = params.get('client')
      if (clientParam) {
        setForm(prev => ({ ...prev, client_id: clientParam }))
      }

      setLoading(false)
    }
    fetchData()
  }, [])

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.subject.trim()) errs.subject = 'Subject is required'
    if (!form.description.trim()) errs.description = 'Description is required'
    if (!form.issue_type) errs.issue_type = 'Issue type is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('tickets')
      .insert({
        client_id: form.client_id || null,
        device_serial: form.device_serial.trim() || null,
        issue_type: form.issue_type,
        priority: form.priority,
        subject: form.subject.trim(),
        description: form.description.trim(),
        created_by: profileName || null,
      })
      .select('id')
      .single()

    if (error) {
      toast.error('Failed to create ticket: ' + error.message)
      setSubmitting(false)
      return
    }

    toast.success('Ticket created successfully')
    router.push(`/tickets/${data.id}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in pb-24 lg:pb-8 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/tickets')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm mb-4 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tickets
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Headset className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">New Support Ticket</h1>
            <p className="text-sm text-slate-500">Log a new support issue</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          {/* Subject */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.subject}
              onChange={e => setForm(prev => ({ ...prev, subject: e.target.value }))}
              placeholder="Brief summary of the issue"
              className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                errors.subject ? 'border-red-300 bg-red-50' : 'border-slate-200'
              }`}
            />
            {errors.subject && <p className="text-xs text-red-500 mt-1">{errors.subject}</p>}
          </div>

          {/* Client */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Client</label>
            <select
              value={form.client_id}
              onChange={e => setForm(prev => ({ ...prev, client_id: e.target.value }))}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">No client linked</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Device Serial */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Device Serial Number</label>
            <input
              type="text"
              value={form.device_serial}
              onChange={e => setForm(prev => ({ ...prev, device_serial: e.target.value }))}
              placeholder="e.g. LW-2024-001"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <p className="text-xs text-slate-400 mt-1">Cabinet serial number if applicable</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Issue Type */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                Issue Type <span className="text-red-500">*</span>
              </label>
              <select
                value={form.issue_type}
                onChange={e => setForm(prev => ({ ...prev, issue_type: e.target.value as TicketIssueType }))}
                className={`w-full px-4 py-2.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  errors.issue_type ? 'border-red-300 bg-red-50' : 'border-slate-200'
                }`}
              >
                {Object.entries(TICKET_ISSUE_TYPE_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
              {errors.issue_type && <p className="text-xs text-red-500 mt-1">{errors.issue_type}</p>}
            </div>

            {/* Priority */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm(prev => ({ ...prev, priority: e.target.value as TicketPriority }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {Object.entries(TICKET_PRIORITY_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the issue in detail. Include steps to reproduce, expected behavior, and any error messages."
              className={`w-full px-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[160px] resize-y ${
                errors.description ? 'border-red-300 bg-red-50' : 'border-slate-200'
              }`}
            />
            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push('/tickets')}
            className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Creating...' : 'Create Ticket'}
          </button>
        </div>
      </form>
    </div>
  )
}
