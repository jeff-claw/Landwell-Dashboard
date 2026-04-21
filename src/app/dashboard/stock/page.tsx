'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { formatUSD } from '@/lib/utils'

type StockItem = { id: string; sku: string | null; name: string; quantity: number; reorder_point: number; category: string | null; usd_price: number }

export default function StockPage() {
  const [items, setItems] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadStock() }, [])

  const loadStock = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('stock_items').select('*').order('name')
    setItems(data || [])
    setLoading(false)
  }

  const lowStock = items.filter(i => i.quantity <= i.reorder_point)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Stock</h1>
        <p className="text-sm text-gray-500 mt-1">{items.length} items · {lowStock.length} low stock</p>
      </div>
      {lowStock.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-medium text-red-800">⚠️ {lowStock.length} items at or below reorder point</p>
        </div>
      )}
      {loading ? <div className="text-center py-12 text-gray-500">Loading...</div> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full"><thead className="bg-gray-50 border-b border-gray-200"><tr>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Name</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">SKU</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Qty</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Reorder</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Price</th>
            </tr></thead><tbody className="divide-y divide-gray-100">
              {items.map(i => <tr key={i.id} className={`hover:bg-gray-50 ${i.quantity <= i.reorder_point ? 'bg-red-50' : ''}`}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{i.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{i.sku || '-'}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{i.quantity}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{i.reorder_point}</td>
                <td className="px-4 py-3 text-sm">{formatUSD(i.usd_price)}</td>
              </tr>)}
            </tbody></table>
          </div>
        </div>
      )}
    </div>
  )
}
