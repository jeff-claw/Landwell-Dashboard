'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { formatZAR, PIPELINE_STATUSES } from '@/lib/utils'
import { Plus, Filter } from 'lucide-react'

type PipelineEntry = {
  id: string
  client_id: string
  client_name: string
  status: string
  value_estimate: number | null
  probability: number
  quotes_status: string
  notes: string | null
  created_at: string
}

export default function PipelinePage() {
  const [entries, setEntries] = useState<PipelineEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    loadPipeline()
  }, [])

  const loadPipeline = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('pipeline').select('*').order('created_at', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  const filtered = entries.filter(e =>
    !filter || e.status === filter ||
    e.client_name?.toLowerCase().includes(filter.toLowerCase())
  )

  const totalValue = filtered.reduce((sum, e) => sum + (e.value_estimate || 0), 0)

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
          <p className="text-sm text-gray-500 mt-1">{filtered.length} entries · Total value: {formatZAR(totalValue)}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
          >
            <option value="">All statuses</option>
            {PIPELINE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading pipeline...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No pipeline entries found</div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((entry) => (
            <div key={entry.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{entry.client_name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{entry.notes || 'No notes'}</p>
                </div>
                <div className="flex items-center gap-3">
                  {entry.value_estimate && (
                    <span className="text-sm font-medium text-gray-900">{formatZAR(entry.value_estimate)}</span>
                  )}
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    entry.status === 'Won' ? 'bg-green-100 text-green-800' :
                    entry.status === 'Lost' ? 'bg-red-100 text-red-800' :
                    entry.status === 'Quote Sent' ? 'bg-blue-100 text-blue-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {entry.status}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                <span>Probability: {entry.probability}%</span>
                <span>Quotes: {entry.quotes_status || 'None'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}