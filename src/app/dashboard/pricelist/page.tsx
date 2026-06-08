'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { PricelistItem } from '@/lib/types'
import { Search } from 'lucide-react'

export default function PricelistPage() {
  const [items, setItems] = useState<PricelistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const fetchItems = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('pricelist').select('*').order('product_name')
      setItems(data || [])
      setLoading(false)
    }
    fetchItems()
  }, [])

  const filtered = items.filter(
    (item) =>
      item.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      item.category?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Pricelist</h1>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Product</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Category</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">USD Price</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{item.product_name}</td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100">{item.category}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">$ {item.usd_price?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell max-w-xs truncate">{item.description}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No products found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
