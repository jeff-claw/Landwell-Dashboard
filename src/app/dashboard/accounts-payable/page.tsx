'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Supplier, SupplierInvoice, SupplierPayment } from '@/lib/types'
import {
  Wallet,
  Plus,
  X,
  AlertTriangle,
  Clock,
  CheckCircle,
  Receipt,
  ChevronDown,
  ChevronRight,
  Calendar,
  DollarSign,
  Trash2,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'

function formatCurrency(val: number, currency = 'ZAR') {
  const formatter = new Intl.NumberFormat('en-ZA', { 
    style: 'currency', 
    currency: currency === 'CNY' ? 'CNY' : currency === 'USD' ? 'USD' : 'ZAR',
    maximumFractionDigits: 2 
  })
  return formatter.format(val || 0)
}

function formatZAR(val: number) {
  return new Intl.NumberFormat('en-ZA', { 
    style: 'currency', 
    currency: 'ZAR',
    maximumFractionDigits: 2 
  }).format(val || 0)
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysBetween(date1: Date, date2: Date): number {
  const diff = date2.getTime() - date1.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function getInvoiceStatus(invoice: SupplierInvoice): { status: string; color: string; bgColor: string } {
  const now = new Date()
  const dueDate = invoice.due_date ? new Date(invoice.due_date) : null
  const balance = Number(invoice.amount) - Number(invoice.amount_paid)
  
  if (balance <= 0) {
    return { status: 'Paid', color: 'text-emerald-700', bgColor: 'bg-emerald-100' }
  }
  if (dueDate && dueDate < now) {
    return { status: 'Overdue', color: 'text-red-700', bgColor: 'bg-red-100' }
  }
  if (Number(invoice.amount_paid) > 0) {
    return { status: 'Partial', color: 'text-amber-700', bgColor: 'bg-amber-100' }
  }
  return { status: 'Pending', color: 'text-blue-700', bgColor: 'bg-blue-100' }
}

export default function AccountsPayablePage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([])
  const [payments, setPayments] = useState<SupplierPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set())
  
  // Modal states
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<SupplierInvoice | null>(null)
  const [saving, setSaving] = useState(false)
  
  // Delete modal states
  const [deletePaymentModal, setDeletePaymentModal] = useState<{ payment: SupplierPayment; invoiceId: string } | null>(null)
  const [deleteInvoiceModal, setDeleteInvoiceModal] = useState<SupplierInvoice | null>(null)
  const [deleting, setDeleting] = useState(false)
  
  // USD to ZAR exchange rate
  const [usdToZarRate, setUsdToZarRate] = useState<number | null>(null)
  const [rateLoading, setRateLoading] = useState(false)

  // Form states
  const [invoiceForm, setInvoiceForm] = useState({
    supplier_id: '',
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    amount: '',
    currency: 'ZAR',
    description: '',
    reference: '',
  })

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    method: 'bank_transfer',
    reference: '',
    notes: '',
  })

  // Fetch USD to ZAR exchange rate from our cached API
  const fetchExchangeRate = useCallback(async () => {
    if (usdToZarRate !== null) return // Already cached
    setRateLoading(true)
    try {
      // Use internal API with caching and fallback logic
      const res = await fetch('/api/exchange-rate')
      const data = await res.json()
      if (data.rate) {
        setUsdToZarRate(data.rate)
      }
    } catch (error) {
      console.error('Failed to fetch exchange rate:', error)
    }
    setRateLoading(false)
  }, [usdToZarRate])

  useEffect(() => {
    fetchData()
    fetchExchangeRate()
  }, [fetchExchangeRate])

  const fetchData = async () => {
    const supabase = createClient()
    
    const [suppliersRes, invoicesRes, paymentsRes] = await Promise.all([
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('supplier_invoices').select('*').order('invoice_date', { ascending: false }),
      supabase.from('supplier_payments').select('*').order('payment_date', { ascending: false }),
    ])

    setSuppliers(suppliersRes.data || [])
    setInvoices(invoicesRes.data || [])
    setPayments(paymentsRes.data || [])
    
    // Expand all suppliers by default
    if (suppliersRes.data) {
      setExpandedSuppliers(new Set(suppliersRes.data.map(s => s.id)))
    }
    
    setLoading(false)
  }

  const stats = useMemo(() => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    
    // Helper to convert amount to ZAR
    const toZAR = (amount: number, currency: string) => {
      if (currency === 'USD' && usdToZarRate) {
        return amount * usdToZarRate
      }
      return amount // ZAR or CNY (treated as ZAR for now)
    }

    let totalOutstanding = 0
    let overdueAmount = 0
    let dueThisMonth = 0

    invoices.forEach(inv => {
      const balance = Number(inv.amount) - Number(inv.amount_paid)
      if (balance > 0) {
        const balanceInZAR = toZAR(balance, inv.currency || 'ZAR')
        totalOutstanding += balanceInZAR
        
        const dueDate = inv.due_date ? new Date(inv.due_date) : null
        if (dueDate) {
          if (dueDate < now) {
            overdueAmount += balanceInZAR
          } else if (dueDate >= startOfMonth && dueDate <= endOfMonth) {
            dueThisMonth += balanceInZAR
          }
        }
      }
    })

    // For payments, we need to look up the invoice to get the currency
    const paidThisMonth = payments
      .filter(p => new Date(p.payment_date) >= startOfMonth)
      .reduce((sum, p) => {
        const invoice = invoices.find(i => i.id === p.supplier_invoice_id)
        const currency = invoice?.currency || 'ZAR'
        return sum + toZAR(Number(p.amount), currency)
      }, 0)

    // Aging buckets
    const aging = { current: 0, days30: 0, days60: 0, days90plus: 0 }
    invoices.forEach(inv => {
      const balance = Number(inv.amount) - Number(inv.amount_paid)
      if (balance <= 0) return
      
      const balanceInZAR = toZAR(balance, inv.currency || 'ZAR')
      const dueDate = inv.due_date ? new Date(inv.due_date) : null
      if (!dueDate || dueDate >= now) {
        aging.current += balanceInZAR
      } else {
        const daysOverdue = daysBetween(dueDate, now)
        if (daysOverdue <= 30) aging.days30 += balanceInZAR
        else if (daysOverdue <= 60) aging.days60 += balanceInZAR
        else aging.days90plus += balanceInZAR
      }
    })

    return { totalOutstanding, overdueAmount, dueThisMonth, paidThisMonth, aging }
  }, [invoices, payments, usdToZarRate])

  const supplierData = useMemo(() => {
    // Helper to convert amount to ZAR
    const toZAR = (amount: number, currency: string) => {
      if (currency === 'USD' && usdToZarRate) {
        return amount * usdToZarRate
      }
      return amount // ZAR or CNY (treated as ZAR for now)
    }
    
    return suppliers.map(supplier => {
      const supplierInvoices = invoices.filter(i => i.supplier_id === supplier.id)
      const outstanding = supplierInvoices.reduce((sum, i) => {
        const balance = Number(i.amount) - Number(i.amount_paid)
        const balanceInZAR = toZAR(balance, i.currency || 'ZAR')
        return sum + (balance > 0 ? balanceInZAR : 0)
      }, 0)
      return { ...supplier, invoices: supplierInvoices, outstanding }
    })
  }, [suppliers, invoices, usdToZarRate])

  const toggleSupplier = (id: string) => {
    setExpandedSuppliers(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAddInvoice = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase.from('supplier_invoices').insert({
      supplier_id: invoiceForm.supplier_id,
      invoice_number: invoiceForm.invoice_number || null,
      invoice_date: invoiceForm.invoice_date,
      due_date: invoiceForm.due_date || null,
      amount: parseFloat(invoiceForm.amount),
      currency: invoiceForm.currency,
      description: invoiceForm.description || null,
      reference: invoiceForm.reference || null,
      status: 'pending',
      amount_paid: 0,
    })

    if (!error) {
      setShowInvoiceModal(false)
      setInvoiceForm({
        supplier_id: '',
        invoice_number: '',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: '',
        amount: '',
        currency: 'ZAR',
        description: '',
        reference: '',
      })
      fetchData()
    }
    setSaving(false)
  }

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedInvoice) return
    setSaving(true)
    const supabase = createClient()

    const paymentAmount = parseFloat(paymentForm.amount)
    
    // Insert payment record
    const { error: paymentError } = await supabase.from('supplier_payments').insert({
      supplier_invoice_id: selectedInvoice.id,
      amount: paymentAmount,
      payment_date: paymentForm.payment_date,
      method: paymentForm.method,
      reference: paymentForm.reference || null,
      notes: paymentForm.notes || null,
    })

    if (!paymentError) {
      // Update invoice amount_paid and status
      const newAmountPaid = Number(selectedInvoice.amount_paid) + paymentAmount
      const newStatus = newAmountPaid >= Number(selectedInvoice.amount) ? 'paid' : 'partial'
      
      await supabase.from('supplier_invoices')
        .update({ amount_paid: newAmountPaid, status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', selectedInvoice.id)

      setShowPaymentModal(false)
      setSelectedInvoice(null)
      setPaymentForm({
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        method: 'bank_transfer',
        reference: '',
        notes: '',
      })
      fetchData()
    }
    setSaving(false)
  }

  const openPaymentModal = (invoice: SupplierInvoice) => {
    setSelectedInvoice(invoice)
    const balance = Number(invoice.amount) - Number(invoice.amount_paid)
    setPaymentForm(prev => ({ ...prev, amount: balance.toFixed(2) }))
    setShowPaymentModal(true)
  }

  const handleDeletePayment = async () => {
    if (!deletePaymentModal) return
    setDeleting(true)
    const supabase = createClient()
    
    const { payment, invoiceId } = deletePaymentModal
    
    const { error } = await supabase
      .from('supplier_payments')
      .delete()
      .eq('id', payment.id)
    
    if (!error) {
      // Fetch remaining payments for this invoice
      const { data: remainingPayments } = await supabase
        .from('supplier_payments')
        .select('amount')
        .eq('supplier_invoice_id', invoiceId)
      
      const newAmountPaid = remainingPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
      
      // Update invoice amount_paid and status
      const invoice = invoices.find(i => i.id === invoiceId)
      if (invoice) {
        const invoiceAmount = Number(invoice.amount)
        let newStatus = 'pending'
        if (newAmountPaid >= invoiceAmount) {
          newStatus = 'paid'
        } else if (newAmountPaid > 0) {
          newStatus = 'partial'
        }
        
        await supabase
          .from('supplier_invoices')
          .update({ amount_paid: newAmountPaid, status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', invoiceId)
      }
      
      toast.success('Payment deleted')
      setDeletePaymentModal(null)
      fetchData()
    } else {
      toast.error('Failed to delete payment')
    }
    setDeleting(false)
  }

  const handleDeleteInvoice = async () => {
    if (!deleteInvoiceModal) return
    setDeleting(true)
    const supabase = createClient()
    
    const { error } = await supabase
      .from('supplier_invoices')
      .delete()
      .eq('id', deleteInvoiceModal.id)
    
    if (!error) {
      toast.success('Invoice deleted')
      setDeleteInvoiceModal(null)
      fetchData()
    } else {
      toast.error('Failed to delete invoice')
    }
    setDeleting(false)
  }

  const getInvoicePayments = (invoiceId: string) => {
    return payments.filter(p => p.supplier_invoice_id === invoiceId)
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-16 skeleton rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 skeleton rounded-xl" />)}
        </div>
        <div className="h-64 skeleton rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Accounts Payable</h1>
            <p className="text-sm text-slate-500">Money owed to suppliers</p>
          </div>
        </div>
        <button
          onClick={() => setShowInvoiceModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Invoice
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
            <DollarSign className="w-4 h-4" />
            Total Outstanding
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(stats.totalOutstanding)}</div>
        </div>
        
        <div className={`rounded-2xl p-4 border shadow-sm ${stats.overdueAmount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
          <div className={`flex items-center gap-2 text-sm mb-1 ${stats.overdueAmount > 0 ? 'text-red-600' : 'text-slate-500'}`}>
            <AlertTriangle className="w-4 h-4" />
            Overdue
          </div>
          <div className={`text-2xl font-bold ${stats.overdueAmount > 0 ? 'text-red-700' : 'text-slate-900'}`}>
            {formatCurrency(stats.overdueAmount)}
          </div>
        </div>
        
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 shadow-sm">
          <div className="flex items-center gap-2 text-amber-600 text-sm mb-1">
            <Clock className="w-4 h-4" />
            Due This Month
          </div>
          <div className="text-2xl font-bold text-amber-700">{formatCurrency(stats.dueThisMonth)}</div>
        </div>
        
        <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-600 text-sm mb-1">
            <CheckCircle className="w-4 h-4" />
            Paid This Month
          </div>
          <div className="text-2xl font-bold text-emerald-700">{formatCurrency(stats.paidThisMonth)}</div>
        </div>
      </div>

      {/* Aging Summary */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <h3 className="font-semibold text-slate-900 mb-3">Aging Summary</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-3 bg-slate-50 rounded-xl">
            <div className="text-xs text-slate-500 mb-1">Current</div>
            <div className="font-bold text-slate-700">{formatCurrency(stats.aging.current)}</div>
          </div>
          <div className={`text-center p-3 rounded-xl ${stats.aging.days30 > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
            <div className={`text-xs mb-1 ${stats.aging.days30 > 0 ? 'text-amber-600' : 'text-slate-500'}`}>1-30 Days</div>
            <div className={`font-bold ${stats.aging.days30 > 0 ? 'text-amber-700' : 'text-slate-700'}`}>{formatCurrency(stats.aging.days30)}</div>
          </div>
          <div className={`text-center p-3 rounded-xl ${stats.aging.days60 > 0 ? 'bg-orange-50' : 'bg-slate-50'}`}>
            <div className={`text-xs mb-1 ${stats.aging.days60 > 0 ? 'text-orange-600' : 'text-slate-500'}`}>31-60 Days</div>
            <div className={`font-bold ${stats.aging.days60 > 0 ? 'text-orange-700' : 'text-slate-700'}`}>{formatCurrency(stats.aging.days60)}</div>
          </div>
          <div className={`text-center p-3 rounded-xl ${stats.aging.days90plus > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
            <div className={`text-xs mb-1 ${stats.aging.days90plus > 0 ? 'text-red-600' : 'text-slate-500'}`}>60+ Days</div>
            <div className={`font-bold ${stats.aging.days90plus > 0 ? 'text-red-700' : 'text-slate-700'}`}>{formatCurrency(stats.aging.days90plus)}</div>
          </div>
        </div>
      </div>

      {/* Suppliers & Invoices */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-900">Suppliers</h3>
        
        {supplierData.map(supplier => (
          <div key={supplier.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Supplier Header */}
            <button
              onClick={() => toggleSupplier(supplier.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {expandedSuppliers.has(supplier.id) ? (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                )}
                <div className="text-left">
                  <div className="font-semibold text-slate-900">{supplier.name}</div>
                  {supplier.notes && <div className="text-xs text-slate-500">{supplier.notes}</div>}
                </div>
              </div>
              <div className="text-right">
                <div className={`font-bold ${supplier.outstanding > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                  {formatCurrency(supplier.outstanding)}
                </div>
                <div className="text-xs text-slate-500">{supplier.invoices.length} invoices</div>
              </div>
            </button>

            {/* Invoices */}
            {expandedSuppliers.has(supplier.id) && supplier.invoices.length > 0 && (
              <div className="border-t border-slate-100">
                <div className="divide-y divide-slate-100">
                  {supplier.invoices.map(invoice => {
                    const statusInfo = getInvoiceStatus(invoice)
                    const balance = Number(invoice.amount) - Number(invoice.amount_paid)
                    const invoicePayments = getInvoicePayments(invoice.id)
                    
                    return (
                      <div key={invoice.id} className="p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Receipt className="w-4 h-4 text-slate-400" />
                              <span className="font-medium text-slate-900">
                                {invoice.invoice_number || 'No Invoice #'}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
                                {statusInfo.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(invoice.invoice_date)}
                              </span>
                              {invoice.due_date && (
                                <span className={statusInfo.status === 'Overdue' ? 'text-red-600 font-medium' : ''}>
                                  Due: {formatDate(invoice.due_date)}
                                </span>
                              )}
                            </div>
                            {invoice.description && (
                              <div className="text-sm text-slate-600 mt-1">{invoice.description}</div>
                            )}
                            
                            {/* Payments list */}
                            {invoicePayments.length > 0 && (
                              <div className="mt-3 pl-5 border-l-2 border-emerald-200 space-y-2">
                                {invoicePayments.map(payment => (
                                  <div key={payment.id} className="flex items-center justify-between text-sm group">
                                    <div className="flex items-center gap-2 text-slate-600">
                                      <CheckCircle className="w-3 h-3 text-emerald-500" />
                                      <span>{formatDate(payment.payment_date)}</span>
                                      <span className="text-emerald-600 font-medium">
                                        {formatCurrency(payment.amount, invoice.currency)}
                                      </span>
                                      {payment.method && (
                                        <span className="text-slate-400 text-xs">
                                          ({payment.method.replace('_', ' ')})
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => setDeletePaymentModal({ payment, invoiceId: invoice.id })}
                                      className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Delete payment"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0 flex items-start gap-2">
                            <div>
                              <div className="font-bold text-slate-900">
                                {formatCurrency(invoice.amount, invoice.currency)}
                              </div>
                              {invoice.currency === 'USD' && usdToZarRate && (
                                <div className="text-xs text-slate-500">
                                  ≈ {formatZAR(Number(invoice.amount) * usdToZarRate)}
                                </div>
                              )}
                              {Number(invoice.amount_paid) > 0 && (
                                <div className="text-xs text-emerald-600">
                                  Paid: {formatCurrency(invoice.amount_paid, invoice.currency)}
                                </div>
                              )}
                              {balance > 0 && (
                                <button
                                  onClick={() => openPaymentModal(invoice)}
                                  className="mt-2 text-xs text-teal-600 font-medium hover:text-teal-700"
                                >
                                  Record Payment →
                                </button>
                              )}
                            </div>
                            <button
                              onClick={() => setDeleteInvoiceModal(invoice)}
                              className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                              title="Delete invoice"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {expandedSuppliers.has(supplier.id) && supplier.invoices.length === 0 && (
              <div className="border-t border-slate-100 p-4 text-center text-slate-400 text-sm">
                No invoices yet
              </div>
            )}
          </div>
        ))}

        {suppliers.length === 0 && (
          <div className="bg-slate-50 rounded-2xl p-8 text-center">
            <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No suppliers found</p>
          </div>
        )}
      </div>

      {/* Add Invoice Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Add Supplier Invoice</h2>
              <button onClick={() => setShowInvoiceModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddInvoice} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Supplier *</label>
                <select
                  required
                  value={invoiceForm.supplier_id}
                  onChange={e => setInvoiceForm(prev => ({ ...prev, supplier_id: e.target.value }))}
                  className="input w-full"
                >
                  <option value="">Select supplier...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Invoice #</label>
                  <input
                    type="text"
                    value={invoiceForm.invoice_number}
                    onChange={e => setInvoiceForm(prev => ({ ...prev, invoice_number: e.target.value }))}
                    className="input w-full"
                    placeholder="INV-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                  <select
                    value={invoiceForm.currency}
                    onChange={e => setInvoiceForm(prev => ({ ...prev, currency: e.target.value }))}
                    className="input w-full"
                  >
                    <option value="ZAR">ZAR</option>
                    <option value="USD">USD</option>
                    <option value="CNY">CNY</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Date *</label>
                  <input
                    type="date"
                    required
                    value={invoiceForm.invoice_date}
                    onChange={e => setInvoiceForm(prev => ({ ...prev, invoice_date: e.target.value }))}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={invoiceForm.due_date}
                    onChange={e => setInvoiceForm(prev => ({ ...prev, due_date: e.target.value }))}
                    className="input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount *</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={invoiceForm.amount}
                  onChange={e => setInvoiceForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="input w-full"
                  placeholder="0.00"
                />
                {invoiceForm.currency === 'USD' && invoiceForm.amount && usdToZarRate && (
                  <div className="mt-1.5 text-sm text-slate-500 flex items-center gap-1">
                    <span>≈ {formatZAR(parseFloat(invoiceForm.amount) * usdToZarRate)}</span>
                    <span className="text-slate-400">@ {usdToZarRate.toFixed(2)} USD/ZAR</span>
                  </div>
                )}
                {invoiceForm.currency === 'USD' && rateLoading && (
                  <div className="mt-1.5 text-sm text-slate-400 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Loading exchange rate...</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={invoiceForm.description}
                  onChange={e => setInvoiceForm(prev => ({ ...prev, description: e.target.value }))}
                  className="input w-full"
                  rows={2}
                  placeholder="What is this invoice for?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reference</label>
                <input
                  type="text"
                  value={invoiceForm.reference}
                  onChange={e => setInvoiceForm(prev => ({ ...prev, reference: e.target.value }))}
                  className="input w-full"
                  placeholder="Order #, Shipment ID, etc."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowInvoiceModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Saving...' : 'Add Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Record Payment</h2>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <div className="text-sm text-slate-500">Invoice</div>
              <div className="font-semibold text-slate-900">
                {selectedInvoice.invoice_number || 'No Invoice #'}
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Balance: {formatCurrency(Number(selectedInvoice.amount) - Number(selectedInvoice.amount_paid), selectedInvoice.currency)}
                {selectedInvoice.currency === 'USD' && usdToZarRate && (
                  <span className="text-slate-500 ml-1">
                    (≈ {formatZAR((Number(selectedInvoice.amount) - Number(selectedInvoice.amount_paid)) * usdToZarRate)})
                  </span>
                )}
              </div>
            </div>

            <form onSubmit={handleRecordPayment} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount *</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={paymentForm.amount}
                  onChange={e => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="input w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={paymentForm.payment_date}
                    onChange={e => setPaymentForm(prev => ({ ...prev, payment_date: e.target.value }))}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Method</label>
                  <select
                    value={paymentForm.method}
                    onChange={e => setPaymentForm(prev => ({ ...prev, method: e.target.value }))}
                    className="input w-full"
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="card">Card</option>
                    <option value="cash">Cash</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reference</label>
                <input
                  type="text"
                  value={paymentForm.reference}
                  onChange={e => setPaymentForm(prev => ({ ...prev, reference: e.target.value }))}
                  className="input w-full"
                  placeholder="Transaction reference"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={e => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="input w-full"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Payment Confirmation Modal */}
      {deletePaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Delete Payment</h2>
            </div>
            <p className="text-slate-600 mb-6">
              Delete this payment of {formatCurrency(deletePaymentModal.payment.amount)}? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletePaymentModal(null)}
                className="btn-secondary flex-1"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePayment}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Invoice Confirmation Modal */}
      {deleteInvoiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Delete Invoice</h2>
            </div>
            <p className="text-slate-600 mb-6">
              Delete invoice #{deleteInvoiceModal.invoice_number || 'N/A'}? All payments will also be deleted. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteInvoiceModal(null)}
                className="btn-secondary flex-1"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteInvoice}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
