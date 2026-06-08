'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Order, PaymentRecord } from '@/lib/types'
import { DollarSign, TrendingUp, AlertTriangle, Clock, Plus, X, Search, Filter } from 'lucide-react'

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
  const [orders, setOrders] = useState<Order[]>([])
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [filterText, setFilterText] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'partial' | 'unpaid' | 'overdue'>('all')

  // Form state
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
  const [paymentRef, setPaymentRef] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  const fetchAll = useCallback(async () => {
    const [ordersRes, paymentsRes] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('payments').select('*').order('payment_date', { ascending: false }),
    ])
    setOrders(ordersRes.data || [])
    setPayments(paymentsRes.data || [])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Calculate payment status per order
  const ordersWithPaymentStatus = useMemo(() => {
    return orders.map(order => {
      const orderPayments = payments.filter(p => p.order_id === order.id)
      const totalPaid = orderPayments.reduce((sum, p) => sum + Number(p.amount), 0)
      const totalDue = Number(order.value_zar) || 0
      const outstanding = totalDue - totalPaid
      
      // Check if overdue (> 30 days since order created and not fully paid)
      const orderAge = daysBetween(new Date(order.created_at), new Date())
      const isOverdue = outstanding > 0 && orderAge > 30

      let paymentStatus: 'paid' | 'partial' | 'unpaid' | 'overdue' = 'unpaid'
      if (totalPaid >= totalDue) {
        paymentStatus = 'paid'
      } else if (totalPaid > 0) {
        paymentStatus = isOverdue ? 'overdue' : 'partial'
      } else if (isOverdue) {
        paymentStatus = 'overdue'
      }

      return {
        ...order,
        totalPaid,
        outstanding,
        paymentStatus,
        orderAge,
        payments: orderPayments,
      }
    })
  }, [orders, payments])

  // Financial stats
  const stats = useMemo(() => {
    const totalInvoiced = ordersWithPaymentStatus.reduce((sum, o) => sum + (Number(o.value_zar) || 0), 0)
    const totalReceived = payments.reduce((sum, p) => sum + Number(p.amount), 0)
    const outstanding = totalInvoiced - totalReceived
    
    // Overdue amount (orders > 30 days old that aren't fully paid)
    const overdueOrders = ordersWithPaymentStatus.filter(o => o.paymentStatus === 'overdue')
    const overdueAmount = overdueOrders.reduce((sum, o) => sum + o.outstanding, 0)

    // Aging buckets
    const aging = {
      current: 0,  // 0-30 days
      thirty: 0,   // 31-60 days
      sixty: 0,    // 61-90 days
      ninety: 0,   // 90+ days
    }

    ordersWithPaymentStatus.forEach(order => {
      if (order.outstanding <= 0) return
      const age = order.orderAge
      
      if (age <= 30) aging.current += order.outstanding
      else if (age <= 60) aging.thirty += order.outstanding
      else if (age <= 90) aging.sixty += order.outstanding
      else aging.ninety += order.outstanding
    })

    return { totalInvoiced, totalReceived, outstanding, overdueAmount, aging }
  }, [ordersWithPaymentStatus, payments])

  // Filter orders
  const filteredOrders = useMemo(() => {
    return ordersWithPaymentStatus.filter(order => {
      // Status filter
      if (filterStatus !== 'all' && order.paymentStatus !== filterStatus) return false
      
      // Text filter
      if (filterText) {
        const search = filterText.toLowerCase()
        return order.order_number?.toLowerCase().includes(search) ||
               order.client_name?.toLowerCase().includes(search)
      }
      return true
    })
  }, [ordersWithPaymentStatus, filterStatus, filterText])

  // Submit payment
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrderId || !paymentAmount) return

    setSaving(true)
    const { error } = await supabase.from('payments').insert({
      order_id: selectedOrderId,
      amount: parseFloat(paymentAmount),
      payment_date: paymentDate,
      method: paymentMethod,
      reference: paymentRef,
      notes: paymentNotes,
    })

    setSaving(false)
    if (error) {
      console.error('Error recording payment:', error)
      alert('Failed to record payment')
      return
    }

    // Reset form
    setSelectedOrderId('')
    setPaymentAmount('')
    setPaymentDate(new Date().toISOString().split('T')[0])
    setPaymentMethod('bank_transfer')
    setPaymentRef('')
    setPaymentNotes('')
    setModalOpen(false)
    fetchAll()
  }

  // Get selected order details
  const selectedOrder = ordersWithPaymentStatus.find(o => o.id === selectedOrderId)

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
            placeholder="Search orders..."
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

      {/* Orders with Payment Status */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr>
                <th>Order</th>
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
              {filteredOrders.map(order => (
                <tr key={order.id} className={order.paymentStatus === 'overdue' ? 'bg-red-50' : ''}>
                  <td className="font-mono font-medium text-slate-700">{order.order_number}</td>
                  <td className="font-medium text-slate-800">{order.client_name}</td>
                  <td className="text-right">{formatCurrency(order.value_zar)}</td>
                  <td className="text-right text-emerald-600 font-medium">{formatCurrency(order.totalPaid)}</td>
                  <td className="text-right font-medium">
                    {order.outstanding > 0 ? (
                      <span className={order.paymentStatus === 'overdue' ? 'text-red-600' : 'text-amber-600'}>
                        {formatCurrency(order.outstanding)}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="text-center">
                    <span className={`badge ${
                      order.paymentStatus === 'paid' ? 'badge-green' :
                      order.paymentStatus === 'partial' ? 'badge-amber' :
                      order.paymentStatus === 'overdue' ? 'badge-red' :
                      'badge-default'
                    }`}>
                      {order.paymentStatus}
                    </span>
                  </td>
                  <td className="text-center text-sm text-slate-500">{order.orderAge}d</td>
                  <td>
                    {order.outstanding > 0 && (
                      <button
                        onClick={() => { setSelectedOrderId(order.id); setModalOpen(true) }}
                        className="text-teal-600 hover:text-teal-700 font-medium text-sm"
                      >
                        Add Payment
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    No orders found
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
            {payments.slice(0, 10).map(payment => {
              const order = orders.find(o => o.id === payment.order_id)
              return (
                <div key={payment.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-800">
                        {order?.client_name || 'Unknown'} - {order?.order_number || 'N/A'}
                      </div>
                      <div className="text-sm text-slate-500">
                        {payment.method?.replace('_', ' ')} • {payment.reference || 'No ref'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-600">{formatCurrency(payment.amount)}</div>
                    <div className="text-sm text-slate-500">{payment.payment_date}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Record Payment">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Order Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Order</label>
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="input"
              required
            >
              <option value="">Select order...</option>
              {ordersWithPaymentStatus.filter(o => o.outstanding > 0).map(order => (
                <option key={order.id} value={order.id}>
                  {order.order_number} - {order.client_name} ({formatCurrency(order.outstanding)} due)
                </option>
              ))}
            </select>
          </div>

          {/* Order Summary */}
          {selectedOrder && (
            <div className="bg-slate-50 rounded-xl p-3 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-slate-500">Total invoiced:</span>
                <span className="font-medium">{formatCurrency(selectedOrder.value_zar)}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-500">Already paid:</span>
                <span className="font-medium text-emerald-600">{formatCurrency(selectedOrder.totalPaid)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200">
                <span className="text-slate-700 font-medium">Outstanding:</span>
                <span className="font-bold text-amber-600">{formatCurrency(selectedOrder.outstanding)}</span>
              </div>
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount (ZAR)</label>
            <input
              type="number"
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder={selectedOrder ? `Max: ${selectedOrder.outstanding.toFixed(2)}` : 'Enter amount'}
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
