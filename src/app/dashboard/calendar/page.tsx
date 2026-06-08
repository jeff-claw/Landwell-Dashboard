'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CalendarEvent } from '@/lib/types'
import { Plus, X, ChevronLeft, ChevronRight, Clock, Trash2, Download } from 'lucide-react'
import { toast } from 'sonner'

// Generate .ics file content for calendar export
function generateICS(event: { title: string; description?: string; start_time: string; end_time?: string }): string {
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  }
  
  const start = formatDate(event.start_time)
  const end = event.end_time ? formatDate(event.end_time) : formatDate(new Date(new Date(event.start_time).getTime() + 60 * 60 * 1000).toISOString())
  const now = formatDate(new Date().toISOString())
  const uid = `${Date.now()}@landwellafrica.co.za`
  
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Landwell Africa//Dashboard//EN
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${now}
DTSTART:${start}
DTEND:${end}
SUMMARY:${event.title}
DESCRIPTION:${event.description || ''}
END:VEVENT
END:VCALENDAR`
}

function downloadICS(event: { title: string; description?: string; start_time: string; end_time?: string }) {
  const icsContent = generateICS(event)
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${event.title.replace(/[^a-z0-9]/gi, '_')}.ics`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  toast.success('Calendar file downloaded - open it to add to your calendar')
}

const EVENT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  meeting: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  call: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  demo: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  follow_up: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  other: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-500' },
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

interface EventForm {
  title: string
  description: string
  start_time: string
  end_time: string
  event_type: string
  client_id: string
}

const getEmptyForm = (date?: Date): EventForm => {
  const d = date || new Date()
  const dateStr = d.toISOString().split('T')[0]
  return {
    title: '',
    description: '',
    start_time: `${dateStr}T09:00`,
    end_time: `${dateStr}T10:00`,
    event_type: 'meeting',
    client_id: '',
  }
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<EventForm>(getEmptyForm())
  const [saving, setSaving] = useState(false)
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)

  const supabase = createClient()

  const fetchEvents = async () => {
    const { data } = await supabase.from('calendar_events').select('*').order('start_time', { ascending: true })
    setEvents(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchEvents()
    const fetchClients = async () => {
      const { data } = await supabase.from('clients').select('id, name').order('name')
      setClients(data || [])
    }
    fetchClients()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Calendar grid calculation
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPadding = firstDay.getDay()
    const totalDays = lastDay.getDate()
    
    const days: { date: Date; isCurrentMonth: boolean }[] = []
    
    // Previous month padding
    for (let i = startPadding - 1; i >= 0; i--) {
      const d = new Date(year, month, -i)
      days.push({ date: d, isCurrentMonth: false })
    }
    
    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true })
    }
    
    // Next month padding to complete the grid
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false })
    }
    
    return days
  }, [currentDate])

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    // Use local date comparison (YYYY-MM-DD) to avoid timezone issues
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const localDateStr = `${year}-${month}-${day}`
    
    return events.filter(e => {
      if (!e.start_time) return false
      // Parse the event date and compare using local date
      const eventDate = new Date(e.start_time)
      const eventYear = eventDate.getFullYear()
      const eventMonth = String(eventDate.getMonth() + 1).padStart(2, '0')
      const eventDay = String(eventDate.getDate()).padStart(2, '0')
      const eventLocalDateStr = `${eventYear}-${eventMonth}-${eventDay}`
      return eventLocalDateStr === localDateStr
    })
  }

  // Navigation
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  const goToToday = () => setCurrentDate(new Date())

  // Handle date click
  const handleDateClick = (date: Date) => {
    setForm(getEmptyForm(date))
    setEditingEvent(null)
    setShowForm(true)
  }

  // Handle event click
  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingEvent(event)
    setForm({
      title: event.title || '',
      description: event.description || '',
      start_time: event.start_time?.slice(0, 16) || '',
      end_time: event.end_time?.slice(0, 16) || '',
      event_type: event.event_type || 'meeting',
      client_id: event.client_id || '',
    })
    setShowForm(true)
  }

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title) {
      toast.error('Title is required')
      return
    }

    setSaving(true)

    const eventData = {
      title: form.title,
      description: form.description || null,
      start_time: form.start_time,
      end_time: form.end_time || null,
      event_type: form.event_type,
      client_id: form.client_id || null,
    }

    if (editingEvent) {
      const { error } = await supabase
        .from('calendar_events')
        .update(eventData)
        .eq('id', editingEvent.id)
      
      if (error) {
        toast.error('Failed to update event')
        console.error(error)
      } else {
        toast.success('Event updated')
      }
    } else {
      const { error } = await supabase.from('calendar_events').insert(eventData)
      
      if (error) {
        toast.error('Failed to create event')
        console.error(error)
      } else {
        toast.success('Event created')
      }
    }

    setSaving(false)
    setShowForm(false)
    setForm(getEmptyForm())
    setEditingEvent(null)
    fetchEvents()
  }

  // Delete event
  const handleDelete = async () => {
    if (!editingEvent) return
    if (!confirm('Delete this event?')) return

    const { error } = await supabase.from('calendar_events').delete().eq('id', editingEvent.id)
    
    if (error) {
      toast.error('Failed to delete event')
    } else {
      toast.success('Event deleted')
      setShowForm(false)
      setEditingEvent(null)
      fetchEvents()
    }
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Calendar</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            Today
          </button>
          <button
            onClick={() => {
              setForm(getEmptyForm(new Date()))
              setEditingEvent(null)
              setShowForm(true)
            }}
            className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700"
          >
            <Plus className="w-4 h-4" /> Add Event
          </button>
        </div>
      </div>

      {/* Calendar Navigation */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h2 className="text-lg font-semibold text-slate-900">
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-200">
          {DAYS.map(day => (
            <div key={day} className="p-2 text-center text-xs font-semibold text-slate-500 uppercase">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map(({ date, isCurrentMonth }, index) => {
            const dayEvents = getEventsForDate(date)
            const isCurrentDay = isToday(date)
            
            return (
              <div
                key={index}
                onClick={() => handleDateClick(date)}
                className={`min-h-[80px] sm:min-h-[100px] p-1 border-b border-r border-slate-100 cursor-pointer transition hover:bg-slate-50 ${
                  !isCurrentMonth ? 'bg-slate-50/50' : ''
                }`}
              >
                <div className={`text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full ${
                  isCurrentDay 
                    ? 'bg-teal-600 text-white' 
                    : isCurrentMonth 
                      ? 'text-slate-900' 
                      : 'text-slate-400'
                }`}>
                  {date.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map(event => {
                    const colors = EVENT_COLORS[event.event_type] || EVENT_COLORS.other
                    return (
                      <div
                        key={event.id}
                        onClick={(e) => handleEventClick(event, e)}
                        className={`px-1.5 py-0.5 rounded text-xs font-medium truncate ${colors.bg} ${colors.text} hover:opacity-80 transition`}
                      >
                        {event.title}
                      </div>
                    )
                  })}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-slate-500 px-1">+{dayEvents.length - 3} more</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Upcoming Events</h3>
        <div className="space-y-3">
          {events
            .filter(e => new Date(e.start_time) >= new Date())
            .slice(0, 5)
            .map(event => {
              const colors = EVENT_COLORS[event.event_type] || EVENT_COLORS.other
              return (
                <div
                  key={event.id}
                  onClick={(e) => handleEventClick(event, e)}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition"
                >
                  <div className={`w-2 h-2 rounded-full mt-2 ${colors.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-900 truncate">{event.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      {new Date(event.start_time).toLocaleDateString('en-ZA', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {' · '}
                      {new Date(event.start_time).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      downloadICS({
                        title: event.title,
                        description: event.description,
                        start_time: event.start_time,
                        end_time: event.end_time,
                      })
                    }}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Add to Calendar"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          {events.filter(e => new Date(e.start_time) >= new Date()).length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">No upcoming events</p>
          )}
        </div>
      </div>

      {/* Event Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingEvent ? 'Edit Event' : 'New Event'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Meeting with client..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start</label>
                  <input
                    type="datetime-local"
                    value={form.start_time}
                    onChange={e => setForm({ ...form, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End</label>
                  <input
                    type="datetime-local"
                    value={form.end_time}
                    onChange={e => setForm({ ...form, end_time: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select
                    value={form.event_type}
                    onChange={e => setForm({ ...form, event_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="meeting">Meeting</option>
                    <option value="call">Call</option>
                    <option value="demo">Demo</option>
                    <option value="follow_up">Follow-up</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Client</label>
                  <select
                    value={form.client_id}
                    onChange={e => setForm({ ...form, client_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">None</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder="Meeting notes..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  {editingEvent && (
                    <>
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadICS({
                          title: form.title,
                          description: form.description,
                          start_time: form.start_time,
                          end_time: form.end_time,
                        })}
                        className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium transition"
                      >
                        <Download className="w-4 h-4" />
                        Add to Calendar
                      </button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition"
                  >
                    {saving ? 'Saving...' : editingEvent ? 'Update' : 'Create Event'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
