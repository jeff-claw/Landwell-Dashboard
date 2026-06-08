'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Formula } from '@/lib/types'
import { Save, Clock } from 'lucide-react'

export default function FormulaPage() {
  const [formula, setFormula] = useState<Formula | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [regionKey, setRegionKey] = useState('')
  const [regionValue, setRegionValue] = useState('')

  const supabase = createClient()

  const fetchFormula = useCallback(async () => {
    const { data } = await supabase.from('formula').select('*').limit(1).single()
    if (data) {
      setFormula(data)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchFormula()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = async () => {
    if (!formula) return
    setSaving(true)
    setSaved(false)

    await supabase.from('formula').update({
      exchange_rate: formula.exchange_rate,
      exchange_rate_updated_at: new Date().toISOString(),
      exchange_rate_source: 'manual',
      shipping_multiplier: formula.shipping_multiplier,
      delivery_percent: formula.delivery_percent,
      gp_divisor: formula.gp_divisor,
      end_user_divisor: formula.end_user_divisor,
      region_markups: formula.region_markups,
    }).eq('id', formula.id)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const addRegion = () => {
    if (!formula || !regionKey) return
    setFormula({
      ...formula,
      region_markups: { ...formula.region_markups, [regionKey]: Number(regionValue) || 0 },
    })
    setRegionKey('')
    setRegionValue('')
  }

  const removeRegion = (key: string) => {
    if (!formula) return
    const r = { ...formula.region_markups }
    delete r[key]
    setFormula({ ...formula, region_markups: r })
  }

  // Format relative time
  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    return `${diffDays}d ago`
  }

  // Preview calculation
  const preview = formula
    ? {
        zar: 100 * Number(formula.exchange_rate) * Number(formula.shipping_multiplier) * (1 + Number(formula.delivery_percent) / 100),
        reseller: 0,
        endUser: 0,
      }
    : null

  if (preview && formula) {
    preview.reseller = preview.zar / Number(formula.gp_divisor)
    preview.endUser = preview.reseller / Number(formula.end_user_divisor)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  if (!formula) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Pricing Formula</h1>
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
          No formula configured. Add a record to the formula table in Supabase.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Pricing Formula</h1>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Exchange Rate Card - MANUAL ONLY */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Exchange Rate (USD → ZAR)</h2>
            <div className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
              ✋ Manual
            </div>
          </div>
          
          {/* Manual Rate Input */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Exchange Rate (ZAR per $1 USD)
              </label>
              <input
                type="number"
                step="0.01"
                value={formula.exchange_rate}
                onChange={e => setFormula({ ...formula, exchange_rate: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="e.g. 18.50"
              />
            </div>
            
            {formula.exchange_rate_updated_at && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock className="w-3 h-3" />
                <span>Last updated {formatRelativeTime(formula.exchange_rate_updated_at)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Other Formula Settings */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Pricing Multipliers</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Shipping Multiplier</label>
              <input
                type="number"
                step="0.01"
                value={formula.shipping_multiplier}
                onChange={e => setFormula({ ...formula, shipping_multiplier: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Delivery %</label>
              <input
                type="number"
                step="1"
                value={formula.delivery_percent}
                onChange={e => setFormula({ ...formula, delivery_percent: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">GP Divisor</label>
              <input
                type="number"
                step="0.01"
                value={formula.gp_divisor}
                onChange={e => setFormula({ ...formula, gp_divisor: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <p className="text-xs text-slate-500 mt-1">Lower = higher margin (0.7 = 30%)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End User Divisor</label>
              <input
                type="number"
                step="0.01"
                value={formula.end_user_divisor}
                onChange={e => setFormula({ ...formula, end_user_divisor: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>

        {/* Region Markups */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Region Markups (%)</h2>
          <div className="space-y-2 mb-4">
            {Object.entries(formula.region_markups || {}).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg">
                <span className="font-medium text-slate-700">{key}</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600">{val}%</span>
                  <button onClick={() => removeRegion(key)} className="text-red-500 hover:text-red-700 text-sm">×</button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Region"
              value={regionKey}
              onChange={e => setRegionKey(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <input
              type="number"
              placeholder="%"
              value={regionValue}
              onChange={e => setRegionValue(e.target.value)}
              className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button onClick={addRegion} className="px-4 py-2 bg-slate-600 text-white rounded-lg text-sm hover:bg-slate-700">Add</button>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Formula Preview ($100 USD)</h2>
          {preview && (
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-600">After shipping + delivery</span>
                <span className="font-semibold text-slate-900">R {preview.zar.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-600">Reseller Price</span>
                <span className="font-semibold text-blue-600">R {preview.reseller.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-600">End User Price</span>
                <span className="font-semibold text-emerald-600">R {preview.endUser.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
