'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Invoice, PaymentRecord } from '@/lib/types'
import { DollarSign, TrendingUp, AlertTriangle, Clock, Plus, X, Search, Filter } from 'lucide-react'
import { toast } from 'sonner'

function formatCurrency(val: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(val || 0)
}

function daysBetween(date1: Date, date2: Date): number {
  const diff = date2.getTime() - date1.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

// Modal component
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-60px)]">{children}</div>
      </div>
    </div>
  )
}

const PAYMENT_METHODS = ['bank_transfer', 'card', 'cash', 'eft', 'cheque', 'other']

export default function PaymentsPage() {
  // This page runs off invoices, not orders. Invoices are where the billing
  // and amount_paid actually live, so Payments and Invoices now agree;
  // driving it off orders showed fully-paid invoices as overdue and hid every
  // invoice that had no order behind it.
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [filterText, setFilterText] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'partial' | 'unpaid' | 'overdue'>('all')

  // Form state
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
  const [paymentRef, setPaymentRef] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  const fetchAll = useCallback(async () => {
    const [invoicesRes, paymentsRes] = await Promise.all([
      supabase.from('invoices').select('*').order('invoice_date', { ascending: false }),
      supabase.from('payments').select('*').order('payment_date', { ascending: false }),
    ])
    setInvoices(invoicesRes.data || [])
    setPayments(paymentsRes.data || [])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Payment status per invoice. amount_paid on the invoice is the single
  // source of truth — the payments table is an audit trail and is never added
  // on top of it, or every payment would count twice.
  const invoicesWithPaymentStatus = useMemo(() => {
    return invoices
      .filter(inv => inv.status !== 'cancelled')
      .map(invoice => {
        const totalDue = Number(invoice.total) || 0
        const totalPaid = Number(invoice.amount_paid) || 0
        const outstanding = totalDue - totalPaid

        // Age runs from the due date where there is one, otherwise the invoice
        // date, so "90+ days" means 90 days late rather than 90 days old.
        const dueDate = invoice.due_date ? new Date(invoice.due_date) : new Date(invoice.invoice_date)
        const age = daysBetween(dueDate, new Date())
        const isOverdue = outstanding > 0.005 && age > 0

        let paymentStatus: 'paid' | 'partial' | 'unpaid' | 'overdue' = 'unpaid'
        if (outstanding <= 0.005) {
          paymentStatus = 'paid'
        } else if (isOverdue) {
          paymentStatus = 'overdue'
        } else if (totalPaid > 0) {
          paymentStatus = 'partial'
        }

        return { ...invoice, totalDue, totalPaid, outstanding, paymentStatus, age: Math.max(age, 0) }
      })
  }, [invoices])

  // Financial stats
  const stats = useMemo(() => {
    const totalInvoiced = invoicesWithPaymentStatus.reduce((sum, i) => sum + i.totalDue, 0)
    const totalReceived = invoicesWithPaymentStatus.reduce((sum, i) => sum + i.totalPaid, 0)
    const outstanding = totalInvoiced - totalReceived

    const overdueAmount = invoicesWithPaymentStatus
      .filter(i => i.paymentStatus === 'overdue')
      .reduce((sum, i) => sum + i.outstanding, 0)

    // Aging buckets, by how far past due the money is
    const aging = { current: 0, thirty: 0, sixty: 0, ninety: 0 }

    invoicesWithPaymentStatus.forEach(invoice => {
      if (invoice.outstanding <= 0.005) return
      const age = invoice.age
      if (age <= 30) aging.current += invoice.outstanding
      else if (age <= 60) aging.thirty += invoice.outstanding
      else if (age <= 90) aging.sixty += invoice.outstanding
      else aging.ninety += invoice.outstanding
    })

    return { totalInvoiced, totalReceived, outstanding, overdueAmount, aging }
  }, [invoicesWithPaymentStatus])

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    return invoicesWithPaymentStatus.filter(invoice => {
      if (filterStatus !== 'all' && invoice.paymentStatus !== filterStatus) return false

      if (filterText) {
        const search = filterText.toLowerCase()
        return invoice.invoice_number?.toLowerCase().includes(search) ||
               invoice.client_name?.toLowerCase().includes(search)
      }
      return true
    })
  }, [invoicesWithPaymentStatus, filterStatus, filterText])

  const selectedInvoice = invoicesWithPaymentStatus.find(i => i.id === selectedInvoiceId)

  // Submit payment
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedInvoiceId || !paymentAmount) return

    const invoice = invoicesWithPaymentStatus.find(i => i.id === selectedInvoiceId)
    if (!invoice) return

    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid payment amount')
      return
    }
    // Guards against recording money twice against an invoice that is already
    // settled, which the old order-based view made easy to do.
    if (invoice.outstanding <= 0.005) {
      toast.error(`${invoice.invoice_number} is already paid in full`)
      return
    }
    if (amount > invoice.outstanding + 0.005) {
      toast.error(`That is more than the ${formatCurrency(invoice.outstanding)} still outstanding on ${invoice.invoice_number}`)
      return
    }

    setSaving(true)

    const newAmountPaid = invoice.totalPaid + amount
    const newStatus = newAmountPaid >= invoice.totalDue - 0.005 ? 'paid' : 'partial'

    const { error: invoiceError } = await supabase.from('invoices').update({
      amount_paid: newAmountPaid,
      status: newStatus,
      updated_at: new Date().toISOString(),
    }).eq('id', invoice.id)

    if (invoiceError) {
      setSaving(false)
      console.error('Error updating invoice:', invoiceError)
      toast.error(invoiceError.message || 'Failed to record payment')
      return
    }

    // Audit row. The invoice is identified by its number in the reference,
    // because the payments table has no invoice_id column.
    // payments has no client_name column — the client is referenced by id.
    // Writing one is what kept every Record Payment failing.
    const { data: { user } } = await supabase.auth.getUser()
    const { error: paymentError } = await supabase.from('payments').insert({
      order_id: invoice.order_id,
      client_id: invoice.client_id,
      recorded_by: user?.id || null,
      amount,
      payment_date: paymentDate,
      payment_method: paymentMethod,
      reference: paymentRef ? `${invoice.invoice_number} · ${paymentRef}` : invoice.invoice_number,
      notes: paymentNotes,
    })

    setSaving(false)

    if (paymentError) {
      // The invoice is already updated, so the money IS recorded — only the
      // audit row failed. Say that rather than implying nothing happened.
      console.error('Error writing payment record:', paymentError)
      toast.error(`Invoice updated, but the payment log entry failed: ${paymentError.message}`)
    } else {
      toast.success(`Payment of ${formatCurrency(amount)} recorded against ${invoice.invoice_number}`)
    }

    // Reset form
    setSelectedInvoiceId('')
    setPaymentAmount('')
    setPaymentDate(new Date().toISOString().split('T')[0])
    setPaymentMethod('bank_transfer')
    setPaymentRef('')
    setPaymentNotes('')
    setModalOpen(false)
    fetchAll()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
        <button onClick={() => setModalOpen(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Record Payment
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-kpi gradient-blue">
          <div className="flex items-center gap-2 mb-2 text-white/80">
            <DollarSign className="w-5 h-5" />
            <span className="text-sm font-medium">Total Invoiced</span>
          </div>
          <div className="text-2xl md:text-3xl font-bold">{formatCurrency(stats.totalInvoiced)}</div>
        </div>

        <div className="card-kpi gradient-emerald">
          <div className="flex items-center gap-2 mb-2 text-white/80">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-medium">Total Received</span>
          </div>
          <div className="text-2xl md:text-3xl font-bold">{formatCurrency(stats.totalReceived)}</div>
        </div>

        <div className="card-kpi gradient-amber">
          <div className="flex items-center gap-2 mb-2 text-white/80">
            <Clock className="w-5 h-5" />
            <span className="text-sm font-medium">Outstanding</span>
          </div>
          <div className="text-2xl md:text-3xl font-bold">{formatCurrency(stats.outstanding)}</div>
        </div>

        <div className={`card-kpi ${stats.overdueAmount > 0 ? 'bg-gradient-to-br from-red-500 to-red-700' : 'gradient-violet'}`}>
          <div className="flex items-center gap-2 mb-2 text-white/80">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm font-medium">Overdue</span>
          </div>
          <div className="text-2xl md:text-3xl font-bold">{formatCurrency(stats.overdueAmount)}</div>
        </div>
      </div>

      {/* Aging Report */}
      <div className="card">
        <h2 className="font-bold text-slate-900 text-lg mb-4">Aging Report</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
            <div className="text-sm text-emerald-600 font-medium mb-1">Current (0-30 days)</div>
            <div className="text-xl font-bold text-emerald-700">{formatCurrency(stats.aging.current)}</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
            <div className="text-sm text-amber-600 font-medium mb-1">31-60 days</div>
            <div className="text-xl font-bold text-amber-700">{formatCurrency(stats.aging.thirty)}</div>
          </div>
          <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
            <div className="text-sm text-orange-600 font-medium mb-1">61-90 days</div>
            <div className="text-xl font-bold text-orange-700">{formatCurrency(stats.aging.sixty)}</div>
          </div>
          <div className="bg-red-50 rounded-xl p-4 border border-red-200">
            <div className="text-sm text-red-600 font-medium mb-1">90+ days</div>
            <div className="text-xl font-bold text-red-700">{formatCurrency(stats.aging.ninety)}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search invoices..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 w-48"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">All Status</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
      </div>

      {/* Invoices with Payment Status */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Client</th>
                <th className="text-right">Invoiced</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Outstanding</th>
                <th className="text-center">Status</th>
                <th className="text-center">Age</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map(invoice => (
                <tr key={invoice.id} className={invoice.paymentStatus === 'overdue' ? 'bg-red-50' : ''}>
                  <td className="font-mono font-medium text-slate-700">{invoice.invoice_number}</td>
                  <td className="font-medium text-slate-800">{invoice.client_name}</td>
                  <td className="text-right">{formatCurrency(invoice.totalDue)}</td>
                  <td className="text-right text-emerald-600 font-medium">{formatCurrency(invoice.totalPaid)}</td>
                  <td className="text-right font-medium">
                    {invoice.outstanding > 0.005 ? (
                      <span className={invoice.paymentStatus === 'overdue' ? 'text-red-600' : 'text-amber-600'}>
                        {formatCurrency(invoice.outstanding)}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="text-center">
                    <span className={`badge ${
                      invoice.paymentStatus === 'paid' ? 'badge-green' :
                      invoice.paymentStatus === 'partial' ? 'badge-amber' :
                      invoice.paymentStatus === 'overdue' ? 'badge-red' :
                      'badge-default'
                    }`}>
                      {invoice.paymentStatus}
                    </span>
                  </td>
                  <td className="text-center text-sm text-slate-500">
                    {invoice.outstanding > 0.005 && invoice.age > 0 ? `${invoice.age}d` : '—'}
                  </td>
                  <td>
                    {invoice.outstanding > 0.005 && (
                      <button
                        onClick={() => { setSelectedInvoiceId(invoice.id); setModalOpen(true) }}
                        className="text-teal-600 hover:text-teal-700 font-medium text-sm"
                      >
                        Add Payment
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    No invoices found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Payments */}
      {payments.length > 0 && (
        <div className="card">
          <h2 className="font-bold text-slate-900 text-lg mb-4">Recent Payments</h2>
          <div className="space-y-3">
            {payments.slice(0, 10).map(payment => (
              <div key={payment.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-800">
                      {invoices.find(i => i.client_id && i.client_id === payment.client_id)?.client_name || 'Unknown client'}
                    </div>
                    <div className="text-sm text-slate-500">
                      {payment.payment_method?.replace('_', ' ')} • {payment.reference || 'No ref'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-emerald-600">{formatCurrency(payment.amount)}</div>
                  <div className="text-sm text-slate-500">{payment.payment_date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Record Payment">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Invoice selection — only invoices that still owe money */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Invoice</label>
            <select
              value={selectedInvoiceId}
              onChange={(e) => setSelectedInvoiceId(e.target.value)}
              className="input"
              required
            >
              <option value="">Select invoice...</option>
              {invoicesWithPaymentStatus.filter(i => i.outstanding > 0.005).map(invoice => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoice_number} - {invoice.client_name} ({formatCurrency(invoice.outstanding)} due)
                </option>
              ))}
            </select>
          </div>

          {/* Invoice Summary */}
          {selectedInvoice && (
            <div className="bg-slate-50 rounded-xl p-3 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-slate-500">Total invoiced:</span>
                <span className="font-medium">{formatCurrency(selectedInvoice.totalDue)}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-500">Already paid:</span>
                <span className="font-medium text-emerald-600">{formatCurrency(selectedInvoice.totalPaid)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200">
                <span className="text-slate-700 font-medium">Outstanding:</span>
                <span className="font-bold text-amber-600">{formatCurrency(selectedInvoice.outstanding)}</span>
              </div>
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount (ZAR)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={selectedInvoice ? selectedInvoice.outstanding.toFixed(2) : undefined}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder={selectedInvoice ? `Max: ${selectedInvoice.outstanding.toFixed(2)}` : 'Enter amount'}
              className="input"
              required
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Payment Date</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="input"
              required
            />
          </div>

          {/* Method */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="input"
            >
              {PAYMENT_METHODS.map(m => (
                <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>
              ))}
            </select>
          </div>

          {/* Reference */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reference</label>
            <input
              type="text"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder="e.g. Bank ref, receipt number"
              className="input"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
              className="input"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
