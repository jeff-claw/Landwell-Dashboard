'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Megaphone, Plus, Trash2, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Channel = { key: string; label: string; priority: number; status: string; note: string | null }
type Task = {
  id: string
  title: string
  detail: string | null
  channel: string | null
  status: string
  assignee: string | null
  due_date: string | null
  week_of: string | null
}

const CHANNEL_STATUS = ['not_started', 'active', 'done', 'blocked']
const TASK_STATUS = ['todo', 'in_progress', 'blocked', 'done']
const CHANNEL_OPTIONS = ['expo', 'warm_quotes', 'linkedin', 'google_business', 'youtube', 'other']

const statusColor: Record<string, string> = {
  not_started: 'bg-slate-100 text-slate-600',
  active: 'bg-blue-100 text-blue-700',
  done: 'bg-emerald-100 text-emerald-700',
  blocked: 'bg-red-100 text-red-700',
  todo: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
}

const SETUP_SQL = `-- Run in Supabase → SQL Editor (also in repo: supabase/marketing_tables.sql)
-- Creates marketing_tasks + marketing_channels (with RLS + the 5 seeded channels).`

export default function MarketingPage() {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [channels, setChannels] = useState<Channel[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [quoteStats, setQuoteStats] = useState<{ total: number; sent: number; accepted: number }>({ total: 0, sent: 0, accepted: 0 })
  const [newTask, setNewTask] = useState({ title: '', channel: 'expo', assignee: 'Verushka', due_date: '', status: 'todo' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const ch = await supabase.from('marketing_channels').select('*').order('priority')
      // Any error here means the tables aren't set up yet → show the setup panel.
      if (ch.error) {
        setSetupNeeded(true)
        return
      }
      setChannels((ch.data as Channel[]) || [])
      const tk = await supabase.from('marketing_tasks').select('*').order('created_at', { ascending: false })
      setTasks((tk.data as Task[]) || [])
      const q = await supabase.from('quotes').select('status')
      if (!q.error && q.data) {
        const rows = q.data as { status: string }[]
        const norm = (s: string) => (s || '').toLowerCase()
        setQuoteStats({
          total: rows.length,
          sent: rows.filter(r => norm(r.status) === 'sent').length,
          accepted: rows.filter(r => norm(r.status) === 'accepted' || norm(r.status) === 'approved').length,
        })
      }
    } catch {
      setSetupNeeded(true)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { load() }, [load])

  const setChannelStatus = async (key: string, status: string) => {
    setChannels(cs => cs.map(c => (c.key === key ? { ...c, status } : c)))
    await supabase.from('marketing_channels').update({ status, updated_at: new Date().toISOString() }).eq('key', key)
  }

  const setTaskStatus = async (id: string, status: string) => {
    setTasks(ts => ts.map(t => (t.id === id ? { ...t, status } : t)))
    await supabase.from('marketing_tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  }

  const addTask = async () => {
    if (!newTask.title.trim()) return
    const { data } = await supabase
      .from('marketing_tasks')
      .insert({
        title: newTask.title.trim(),
        channel: newTask.channel,
        assignee: newTask.assignee || null,
        due_date: newTask.due_date || null,
        status: newTask.status,
      })
      .select()
      .single()
    if (data) setTasks(ts => [data as Task, ...ts])
    setNewTask({ title: '', channel: 'expo', assignee: 'Verushka', due_date: '', status: 'todo' })
  }

  const deleteTask = async (id: string) => {
    setTasks(ts => ts.filter(t => t.id !== id))
    await supabase.from('marketing_tasks').delete().eq('id', id)
  }

  const openTasks = tasks.filter(t => t.status !== 'done').length
  const doneTasks = tasks.filter(t => t.status === 'done').length

  if (loading) {
    return <div className="max-w-5xl mx-auto"><p className="text-soft text-sm">Loading marketing…</p></div>
  }

  if (setupNeeded) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <Megaphone className="w-6 h-6 text-teal-600" />
          <h1 className="text-2xl font-bold text-strong">Marketing</h1>
        </div>
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5">
          <h2 className="font-semibold text-amber-900 mb-2">One-time setup needed</h2>
          <p className="text-sm text-amber-800 mb-3">
            The marketing tables don&apos;t exist yet. Run <code className="bg-amber-100 px-1 rounded">supabase/marketing_tables.sql</code> in
            Supabase → SQL Editor, then refresh this page.
          </p>
          <pre className="text-xs bg-amber-100 text-amber-900 rounded p-3 overflow-x-auto whitespace-pre-wrap">{SETUP_SQL}</pre>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Megaphone className="w-6 h-6 text-teal-600" />
        <h1 className="text-2xl font-bold text-strong">Marketing</h1>
      </div>

      {/* Status line — what Morne sees */}
      <div className="bg-surface border border-line rounded-xl p-4 flex flex-wrap gap-6">
        <div><div className="text-2xl font-bold text-strong">{openTasks}</div><div className="text-xs text-soft">Open tasks</div></div>
        <div><div className="text-2xl font-bold text-strong">{doneTasks}</div><div className="text-xs text-soft">Done</div></div>
        <div><div className="text-2xl font-bold text-strong">{channels.filter(c => c.status === 'active').length}</div><div className="text-xs text-soft">Active channels</div></div>
        <div><div className="text-2xl font-bold text-strong">{quoteStats.sent}</div><div className="text-xs text-soft">Warm quotes (sent)</div></div>
      </div>

      {/* Channels */}
      <section>
        <h2 className="text-sm font-semibold text-soft uppercase tracking-wide mb-3">Channel priorities</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {channels.map(c => (
            <div key={c.key} className="bg-surface border border-line rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-soft">Priority {c.priority}</div>
                  <div className="font-semibold text-strong">{c.label}</div>
                  {c.note && <div className="text-xs text-soft mt-1">{c.note}</div>}
                </div>
                <select
                  value={c.status}
                  onChange={e => setChannelStatus(c.key, e.target.value)}
                  className={`text-xs font-medium px-2 py-1 rounded-full border-0 ${statusColor[c.status] || 'bg-slate-100 text-slate-600'}`}
                >
                  {CHANNEL_STATUS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
              {c.key === 'warm_quotes' && (
                <Link href="/quotes" className="text-xs text-teal-600 hover:underline inline-flex items-center gap-1 mt-2">
                  {quoteStats.sent} sent · {quoteStats.accepted} won · {quoteStats.total} total <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Tasks */}
      <section>
        <h2 className="text-sm font-semibold text-soft uppercase tracking-wide mb-3">Tasks (Verushka brief)</h2>
        <div className="bg-surface border border-line rounded-xl p-4 mb-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
            <input
              value={newTask.title}
              onChange={e => setNewTask({ ...newTask, title: e.target.value })}
              placeholder="New task…"
              onKeyDown={e => { if (e.key === 'Enter') addTask() }}
              className="px-3 py-2 border border-line rounded-lg text-sm bg-surface text-strong focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <select value={newTask.channel} onChange={e => setNewTask({ ...newTask, channel: e.target.value })} className="px-2 py-2 border border-line rounded-lg text-sm bg-surface text-body">
              {CHANNEL_OPTIONS.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </select>
            <input value={newTask.assignee} onChange={e => setNewTask({ ...newTask, assignee: e.target.value })} placeholder="Assignee" className="px-2 py-2 border border-line rounded-lg text-sm bg-surface text-body w-28" />
            <input type="date" value={newTask.due_date} onChange={e => setNewTask({ ...newTask, due_date: e.target.value })} className="px-2 py-2 border border-line rounded-lg text-sm bg-surface text-body" />
            <button onClick={addTask} className="inline-flex items-center gap-1 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </div>

        {tasks.length === 0 ? (
          <p className="text-soft text-sm">No tasks yet. Add the first one above (or ANT will populate the Monday brief).</p>
        ) : (
          <div className="space-y-2">
            {tasks.map(t => (
              <div key={t.id} className="bg-surface border border-line rounded-xl p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className={`font-medium text-strong truncate ${t.status === 'done' ? 'line-through text-soft' : ''}`}>{t.title}</div>
                  <div className="text-xs text-soft">
                    {t.channel?.replace('_', ' ')}{t.assignee ? ` · ${t.assignee}` : ''}{t.due_date ? ` · due ${t.due_date}` : ''}
                  </div>
                </div>
                <select
                  value={t.status}
                  onChange={e => setTaskStatus(t.id, e.target.value)}
                  className={`text-xs font-medium px-2 py-1 rounded-full border-0 ${statusColor[t.status] || 'bg-slate-100 text-slate-600'}`}
                >
                  {TASK_STATUS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
                <button onClick={() => deleteTask(t.id)} className="text-soft hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Weekly loop reference */}
      <section>
        <h2 className="text-sm font-semibold text-soft uppercase tracking-wide mb-3">Weekly loop (ANT ↔ Verushka)</h2>
        <div className="bg-surface border border-line rounded-xl p-4 text-sm text-body grid gap-2 sm:grid-cols-3">
          <div><span className="font-semibold text-strong">Mon 08:00</span> — ANT WhatsApps brief (3 tasks, drafts, ~8h cap)</div>
          <div><span className="font-semibold text-strong">Wed 12:00</span> — mid-week check-in (done/blocked?)</div>
          <div><span className="font-semibold text-strong">Fri 16:00</span> — ANT reviews + posts one status line</div>
        </div>
        <p className="text-xs text-soft mt-2">24h no reply → nudge · 48h → escalate to Morne. Execution runs in ANT (WhatsApp); this page is the cockpit.</p>
      </section>
    </div>
  )
}
