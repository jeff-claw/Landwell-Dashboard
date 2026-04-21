'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { formatUSD } from '@/lib/utils'

type Product = { id: string; product_name: string; category: string | null; usd_price: number; description: string | null; image_url: string | null; active: boolean }

export default function PricelistPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadProducts() }, [])

  const loadProducts = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('pricelist').select('*').eq('active', true).order('product_name')
    setProducts(data || [])
    setLoading(false)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pricelist</h1>
        <p className="text-sm text-gray-500 mt-1">{products.length} active products</p>
      </div>
      {loading ? <div className="text-center py-12 text-gray-500">Loading...</div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4">
              {p.image_url && <img src={p.image_url} alt={p.product_name} className="w-full h-40 object-cover rounded-lg mb-3" />}
              <h3 className="font-semibold text-gray-900">{p.product_name}</h3>
              {p.category && <p className="text-xs text-gray-500 mt-1">{p.category}</p>}
              <p className="text-lg font-bold text-gray-900 mt-2">{formatUSD(p.usd_price)}</p>
              {p.description && <p className="text-sm text-gray-600 mt-1">{p.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
