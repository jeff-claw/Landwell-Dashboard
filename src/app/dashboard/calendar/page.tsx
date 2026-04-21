'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'

type Event = { id: string; title: string; description: string; event_type: string; start_date: string; end_date: string; all_day: boolean; color: string | null }

export default function CalendarPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadEvents() }, [])

  const loadEvents = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('calendar_events').select('*').order('start_date')
    setEvents(data || [])
    setLoading(false)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        <p className="text-sm text-gray-500 mt-1">{events.length} events</p>
      </div>
      {loading ? <div className="text-center py-12 text-gray-500">Loading...</div> : (
        <div className="grid gap-4">
          {events.map(e => (
            <div key={e.id} className="bg-white rounded-xl border border-gray-200 p-4 flex gap-3">
              <div className="w-1 rounded-full shrink-0" style={{ backgroundColor: e.color || '#3B82F6' }} />
              <div>
                <h3 className="font-semibold text-gray-900">{e.title}</h3>
                <p className="text-xs text-gray-500 mt-1">{e.event_type} · {new Date(e.start_date).toLocaleDateString('en-ZA')}</p>
                {e.description && <p className="text-sm text-gray-600 mt-1">{e.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
