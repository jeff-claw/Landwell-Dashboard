'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Task } from '@/lib/types'
import { Plus, X, CheckCircle2, Circle, Clock } from 'lucide-react'

type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
type TaskStatus = 'todo' | 'in_progress' | 'done'

const emptyTask: { title: string; description: string; priority: TaskPriority; status: TaskStatus; due_date: string } = { 
  title: '', 
  description: '', 
  priority: 'medium', 
  status: 'todo', 
  due_date: '' 
}

const priorityColors: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
}

const statusIcons: Record<string, typeof Circle> = {
  todo: Circle,
  in_progress: Clock,
  done: CheckCircle2,
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyTask)
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  const fetchTasks = async () => {
    const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false })
    setTasks(data || [])
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchTasks() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await supabase.from('tasks').insert(form)
    setSaving(false)
    setShowForm(false)
    setForm(emptyTask)
    fetchTasks()
  }

  const toggleStatus = async (task: Task) => {
    const nextStatus = task.status === 'todo' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'todo'
    await supabase.from('tasks').update({ status: nextStatus }).eq('id', task.id)
    fetchTasks()
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700">
          <Plus className="w-4 h-4" /> Add Task
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">New Task</h2>
            <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-slate-400" /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value as Task['priority']})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div className="md:col-span-2 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
              <button type="submit" disabled={saving} className="bg-teal-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-2">
        {tasks.map((task) => {
          const StatusIcon = statusIcons[task.status] || Circle
          return (
            <div key={task.id} className={`bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3 ${task.status === 'done' ? 'opacity-60' : ''}`}>
              <button onClick={() => toggleStatus(task)} className={`mt-0.5 ${task.status === 'done' ? 'text-green-500' : task.status === 'in_progress' ? 'text-blue-500' : 'text-slate-300'}`}>
                <StatusIcon className="w-5 h-5" />
              </button>
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900'}`}>{task.title}</p>
                {task.description && <p className="text-xs text-slate-500 mt-1">{task.description}</p>}
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityColors[task.priority]}`}>{task.priority}</span>
                  {task.due_date && <span className="text-xs text-slate-400">{new Date(task.due_date).toLocaleDateString()}</span>}
                </div>
              </div>
            </div>
          )
        })}
        {tasks.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">No tasks yet</div>
        )}
      </div>
    </div>
  )
}
