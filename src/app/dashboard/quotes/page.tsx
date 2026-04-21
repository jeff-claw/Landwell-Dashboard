'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { formatZAR, REGIONS } from '@/lib/utils'
import { Plus, FileDown } from 'lucide-react'

type Quote = {
  id: string
  quote_number: string
  client_name: string
  project_title: string
  status: string
  currency: string
  total: number
  region: string
  include_installation: boolean
  date: string
  due_date: string | null
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadQuotes() }, [])

  const loadQuotes = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('quotes').select('*').order('created_at', { ascending: false })
    setQuotes(data || [])
    setLoading(false)
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotes</h1>
          <p className="text-sm text-gray-500 mt-1">{quotes.length} quotes</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="h-4 w-4" /> New Quote
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading quotes...</div>
      ) : quotes.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No quotes found</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Quote #</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Client</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Project</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Total</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Region</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quotes.map((q) => (
                  <tr key={q.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{q.quote_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{q.client_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{q.project_title}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatZAR(q.total)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{q.region}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        q.status === 'Accepted' ? 'bg-green-100 text-green-800' :
                        q.status === 'Sent' ? 'bg-blue-100 text-blue-800' :
                        q.status === 'Draft' ? 'bg-gray-100 text-gray-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>{q.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}