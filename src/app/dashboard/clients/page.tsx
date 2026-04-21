'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { formatZAR } from '@/lib/utils'
import { Plus, Search } from 'lucide-react'

type Client = { id: string; name: string; type: string; contact_person: string; email: string; phone: string; vat_number: string; notes: string }

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { loadClients() }, [])

  const loadClients = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('clients').select('*').order('name')
    setClients(data || [])
    setLoading(false)
  }

  const filtered = clients.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-1">{filtered.length} clients</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900" />
          </div>
        </div>
      </div>
      {loading ? <div className="text-center py-12 text-gray-500">Loading...</div> : filtered.length === 0 ? <div className="text-center py-12 text-gray-500">No clients found</div> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full"><thead className="bg-gray-50 border-b border-gray-200"><tr>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Name</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Contact</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Email</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Type</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">VAT</th>
            </tr></thead><tbody className="divide-y divide-gray-100">
              {filtered.map(c => <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{c.contact_person}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{c.email}</td>
                <td className="px-4 py-3"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{c.type}</span></td>
                <td className="px-4 py-3 text-sm text-gray-600">{c.vat_number}</td>
              </tr>)}
            </tbody></table>
          </div>
        </div>
      )}
    </div>
  )
}
