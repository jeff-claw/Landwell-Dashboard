'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { formatZAR } from '@/lib/utils'

type Invoice = { id: string; supplier_id: string; invoice_number: string; invoice_date: string; due_date: string; amount: number; currency: string; status: string; amount_paid: number; description: string }

export default function PayablesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadInvoices() }, [])

  const loadInvoices = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('supplier_invoices').select('*').order('due_date')
    setInvoices(data || [])
    setLoading(false)
  }

  const totalOwed = invoices.reduce((sum, i) => sum + (i.amount - i.amount_paid), 0)
  const overdue = invoices.filter(i => i.status !== 'Paid' && new Date(i.due_date) < new Date())

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Accounts Payable</h1>
        <p className="text-sm text-gray-500 mt-1">Total owed: {formatZAR(totalOwed)} · {overdue.length} overdue</p>
      </div>
      {overdue.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-medium text-red-800">⚠️ {overdue.length} overdue invoices</p>
        </div>
      )}
      {loading ? <div className="text-center py-12 text-gray-500">Loading...</div> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full"><thead className="bg-gray-50 border-b border-gray-200"><tr>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Invoice</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Amount</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Paid</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Balance</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Due</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
            </tr></thead><tbody className="divide-y divide-gray-100">
              {invoices.map(i => <tr key={i.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{i.invoice_number}</td>
                <td className="px-4 py-3 text-sm">{i.currency === 'ZAR' ? formatZAR(i.amount) : `$${i.amount.toFixed(2)}`}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{i.currency === 'ZAR' ? formatZAR(i.amount_paid) : `$${i.amount_paid.toFixed(2)}`}</td>
                <td className="px-4 py-3 text-sm font-medium">{i.currency === 'ZAR' ? formatZAR(i.amount - i.amount_paid) : `$${(i.amount - i.amount_paid).toFixed(2)}`}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{new Date(i.due_date).toLocaleDateString('en-ZA')}</td>
                <td className="px-4 py-3"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${i.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{i.status}</span></td>
              </tr>)}
            </tbody></table>
          </div>
        </div>
      )}
    </div>
  )
}
