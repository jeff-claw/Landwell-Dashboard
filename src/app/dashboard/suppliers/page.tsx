'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'

type Supplier = { id: string; name: string; contact_name: string | null; email: string | null; phone: string | null; payment_terms: string | null; notes: string }

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadSuppliers() }, [])

  const loadSuppliers = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('suppliers').select('*').order('name')
    setSuppliers(data || [])
    setLoading(false)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
        <p className="text-sm text-gray-500 mt-1">{suppliers.length} suppliers</p>
      </div>
      {loading ? <div className="text-center py-12 text-gray-500">Loading...</div> : (
        <div className="grid gap-4">
          {suppliers.map(s => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900">{s.name}</h3>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
                {s.contact_name && <span>Contact: {s.contact_name}</span>}
                {s.email && <span>Email: {s.email}</span>}
                {s.phone && <span>Phone: {s.phone}</span>}
                {s.payment_terms && <span>Terms: {s.payment_terms}</span>}
              </div>
              {s.notes && <p className="text-sm text-gray-500 mt-2">{s.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
