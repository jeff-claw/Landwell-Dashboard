'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Reminder, Quote, PipelineDeal, Task } from '@/lib/types'
import { Bell, Clock, FileText, GitBranch, CheckSquare, X, Check, Calendar, RefreshCw, Trash2 } from 'lucide-react'

function daysBetween(date1: Date, date2: Date): number {
  const diff = date2.getTime() - date1.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

// Modal component
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-60px)]">{children}</div>
      </div>
    </div>
  )
}

const REMINDER_ICONS = {
  quote_followup: FileText,
  pipeline_stale: GitBranch,
  task_overdue: CheckSquare,
  custom: Bell,
}

const REMINDER_COLORS = {
  quote_followup: 'bg-amber-100 text-amber-600',
  pipeline_stale: 'bg-blue-100 text-blue-600',
  task_overdue: 'bg-red-100 text-red-600',
  custom: 'bg-purple-100 text-purple-600',
}

type ReminderType = keyof typeof REMINDER_ICONS

interface AutoReminder {
  type: ReminderType
  title: string
  description: string
  referenceType: string
  referenceId: string
  dueDate: string
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [pipeline, setPipeline] = useState<PipelineDeal[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<'all' | ReminderType>('all')
  const [showDismissed, setShowDismissed] = useState(false)
  
  // Snooze modal
  const [snoozeModalOpen, setSnoozeModalOpen] = useState(false)
  const [selectedReminder, setSelectedReminder] = useState<Reminder | AutoReminder | null>(null)
  const [snoozeDays, setSnoozeDays] = useState('1')
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  const fetchAll = useCallback(async () => {
    const [remindersRes, quotesRes, pipelineRes, tasksRes] = await Promise.all([
      supabase.from('reminders').select('*').order('due_date', { ascending: true }),
      supabase.from('quotes').select('*'),
      supabase.from('pipeline').select('*'),
      supabase.from('tasks').select('*'),
    ])
    
    setReminders(remindersRes.data || [])
    setQuotes(quotesRes.data || [])
    setPipeline(pipelineRes.data || [])
    setTasks(tasksRes.data || [])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Auto-generate reminders from data
  const autoReminders = useMemo(() => {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const generated: AutoReminder[] = []

    // Quotes > 3 days old with status 'sent' (no response)
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
    quotes.forEach(quote => {
      if (quote.status?.toLowerCase() !== 'sent') return
      const quoteDate = new Date(quote.date || quote.created_at)
      if (quoteDate > threeDaysAgo) return
      
      // Check if already has a reminder for this quote
      const existingReminder = reminders.find(r => 
        r.reference_type === 'quote' && r.reference_id === quote.id && r.status !== 'dismissed'
      )
      if (existingReminder) return

      const daysSince = daysBetween(quoteDate, now)
      generated.push({
        type: 'quote_followup',
        title: `Follow up on quote ${quote.quote_number}`,
        description: `${quote.client_name} - Sent ${daysSince} days ago`,
        referenceType: 'quote',
        referenceId: quote.id,
        dueDate: today,
      })
    })

    // Pipeline deals stale > 14 days
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    pipeline.forEach(deal => {
      if (deal.status === 'closed_won' || deal.status === 'closed_lost') return
      const lastUpdate = new Date(deal.updated_at || deal.created_at)
      if (lastUpdate > fourteenDaysAgo) return

      // Check if already has a reminder
      const existingReminder = reminders.find(r => 
        r.reference_type === 'pipeline' && r.reference_id === deal.id && r.status !== 'dismissed'
      )
      if (existingReminder) return

      const daysSince = daysBetween(lastUpdate, now)
      generated.push({
        type: 'pipeline_stale',
        title: `Check in on ${deal.client_name || deal.title}`,
        description: `No activity for ${daysSince} days`,
        referenceType: 'pipeline',
        referenceId: deal.id,
        dueDate: today,
      })
    })

    // Overdue tasks
    tasks.forEach(task => {
      if (task.completed || task.status === 'done') return
      if (!task.due_date) return
      const dueDate = new Date(task.due_date)
      if (dueDate >= now) return

      // Check if already has a reminder
      const existingReminder = reminders.find(r => 
        r.reference_type === 'task' && r.reference_id === task.id && r.status !== 'dismissed'
      )
      if (existingReminder) return

      const daysOverdue = daysBetween(dueDate, now)
      generated.push({
        type: 'task_overdue',
        title: `Task overdue: ${task.title}`,
        description: `${daysOverdue} days overdue${task.client_name ? ` - ${task.client_name}` : ''}`,
        referenceType: 'task',
        referenceId: task.id,
        dueDate: task.due_date,
      })
    })

    return generated
  }, [quotes, pipeline, tasks, reminders])

  // Combine manual and auto reminders
  const allReminders = useMemo(() => {
    const manualPending = reminders.filter(r => {
      if (r.status === 'dismissed') return showDismissed
      if (r.status === 'snoozed' && r.snoozed_until) {
        const snoozeDate = new Date(r.snoozed_until)
        if (snoozeDate > new Date()) return false
      }
      return true
    })

    // Merge auto reminders (they don't have IDs)
    const combined = [
      ...autoReminders.map(ar => ({ ...ar, isAuto: true, status: 'pending' as const })),
      ...manualPending.map(mr => ({ ...mr, isAuto: false })),
    ]

    // Filter by type
    if (filterType !== 'all') {
      return combined.filter(r => r.type === filterType)
    }

    return combined
  }, [reminders, autoReminders, filterType, showDismissed])

  // Stats
  const stats = useMemo(() => {
    const byType = {
      quote_followup: 0,
      pipeline_stale: 0,
      task_overdue: 0,
      custom: 0,
    }
    
    allReminders.forEach(r => {
      if (r.status !== 'pending' && r.status !== 'snoozed') return
      if (byType[r.type as ReminderType] !== undefined) {
        byType[r.type as ReminderType]++
      }
    })

    return {
      total: allReminders.filter(r => r.status === 'pending').length,
      byType,
    }
  }, [allReminders])

  // Create reminder in DB (for auto reminders that need to be snoozed/dismissed)
  const createReminder = async (ar: AutoReminder): Promise<string | null> => {
    const { data, error } = await supabase.from('reminders').insert({
      type: ar.type,
      title: ar.title,
      description: ar.description,
      reference_type: ar.referenceType,
      reference_id: ar.referenceId,
      due_date: ar.dueDate,
      status: 'pending',
    }).select('id').single()

    if (error) {
      console.error('Error creating reminder:', error)
      return null
    }
    return data?.id || null
  }

  // Dismiss reminder
  const dismissReminder = async (reminder: Reminder | (AutoReminder & { isAuto?: boolean })) => {
    if ('isAuto' in reminder && reminder.isAuto) {
      // Create in DB first, then dismiss
      const id = await createReminder(reminder as AutoReminder)
      if (id) {
        await supabase.from('reminders').update({ status: 'dismissed' }).eq('id', id)
      }
    } else {
      await supabase.from('reminders').update({ status: 'dismissed' }).eq('id', (reminder as Reminder).id)
    }
    fetchAll()
  }

  // Complete reminder
  const completeReminder = async (reminder: Reminder | (AutoReminder & { isAuto?: boolean })) => {
    if ('isAuto' in reminder && reminder.isAuto) {
      const id = await createReminder(reminder as AutoReminder)
      if (id) {
        await supabase.from('reminders').update({ status: 'completed' }).eq('id', id)
      }
    } else {
      await supabase.from('reminders').update({ status: 'completed' }).eq('id', (reminder as Reminder).id)
    }
    fetchAll()
  }

  // Snooze reminder
  const snoozeReminder = async () => {
    if (!selectedReminder) return
    setSaving(true)

    const snoozeUntil = new Date()
    snoozeUntil.setDate(snoozeUntil.getDate() + parseInt(snoozeDays))
    const snoozeDate = snoozeUntil.toISOString().split('T')[0]

    if ('isAuto' in selectedReminder && selectedReminder.isAuto) {
      const id = await createReminder(selectedReminder as AutoReminder)
      if (id) {
        await supabase.from('reminders').update({ 
          status: 'snoozed',
          snoozed_until: snoozeDate,
        }).eq('id', id)
      }
    } else {
      await supabase.from('reminders').update({ 
        status: 'snoozed',
        snoozed_until: snoozeDate,
      }).eq('id', (selectedReminder as Reminder).id)
    }

    setSaving(false)
    setSnoozeModalOpen(false)
    setSelectedReminder(null)
    fetchAll()
  }

  // Regenerate reminders (clear dismissed and refresh)
  const regenerateReminders = async () => {
    if (!confirm('This will clear all dismissed reminders and regenerate them. Continue?')) return
    await supabase.from('reminders').delete().eq('status', 'dismissed')
    fetchAll()
  }

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Reminders</h1>
          {stats.total > 0 && (
            <span className="bg-red-500 text-white text-sm font-bold px-2.5 py-1 rounded-full">
              {stats.total}
            </span>
          )}
        </div>
        <button onClick={regenerateReminders} className="btn-secondary">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Stats by Type */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => setFilterType(filterType === 'quote_followup' ? 'all' : 'quote_followup')}
          className={`rounded-xl p-4 text-left transition-all ${
            filterType === 'quote_followup' 
              ? 'bg-amber-500 text-white ring-2 ring-amber-300' 
              : 'bg-white border border-slate-200 hover:border-slate-300'
          }`}
        >
          <FileText className={`w-5 h-5 mb-2 ${filterType === 'quote_followup' ? 'text-white' : 'text-amber-500'}`} />
          <div className={`text-2xl font-bold ${filterType === 'quote_followup' ? 'text-white' : 'text-slate-900'}`}>
            {stats.byType.quote_followup}
          </div>
          <div className={`text-sm ${filterType === 'quote_followup' ? 'text-white/80' : 'text-slate-500'}`}>
            Quote Follow-ups
          </div>
        </button>

        <button
          onClick={() => setFilterType(filterType === 'pipeline_stale' ? 'all' : 'pipeline_stale')}
          className={`rounded-xl p-4 text-left transition-all ${
            filterType === 'pipeline_stale' 
              ? 'bg-blue-500 text-white ring-2 ring-blue-300' 
              : 'bg-white border border-slate-200 hover:border-slate-300'
          }`}
        >
          <GitBranch className={`w-5 h-5 mb-2 ${filterType === 'pipeline_stale' ? 'text-white' : 'text-blue-500'}`} />
          <div className={`text-2xl font-bold ${filterType === 'pipeline_stale' ? 'text-white' : 'text-slate-900'}`}>
            {stats.byType.pipeline_stale}
          </div>
          <div className={`text-sm ${filterType === 'pipeline_stale' ? 'text-white/80' : 'text-slate-500'}`}>
            Stale Deals
          </div>
        </button>

        <button
          onClick={() => setFilterType(filterType === 'task_overdue' ? 'all' : 'task_overdue')}
          className={`rounded-xl p-4 text-left transition-all ${
            filterType === 'task_overdue' 
              ? 'bg-red-500 text-white ring-2 ring-red-300' 
              : 'bg-white border border-slate-200 hover:border-slate-300'
          }`}
        >
          <CheckSquare className={`w-5 h-5 mb-2 ${filterType === 'task_overdue' ? 'text-white' : 'text-red-500'}`} />
          <div className={`text-2xl font-bold ${filterType === 'task_overdue' ? 'text-white' : 'text-slate-900'}`}>
            {stats.byType.task_overdue}
          </div>
          <div className={`text-sm ${filterType === 'task_overdue' ? 'text-white/80' : 'text-slate-500'}`}>
            Overdue Tasks
          </div>
        </button>

        <button
          onClick={() => setFilterType(filterType === 'custom' ? 'all' : 'custom')}
          className={`rounded-xl p-4 text-left transition-all ${
            filterType === 'custom' 
              ? 'bg-purple-500 text-white ring-2 ring-purple-300' 
              : 'bg-white border border-slate-200 hover:border-slate-300'
          }`}
        >
          <Bell className={`w-5 h-5 mb-2 ${filterType === 'custom' ? 'text-white' : 'text-purple-500'}`} />
          <div className={`text-2xl font-bold ${filterType === 'custom' ? 'text-white' : 'text-slate-900'}`}>
            {stats.byType.custom}
          </div>
          <div className={`text-sm ${filterType === 'custom' ? 'text-white/80' : 'text-slate-500'}`}>
            Custom
          </div>
        </button>
      </div>

      {/* Filter controls */}
      <div className="flex items-center gap-4">
        {filterType !== 'all' && (
          <button 
            onClick={() => setFilterType('all')}
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            <X className="w-4 h-4" /> Clear filter
          </button>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-500 ml-auto">
          <input
            type="checkbox"
            checked={showDismissed}
            onChange={(e) => setShowDismissed(e.target.checked)}
            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          Show dismissed
        </label>
      </div>

      {/* Reminders List */}
      <div className="space-y-3">
        {allReminders.length === 0 ? (
          <div className="card text-center py-12">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No reminders right now</p>
            <p className="text-sm text-slate-400 mt-1">You&apos;re all caught up!</p>
          </div>
        ) : (
          allReminders.map((reminder, index) => {
            const Icon = REMINDER_ICONS[reminder.type as ReminderType] || Bell
            const colorClass = REMINDER_COLORS[reminder.type as ReminderType] || 'bg-slate-100 text-slate-600'
            const isAuto = 'isAuto' in reminder && reminder.isAuto
            const isDismissed = reminder.status === 'dismissed'

            return (
              <div 
                key={isAuto ? `auto-${index}` : (reminder as Reminder).id}
                className={`card flex items-start gap-4 ${isDismissed ? 'opacity-50' : ''}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                  <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-900">{reminder.title}</h3>
                      {reminder.description && (
                        <p className="text-sm text-slate-500 mt-0.5">{reminder.description}</p>
                      )}
                    </div>
                    {isAuto && (
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full flex-shrink-0">
                        Auto
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {isAuto 
                        ? 'Due today' 
                        : `Due: ${(reminder as Reminder).due_date || 'Not set'}`
                      }
                    </span>
                    {reminder.status === 'snoozed' && (reminder as Reminder).snoozed_until && (
                      <span className="text-amber-600">
                        (Snoozed until {(reminder as Reminder).snoozed_until})
                      </span>
                    )}
                  </div>
                </div>

                {!isDismissed && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => completeReminder(reminder)}
                      className="p-2 hover:bg-emerald-100 rounded-lg text-emerald-600 transition-colors"
                      title="Mark complete"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setSelectedReminder(reminder); setSnoozeModalOpen(true) }}
                      className="p-2 hover:bg-amber-100 rounded-lg text-amber-600 transition-colors"
                      title="Snooze"
                    >
                      <Calendar className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => dismissReminder(reminder)}
                      className="p-2 hover:bg-red-100 rounded-lg text-red-500 transition-colors"
                      title="Dismiss"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Snooze Modal */}
      <Modal open={snoozeModalOpen} onClose={() => setSnoozeModalOpen(false)} title="Snooze Reminder">
        {selectedReminder && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <h3 className="font-medium text-slate-900">{selectedReminder.title}</h3>
              {selectedReminder.description && (
                <p className="text-sm text-slate-500 mt-1">{selectedReminder.description}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Snooze for</label>
              <div className="grid grid-cols-3 gap-2">
                {['1', '3', '7'].map(days => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setSnoozeDays(days)}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                      snoozeDays === days 
                        ? 'bg-teal-600 text-white' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {days} day{days !== '1' ? 's' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setSnoozeModalOpen(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={snoozeReminder} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving...' : 'Snooze'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
