'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'

type Ticket = { id: string; device_serial: string | null; issue_type: string; priority: string; status: string; subject: string; description: string; created_at: string }

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadTickets() }, [])

  const loadTickets = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('tickets').select('*').order('created_at', { ascending: false })
    setTickets(data || [])
    setLoading(false)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
        <p className="text-sm text-gray-500 mt-1">{tickets.length} tickets</p>
      </div>
      {loading ? <div className="text-center py-12 text-gray-500">Loading...</div> : (
        <div className="grid gap-4">
          {tickets.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{t.subject}</h3>
                  <p className="text-sm text-gray-600 mt-1">{t.description}</p>
                  {t.device_serial && <p className="text-xs text-gray-500 mt-1">Serial: {t.device_serial}</p>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${t.priority === 'High' ? 'bg-red-100 text-red-800' : t.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>{t.priority}</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${t.status === 'Resolved' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{t.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
