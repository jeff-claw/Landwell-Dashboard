'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { formatZAR } from '@/lib/utils'

type Invoice = { id: string; invoice_number: string; client_name: string; invoice_date: string; due_date: string; total: number; amount_paid: number; status: string }

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadInvoices() }, [])

  const loadInvoices = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('invoices').select('*').order('invoice_date', { ascending: false })
    setInvoices(data || [])
    setLoading(false)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <p className="text-sm text-gray-500 mt-1">{invoices.length} invoices</p>
      </div>
      {loading ? <div className="text-center py-12 text-gray-500">Loading...</div> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full"><thead className="bg-gray-50 border-b border-gray-200"><tr>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Invoice #</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Client</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Total</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Paid</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Due</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
            </tr></thead><tbody className="divide-y divide-gray-100">
              {invoices.map(i => <tr key={i.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{i.invoice_number}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{i.client_name}</td>
                <td className="px-4 py-3 text-sm font-medium">{formatZAR(i.total)}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{formatZAR(i.amount_paid)}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{new Date(i.due_date).toLocaleDateString('en-ZA')}</td>
                <td className="px-4 py-3"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${i.status === 'Paid' ? 'bg-green-100 text-green-800' : i.status === 'Overdue' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{i.status}</span></td>
              </tr>)}
            </tbody></table>
          </div>
        </div>
      )}
    </div>
  )
}
