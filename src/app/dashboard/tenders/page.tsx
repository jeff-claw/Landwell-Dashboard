'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { formatZAR } from '@/lib/utils'

type Tender = { id: string; title: string; client: string; source: string | null; estimated_value: number | null; closing_date: string; status: string; category: string }

export default function TendersPage() {
  const [tenders, setTenders] = useState<Tender[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadTenders() }, [])

  const loadTenders = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('tenders').select('*').order('closing_date')
    setTenders(data || [])
    setLoading(false)
  }

  const closingSoon = tenders.filter(t => {
    const days = (new Date(t.closing_date).getTime() - Date.now()) / 86400000
    return days > 0 && days <= 7
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tenders</h1>
        <p className="text-sm text-gray-500 mt-1">{tenders.length} tenders · {closingSoon.length} closing soon</p>
      </div>
      {closingSoon.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-medium text-yellow-800">⏰ {closingSoon.length} tenders closing within 7 days</p>
        </div>
      )}
      {loading ? <div className="text-center py-12 text-gray-500">Loading...</div> : (
        <div className="grid gap-4">
          {tenders.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{t.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{t.client} · {t.category}</p>
                </div>
                <div className="flex items-center gap-3">
                  {t.estimated_value && <span className="text-sm font-medium">{formatZAR(t.estimated_value)}</span>}
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    t.status === 'Won' ? 'bg-green-100 text-green-800' :
                    t.status === 'Lost' || t.status === 'Closed' ? 'bg-red-100 text-red-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>{t.status}</span>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">Closes: {new Date(t.closing_date).toLocaleDateString('en-ZA')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
