'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'

type Formula = { id: string; exchange_rate: number; shipping_multiplier: number; delivery_percent: number; gp_divisor: number; end_user_divisor: number; region_markups: Record<string, number>; updated_at: string }
type Profile = { id: string; email: string; full_name: string; role: string; status: string }

export default function SettingsPage() {
  const [formula, setFormula] = useState<Formula | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const supabase = createClient()
    const { data: f } = await supabase.from('formula').select('*').single()
    setFormula(f)
    const { data: p } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setProfiles(p || [])
    setLoading(false)
  }

  const pendingUsers = profiles.filter(p => p.status === 'pending')

  const approveUser = async (id: string) => {
    const supabase = createClient()
    await supabase.from('profiles').update({ status: 'approved' }).eq('id', id)
    loadData()
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      </div>
      {loading ? <div className="text-center py-12 text-gray-500">Loading...</div> : (
        <div className="space-y-6">
          {pendingUsers.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Pending Users</h2>
              <div className="space-y-2">
                {pendingUsers.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-2 py-2">
                    <div><span className="text-sm font-medium">{p.full_name}</span><span className="text-sm text-gray-500 ml-2">{p.email}</span></div>
                    <button onClick={() => approveUser(p.id)} className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">Approve</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {formula && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Pricing Formula</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div><span className="text-gray-500">Exchange Rate</span><p className="font-medium">{formula.exchange_rate}</p></div>
                <div><span className="text-gray-500">Shipping Multiplier</span><p className="font-medium">{formula.shipping_multiplier}</p></div>
                <div><span className="text-gray-500">Delivery %</span><p className="font-medium">{formula.delivery_percent}%</p></div>
                <div><span className="text-gray-500">GP Divisor</span><p className="font-medium">{formula.gp_divisor}</p></div>
                <div><span className="text-gray-500">End User Divisor</span><p className="font-medium">{formula.end_user_divisor}</p></div>
              </div>
              {formula.region_markups && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Region Markups</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                    {Object.entries(formula.region_markups).map(([region, markup]) => (
                      <div key={region}><span className="text-gray-500">{region}</span><p className="font-medium">{markup}%</p></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 mb-3">Users</h2>
            <div className="space-y-2">
              {profiles.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div><span className="text-sm font-medium">{p.full_name}</span><span className="text-sm text-gray-500 ml-2">{p.email}</span></div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${p.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{p.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
