'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Invoice, InvoiceLineItem, Client, Order, Quote, InvoiceExpense, ExpenseCategory } from '@/lib/types'
import { EXPENSE_CATEGORIES } from '@/lib/types'
import { 
  Plus, X, Search, Edit2, Trash2, Download, Eye, 
  DollarSign, Clock, AlertTriangle, CheckCircle, 
  FileText, CreditCard, Receipt, Camera, TrendingUp
} from 'lucide-react'
import { toast } from 'sonner'

// Status configuration
const STATUSES = ['unpaid', 'partial', 'paid', 'overdue', 'cancelled'] as const
const STATUS_LABELS: Record<string, string> = {
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled'
}
const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  unpaid: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  partial: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  paid: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  overdue: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  cancelled: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
}

function formatCurrency(val: number | undefined | null): string {
  if (val == null || isNaN(val)) return 'R 0.00'
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(val)
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

// Generate next invoice number
function generateInvoiceNumber(existingInvoices: Invoice[]): string {
  const year = new Date().getFullYear().toString().slice(-2)
  const prefix = `INV-${year}`
  
  const existing = existingInvoices.filter(inv => inv.invoice_number?.startsWith(prefix))
  const maxNum = existing.reduce((max, inv) => {
    const num = parseInt(inv.invoice_number?.slice(-4) || '0')
    return num > max ? num : max
  }, 0)
  
  return `${prefix}${String(maxNum + 1).padStart(4, '0')}`
}

// Check if invoice is overdue
function isOverdue(invoice: Invoice): boolean {
  if (invoice.status === 'paid' || invoice.status === 'cancelled') return false
  if (!invoice.due_date) return false
  return new Date(invoice.due_date) < new Date()
}

// Modal component
function Modal({ 
  open, 
  onClose, 
  title, 
  wide = false,
  children 
}: { 
  open: boolean
  onClose: () => void
  title: string
  wide?: boolean
  children: React.ReactNode 
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div 
        className={`bg-white rounded-2xl shadow-xl ${wide ? 'max-w-3xl' : 'max-w-lg'} w-full max-h-[90vh] overflow-hidden`} 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-60px)]">{children}</div>
      </div>
    </div>
  )
}

// Status Badge component
function StatusBadge({ status }: { status: string }) {
  const normalizedStatus = status?.toLowerCase() || 'unpaid'
  const colors = STATUS_COLORS[normalizedStatus] || STATUS_COLORS.unpaid
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
      {normalizedStatus === 'paid' && <CheckCircle className="w-3 h-3" />}
      {normalizedStatus === 'unpaid' && <Clock className="w-3 h-3" />}
      {normalizedStatus === 'partial' && <DollarSign className="w-3 h-3" />}
      {normalizedStatus === 'overdue' && <AlertTriangle className="w-3 h-3" />}
      {normalizedStatus === 'cancelled' && <X className="w-3 h-3" />}
      {STATUS_LABELS[normalizedStatus] || status}
    </span>
  )
}

// Generate Invoice PDF HTML - Styled to match Quote PDF
function generateInvoicePdfHtml(invoice: Invoice): string {
  const lineItems = Array.isArray(invoice.line_items) ? invoice.line_items : []
  
  const lineItemsHtml = lineItems.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
        <div style="font-weight: 600; font-size: 9px;">${item.product}</div>
        ${item.description ? `<div style="font-size: 8px; color: #64748b; margin-top: 2px;">${item.description}</div>` : ''}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 9px;">${item.qty}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 9px;">R${Number(item.unitPrice).toLocaleString('en-ZA', {minimumFractionDigits: 2})}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; font-size: 9px;">R${(item.qty * item.unitPrice).toLocaleString('en-ZA', {minimumFractionDigits: 2})}</td>
    </tr>
  `).join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Invoice ${invoice.invoice_number}</title>
  <style>
    @page { margin: 30px 40px; size: A4; }
    @media print { 
      .no-print { display: none; } 
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.4; margin: 0; padding: 20px 30px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #4AB3E6; }
    .invoice-badge { background: #dc2626; color: white; padding: 4px 12px; border-radius: 12px; font-weight: 600; font-size: 11px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
    .meta-box { background: #f8fafc; padding: 10px 12px; border-radius: 8px; }
    .meta-box h3 { margin: 0 0 4px 0; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
    .meta-box p { margin: 1px 0; font-size: 11px; }
    .meta-box .name { font-weight: 600; font-size: 12px; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #0f172a; color: white; padding: 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
    th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: right; }
    th:nth-child(2) { text-align: center; }
    .totals { margin-left: auto; width: 200px; }
    .totals-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid #e2e8f0; font-size: 9px; }
    .totals-row span:first-child { text-align: left; }
    .totals-row span:last-child { text-align: right; font-weight: 500; }
    .totals-row.discount { color: #dc2626; }
    .totals-row.grand { background: #0f172a; color: white; padding: 6px 8px; border-radius: 4px; font-weight: 700; font-size: 10px; margin-top: 4px; border: none; }
    .totals-row.paid { color: #059669; margin-top: 8px; }
    .totals-row.balance { font-weight: 700; }
    .banking { background: #f1f5f9; padding: 14px 18px; border-radius: 8px; margin-bottom: 16px; font-size: 12px; }
    .banking strong { color: #0f172a; }
    .banking h4 { margin: 0 0 8px 0; font-size: 12px; color: #0f172a; }
    .terms { background: #fef3c7; border: 1px solid #f59e0b; padding: 10px 14px; border-radius: 8px; font-size: 11px; color: #92400e; }
    .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 10px; font-size: 10px; font-weight: 600; margin-left: 8px; }
    .status-unpaid { background: #fef3c7; color: #b45309; }
    .status-paid { background: #d1fae5; color: #047857; }
    .status-partial { background: #dbeafe; color: #1d4ed8; }
    .status-overdue { background: #fee2e2; color: #b91c1c; }
    .invoice-info { text-align: right; font-size: 10px; color: #64748b; }
    .invoice-info .number { font-size: 16px; font-weight: 700; color: #0f172a; }
    .print-btn { position: fixed; top: 10px; right: 10px; padding: 10px 20px; background: #4AB3E6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; z-index: 9999; }
    .print-btn:hover { background: #2A8FC4; }
    .print-hint { position: fixed; top: 10px; left: 10px; padding: 8px 14px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; color: #64748b; z-index: 9999; }
  </style>
</head>
<body>
  <div class="print-hint no-print">💡 Tip: Use <strong>Ctrl+P</strong> (or <strong>Cmd+P</strong> on Mac) → Save as PDF</div>
  <button class="print-btn no-print" onclick="window.print();">📥 Save as PDF</button>

  <div class="header">
    <div>
      <img src="https://iwyiqsmcwoengowjipws.supabase.co/storage/v1/object/public/product-images/landwell-logo.png?v=3" alt="Landwell Africa" style="height: 45px; width: auto;" />
    </div>
    <div class="invoice-info">
      <div class="invoice-badge">TAX INVOICE</div>
      <div class="number" style="margin-top: 4px;">${invoice.invoice_number}</div>
      <div>Date: ${formatDate(invoice.invoice_date)} | Due: ${formatDate(invoice.due_date)}</div>
      <span class="status-badge status-${invoice.status}">${STATUS_LABELS[invoice.status] || invoice.status}</span>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-box">
      <h3>From</h3>
      <p class="name">LANDWELL AFRICA (PTY) LTD</p>
      <p>Rep: Verushka Olivier</p>
      <p>Tel: (073) 010-0942</p>
      <p>verushka@landwellafrica.co.za</p>
      <p>VAT: 4940318589</p>
    </div>
    <div class="meta-box">
      <h3>Bill To</h3>
      <p class="name">${invoice.client_name}</p>
      ${invoice.client_address ? `<p>${invoice.client_address}</p>` : ''}
      ${invoice.client_email ? `<p>${invoice.client_email}</p>` : ''}
      ${invoice.client_vat ? `<p>VAT: ${invoice.client_vat}</p>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align: center; width: 80px;">Qty</th>
        <th style="text-align: right; width: 120px;">Unit Price</th>
        <th style="text-align: right; width: 130px;">Total</th>
      </tr>
    </thead>
    <tbody>${lineItemsHtml}</tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><span>Subtotal:</span><span>R${Number(invoice.subtotal).toLocaleString('en-ZA', {minimumFractionDigits: 2})}</span></div>
    ${Number(invoice.discount) > 0 ? `<div class="totals-row discount"><span>Discount:</span><span>-R${Number(invoice.discount).toLocaleString('en-ZA', {minimumFractionDigits: 2})}</span></div>` : ''}
    <div class="totals-row"><span>VAT (15%):</span><span>R${Number(invoice.vat_amount).toLocaleString('en-ZA', {minimumFractionDigits: 2})}</span></div>
    <div class="totals-row grand"><span>Total Due:</span><span>R${Number(invoice.total).toLocaleString('en-ZA', {minimumFractionDigits: 2})}</span></div>
    ${Number(invoice.amount_paid) > 0 ? `
    <div class="totals-row paid"><span>Amount Paid:</span><span>-R${Number(invoice.amount_paid).toLocaleString('en-ZA', {minimumFractionDigits: 2})}</span></div>
    <div class="totals-row balance"><span>Balance Due:</span><span>R${(Number(invoice.total) - Number(invoice.amount_paid)).toLocaleString('en-ZA', {minimumFractionDigits: 2})}</span></div>
    ` : ''}
  </div>

  <div class="banking">
    <h4>Banking Details</h4>
    <p><strong>Bank:</strong> FNB (First National Bank) | <strong>Account:</strong> 63102227112 | <strong>Branch:</strong> 210835</p>
    <p><strong>Reference:</strong> ${invoice.client_name} - ${invoice.invoice_number}</p>
  </div>

  <div class="terms">
    <strong>Payment Terms:</strong> ${invoice.payment_terms || 'Payment due within 30 days'}
    ${invoice.notes ? `<br><strong>Notes:</strong> ${invoice.notes}` : ''}
  </div>

  <div class="footer">
    <div style="margin-bottom: 8px;"><strong>LANDWELL AFRICA (PTY) LTD</strong></div>
    Invoice ${invoice.invoice_number} | Generated ${new Date().toLocaleDateString('en-ZA')}
  </div>
</body>
</html>`
}

// Empty Invoice Form
interface InvoiceForm {
  client_id: string
  client_name: string
  client_email: string
  client_address: string
  client_vat: string
  invoice_date: string
  due_date: string
  discount: number
  notes: string
  payment_terms: string
  line_items: InvoiceLineItem[]
  order_id: string
  quote_id: string
}

const getEmptyForm = (): InvoiceForm => ({
  client_id: '',
  client_name: '',
  client_email: '',
  client_address: '',
  client_vat: '',
  invoice_date: new Date().toISOString().split('T')[0],
  due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  discount: 0,
  notes: '',
  payment_terms: 'Payment due immediately upon receipt',
  line_items: [{ product: '', description: '', qty: 1, unitPrice: 0 }],
  order_id: '',
  quote_id: ''
})

export default function InvoicesPage() {
  const searchParams = useSearchParams()
  const orderParam = searchParams.get('order')
  
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  
  // Create modal
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [form, setForm] = useState<InvoiceForm>(getEmptyForm())
  const [saving, setSaving] = useState(false)
  const [initialOrderHandled, setInitialOrderHandled] = useState(false)
  
  // Detail modal
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<InvoiceForm>(getEmptyForm())
  
  // Payment modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('EFT')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  
  // Filters
  const [filterText, setFilterText] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterMonth, setFilterMonth] = useState('')
  
  // Expenses
  const [expenses, setExpenses] = useState<InvoiceExpense[]>([])
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [expenseForm, setExpenseForm] = useState({
    category: 'other' as ExpenseCategory,
    description: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    receipt_url: null as string | null,
  })
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [savingExpense, setSavingExpense] = useState(false)
  
  const supabase = createClient()
  
  const fetchAll = useCallback(async () => {
    const [invoicesRes, clientsRes, ordersRes, quotesRes] = await Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').order('name'),
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('quotes').select('*').eq('status', 'accepted').order('created_at', { ascending: false }),
    ])
    
    // Process invoices to ensure line_items is array and check overdue
    const processedInvoices = (invoicesRes.data || []).map(inv => {
      const processed = {
        ...inv,
        line_items: typeof inv.line_items === 'string' 
          ? JSON.parse(inv.line_items) 
          : (Array.isArray(inv.line_items) ? inv.line_items : [])
      }
      // Auto-update status to overdue if needed (client-side only for display)
      if (isOverdue(processed) && processed.status !== 'overdue' && processed.status !== 'paid') {
        processed.status = 'overdue'
      }
      return processed
    })
    
    setInvoices(processedInvoices)
    setClients(clientsRes.data || [])
    setOrders(ordersRes.data || [])
    setQuotes(quotesRes.data || [])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  useEffect(() => { fetchAll() }, [fetchAll])
  
  // Handle order query parameter to auto-open create modal with order pre-selected
  useEffect(() => {
    if (orderParam && !loading && !initialOrderHandled && orders.length > 0) {
      const order = orders.find(o => o.id === orderParam)
      if (order) {
        // Pre-fill form with order data
        setForm(f => ({
          ...f,
          order_id: orderParam,
          client_id: order.client_id || '',
          client_name: order.client_name || '',
        }))
        
        // Find the linked quote if any
        if (order.quote_id) {
          const quote = quotes.find(q => q.id === order.quote_id)
          if (quote) {
            const lineItems = Array.isArray(quote.line_items) ? quote.line_items : []
            setForm(f => ({
              ...f,
              quote_id: order.quote_id || '',
              line_items: lineItems.map(item => ({
                product: item.product,
                description: item.description || '',
                qty: item.qty,
                unitPrice: item.unitPrice
              }))
            }))
          }
        }
        
        // Get client details
        const client = clients.find(c => c.id === order.client_id)
        if (client) {
          setForm(f => ({
            ...f,
            client_email: client.email || '',
            client_address: client.address || '',
            client_vat: client.vat_number || '',
          }))
        }
        
        setCreateModalOpen(true)
        setInitialOrderHandled(true)
      }
    }
  }, [orderParam, loading, initialOrderHandled, orders, quotes, clients])
  
  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // Status filter
      if (filterStatus !== 'all' && inv.status !== filterStatus) return false
      
      // Month filter
      if (filterMonth) {
        const invMonth = inv.invoice_date?.slice(0, 7)
        if (invMonth !== filterMonth) return false
      }
      
      // Text search
      if (filterText) {
        const search = filterText.toLowerCase()
        return inv.invoice_number?.toLowerCase().includes(search) ||
               inv.client_name?.toLowerCase().includes(search)
      }
      
      return true
    })
  }, [invoices, filterStatus, filterMonth, filterText])
  
  // Stats
  const stats = useMemo(() => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    
    const thisMonthInvoices = invoices.filter(inv => 
      new Date(inv.invoice_date) >= startOfMonth
    )
    
    const totalInvoiced = thisMonthInvoices.reduce((sum, inv) => sum + Number(inv.total), 0)
    const totalPaid = thisMonthInvoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + Number(inv.total), 0)
    
    const outstandingBalance = invoices
      .filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled')
      .reduce((sum, inv) => sum + (Number(inv.total) - Number(inv.amount_paid || 0)), 0)
    
    const overdueAmount = invoices
      .filter(inv => inv.status === 'overdue' || isOverdue(inv))
      .reduce((sum, inv) => sum + (Number(inv.total) - Number(inv.amount_paid || 0)), 0)
    
    return {
      totalInvoiced,
      totalPaid,
      outstandingBalance,
      overdueAmount
    }
  }, [invoices])
  
  // Calculate totals
  const calculateTotals = (lineItems: InvoiceLineItem[], discount: number) => {
    const subtotal = lineItems.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0)
    const afterDiscount = subtotal - discount
    const vatAmount = afterDiscount * 0.15
    const total = afterDiscount + vatAmount
    return { subtotal, vatAmount, total }
  }
  
  // Handle client selection
  const handleClientSelect = (clientId: string) => {
    const client = clients.find(c => c.id === clientId)
    if (client) {
      setForm(f => ({
        ...f,
        client_id: clientId,
        client_name: client.name || '',
        client_email: client.email || '',
        client_address: client.address || '',
        client_vat: client.vat_number || '',
      }))
    }
  }
  
  // Handle order selection (pre-fill from order/quote)
  const handleOrderSelect = (orderId: string) => {
    const order = orders.find(o => o.id === orderId)
    if (order) {
      setForm(f => ({
        ...f,
        order_id: orderId,
        client_id: order.client_id || '',
        client_name: order.client_name || '',
      }))
      
      // Find the linked quote if any
      if (order.quote_id) {
        const quote = quotes.find(q => q.id === order.quote_id)
        if (quote) {
          const lineItems = Array.isArray(quote.line_items) ? quote.line_items : []
          setForm(f => ({
            ...f,
            quote_id: order.quote_id || '',
            line_items: lineItems.map(item => ({
              product: item.product,
              description: item.description || '',
              qty: item.qty,
              unitPrice: item.unitPrice
            }))
          }))
        }
      }
      
      // Get client details
      const client = clients.find(c => c.id === order.client_id)
      if (client) {
        setForm(f => ({
          ...f,
          client_email: client.email || '',
          client_address: client.address || '',
          client_vat: client.vat_number || '',
        }))
      }
    }
  }
  
  // Line item management
  const addLineItem = () => {
    setForm(f => ({
      ...f,
      line_items: [...f.line_items, { product: '', description: '', qty: 1, unitPrice: 0 }]
    }))
  }
  
  const updateLineItem = (index: number, field: keyof InvoiceLineItem, value: string | number) => {
    setForm(f => ({
      ...f,
      line_items: f.line_items.map((item, i) => i === index ? { ...item, [field]: value } : item)
    }))
  }
  
  const removeLineItem = (index: number) => {
    if (form.line_items.length > 1) {
      setForm(f => ({
        ...f,
        line_items: f.line_items.filter((_, i) => i !== index)
      }))
    }
  }
  
  // Create invoice
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.client_name) return toast.error('Client name is required')
    if (form.line_items.some(li => !li.product || !li.qty || !li.unitPrice)) {
      return toast.error('All line items need product name, quantity, and price')
    }
    
    setSaving(true)
    const invoiceNumber = generateInvoiceNumber(invoices)
    const { subtotal, vatAmount, total } = calculateTotals(form.line_items, form.discount)
    
    const { error } = await supabase.from('invoices').insert({
      invoice_number: invoiceNumber,
      order_id: form.order_id || null,
      quote_id: form.quote_id || null,
      client_id: form.client_id || null,
      client_name: form.client_name,
      client_email: form.client_email || null,
      client_address: form.client_address || null,
      client_vat: form.client_vat || null,
      invoice_date: form.invoice_date,
      due_date: form.due_date,
      status: 'unpaid',
      subtotal,
      discount: form.discount,
      vat_amount: vatAmount,
      total,
      amount_paid: 0,
      line_items: form.line_items,
      notes: form.notes || null,
      payment_terms: form.payment_terms,
    })
    
    setSaving(false)
    
    if (error) {
      console.error('Error creating invoice:', error)
      toast.error('Failed to create invoice')
      return
    }
    
    toast.success(`Invoice ${invoiceNumber} created successfully`)
    
    // Auto-open PDF for saving (cast as Invoice since we only need display fields)
    const newInvoice = {
      invoice_number: invoiceNumber,
      client_name: form.client_name,
      client_email: form.client_email,
      client_address: form.client_address,
      client_vat: form.client_vat,
      invoice_date: form.invoice_date,
      due_date: form.due_date,
      status: 'unpaid',
      subtotal,
      discount: form.discount,
      vat_amount: vatAmount,
      total,
      amount_paid: 0,
      line_items: form.line_items,
      notes: form.notes,
      payment_terms: form.payment_terms,
    } as Invoice
    
    // Open PDF in new window and auto-trigger print dialog
    setTimeout(() => {
      const html = generateInvoicePdfHtml(newInvoice)
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(html)
        printWindow.document.close()
        
        // Auto-trigger print dialog after content loads
        setTimeout(() => {
          printWindow.print()
        }, 500)
      }
    }, 100)
    
    setForm(getEmptyForm())
    setCreateModalOpen(false)
    fetchAll()
  }
  
  // Fetch expenses for an invoice
  const fetchExpenses = async (invoiceId: string) => {
    const { data } = await supabase
      .from('invoice_expenses')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('expense_date', { ascending: false })
    setExpenses(data || [])
  }
  
  // Upload receipt image
  const uploadReceipt = async (file: File) => {
    setUploadingReceipt(true)
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `receipts/${fileName}`
    
    const { error } = await supabase.storage.from('receipts').upload(filePath, file)
    
    if (error) {
      toast.error('Failed to upload receipt')
      setUploadingReceipt(false)
      return null
    }
    
    const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(filePath)
    setUploadingReceipt(false)
    return publicUrl
  }
  
  // Add expense
  const addExpense = async () => {
    if (!selectedInvoice) return
    if (!expenseForm.description || !expenseForm.amount) {
      toast.error('Please fill in description and amount')
      return
    }
    
    setSavingExpense(true)
    const { error } = await supabase.from('invoice_expenses').insert({
      invoice_id: selectedInvoice.id,
      category: expenseForm.category,
      description: expenseForm.description,
      amount: parseFloat(expenseForm.amount),
      expense_date: expenseForm.expense_date,
      receipt_url: expenseForm.receipt_url,
    })
    
    if (error) {
      toast.error('Failed to add expense')
      setSavingExpense(false)
      return
    }
    
    toast.success('Expense added')
    setExpenseModalOpen(false)
    setExpenseForm({
      category: 'other',
      description: '',
      amount: '',
      expense_date: new Date().toISOString().split('T')[0],
      receipt_url: null,
    })
    setSavingExpense(false)
    fetchExpenses(selectedInvoice.id)
  }
  
  // Delete expense
  const deleteExpense = async (expenseId: string) => {
    if (!confirm('Delete this expense?')) return
    const { error } = await supabase.from('invoice_expenses').delete().eq('id', expenseId)
    if (error) {
      toast.error('Failed to delete expense')
      return
    }
    toast.success('Expense deleted')
    if (selectedInvoice) fetchExpenses(selectedInvoice.id)
  }
  
  // Calculate profit
  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0)
  const profit = selectedInvoice ? Number(selectedInvoice.total) - totalExpenses : 0
  const profitMargin = selectedInvoice && Number(selectedInvoice.total) > 0 
    ? (profit / Number(selectedInvoice.total)) * 100 
    : 0
  
  // Open detail modal
  const openDetail = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    fetchExpenses(invoice.id)
    setEditForm({
      client_id: invoice.client_id || '',
      client_name: invoice.client_name || '',
      client_email: invoice.client_email || '',
      client_address: invoice.client_address || '',
      client_vat: invoice.client_vat || '',
      invoice_date: invoice.invoice_date || '',
      due_date: invoice.due_date || '',
      discount: invoice.discount || 0,
      notes: invoice.notes || '',
      payment_terms: invoice.payment_terms || 'Payment due within 30 days',
      line_items: invoice.line_items || [],
      order_id: invoice.order_id || '',
      quote_id: invoice.quote_id || '',
    })
    setEditing(false)
  }
  
  // Save edit
  const saveEdit = async () => {
    if (!selectedInvoice) return
    const loadingToast = toast.loading('Saving changes...')
    
    const { subtotal, vatAmount, total } = calculateTotals(editForm.line_items, editForm.discount)
    
    const { error } = await supabase.from('invoices').update({
      client_name: editForm.client_name,
      client_email: editForm.client_email,
      client_address: editForm.client_address,
      client_vat: editForm.client_vat,
      invoice_date: editForm.invoice_date,
      due_date: editForm.due_date,
      subtotal,
      discount: editForm.discount,
      vat_amount: vatAmount,
      total,
      line_items: editForm.line_items,
      notes: editForm.notes,
      payment_terms: editForm.payment_terms,
      updated_at: new Date().toISOString(),
    }).eq('id', selectedInvoice.id)
    
    if (error) {
      console.error('Error saving:', error)
      toast.error('Failed to save changes', { id: loadingToast })
      return
    }
    
    toast.success('Invoice updated successfully', { id: loadingToast })
    setSelectedInvoice(null)
    setEditing(false)
    fetchAll()
  }
  
  // Delete invoice
  const deleteInvoice = async () => {
    if (!selectedInvoice) return
    if (!confirm(`Delete invoice "${selectedInvoice.invoice_number}"? This cannot be undone.`)) return
    
    const loadingToast = toast.loading('Deleting invoice...')
    const { error } = await supabase.from('invoices').delete().eq('id', selectedInvoice.id)
    
    if (error) {
      console.error('Error deleting:', error)
      toast.error('Failed to delete invoice', { id: loadingToast })
      return
    }
    
    toast.success('Invoice deleted', { id: loadingToast })
    setSelectedInvoice(null)
    fetchAll()
  }
  
  // Open PDF and auto-trigger print dialog
  const openPdf = (invoice: Invoice) => {
    const html = generateInvoicePdfHtml(invoice)
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      
      // Auto-trigger print dialog after a short delay
      setTimeout(() => {
        printWindow.print()
      }, 500)
      
      toast.success('Print dialog opened - select "Save as PDF" to download')
    } else {
      toast.error('Please allow popups to view the invoice')
    }
  }
  
  // Record payment
  const openPaymentModal = (invoice: Invoice) => {
    setPaymentInvoice(invoice)
    const balance = Number(invoice.total) - Number(invoice.amount_paid || 0)
    setPaymentAmount(balance.toFixed(2))
    setPaymentMethod('EFT')
    setPaymentReference('')
    setPaymentDate(new Date().toISOString().split('T')[0])
    setPaymentModalOpen(true)
  }
  
  const recordPayment = async () => {
    if (!paymentInvoice) return
    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid payment amount')
      return
    }
    
    const loadingToast = toast.loading('Recording payment...')
    const newAmountPaid = Number(paymentInvoice.amount_paid || 0) + amount
    const total = Number(paymentInvoice.total)
    
    let newStatus: string
    if (newAmountPaid >= total) {
      newStatus = 'paid'
    } else if (newAmountPaid > 0) {
      newStatus = 'partial'
    } else {
      newStatus = paymentInvoice.status
    }
    
    const { error } = await supabase.from('invoices').update({
      amount_paid: newAmountPaid,
      status: newStatus,
      updated_at: new Date().toISOString(),
    }).eq('id', paymentInvoice.id)
    
    if (error) {
      console.error('Error recording payment:', error)
      toast.error('Failed to record payment', { id: loadingToast })
      return
    }
    
    toast.success(`Payment of ${formatCurrency(amount)} recorded`, { id: loadingToast })
    setPaymentModalOpen(false)
    setPaymentInvoice(null)
    setSelectedInvoice(null)
    fetchAll()
  }
  
  // Export to CSV
  const exportToCsv = () => {
    const monthFilter = filterMonth || new Date().toISOString().slice(0, 7)
    const monthInvoices = invoices.filter(inv => inv.invoice_date?.startsWith(monthFilter))
    
    if (monthInvoices.length === 0) {
      toast.error('No invoices to export for selected month')
      return
    }
    
    const headers = ['Invoice #', 'Date', 'Client', 'Subtotal', 'VAT', 'Total', 'Status', 'Amount Paid']
    const rows = monthInvoices.map(inv => [
      inv.invoice_number,
      inv.invoice_date,
      inv.client_name,
      Number(inv.subtotal).toFixed(2),
      Number(inv.vat_amount).toFixed(2),
      Number(inv.total).toFixed(2),
      inv.status,
      Number(inv.amount_paid || 0).toFixed(2)
    ])
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invoices-${monthFilter}.csv`
    a.click()
    URL.revokeObjectURL(url)
    
    toast.success(`Exported ${monthInvoices.length} invoices`)
  }
  
  // Preview totals
  const previewTotals = calculateTotals(form.line_items, form.discount)
  const editTotals = calculateTotals(editForm.line_items, editForm.discount)
  
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
        <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportToCsv}
            className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            Create Invoice
          </button>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
            <FileText className="w-4 h-4" />
            Invoiced (Month)
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(stats.totalInvoiced)}</div>
        </div>
        
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
          <div className="flex items-center gap-2 text-emerald-600 text-sm mb-1">
            <CheckCircle className="w-4 h-4" />
            Paid (Month)
          </div>
          <div className="text-2xl font-bold text-emerald-700">{formatCurrency(stats.totalPaid)}</div>
        </div>
        
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
          <div className="flex items-center gap-2 text-blue-600 text-sm mb-1">
            <Clock className="w-4 h-4" />
            Outstanding
          </div>
          <div className="text-2xl font-bold text-blue-700">{formatCurrency(stats.outstandingBalance)}</div>
        </div>
        
        <div className={`rounded-xl border p-4 ${stats.overdueAmount > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className={`flex items-center gap-2 text-sm mb-1 ${stats.overdueAmount > 0 ? 'text-red-600' : 'text-slate-500'}`}>
            <AlertTriangle className="w-4 h-4" />
            Overdue
          </div>
          <div className={`text-2xl font-bold ${stats.overdueAmount > 0 ? 'text-red-700' : 'text-slate-400'}`}>
            {formatCurrency(stats.overdueAmount)}
          </div>
        </div>
      </div>
      
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search invoices..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">All Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <input
          type="month"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          placeholder="Filter by month"
        />
        {(filterStatus !== 'all' || filterMonth || filterText) && (
          <button
            onClick={() => { setFilterStatus('all'); setFilterMonth(''); setFilterText('') }}
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>
      
      {/* Invoice List */}
      {filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 mb-3">No invoices found</p>
          <button onClick={() => setCreateModalOpen(true)} className="text-teal-600 font-medium hover:underline">
            + Create your first invoice
          </button>
        </div>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredInvoices.map(invoice => (
              <div
                key={invoice.id}
                onClick={() => openDetail(invoice)}
                className={`rounded-xl border p-4 cursor-pointer active:bg-slate-50 ${
                  invoice.status === 'overdue' ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-mono text-sm text-slate-500">{invoice.invoice_number}</span>
                    <h3 className="font-semibold text-slate-800">{invoice.client_name}</h3>
                  </div>
                  <StatusBadge status={invoice.status} />
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">{formatDate(invoice.invoice_date)}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{formatCurrency(invoice.total)}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); openPdf(invoice) }}
                      className="p-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                  <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between text-xs">
                    <span className="text-slate-500">Due: {formatDate(invoice.due_date)}</span>
                    <span className="text-slate-500">
                      Balance: {formatCurrency(Number(invoice.total) - Number(invoice.amount_paid || 0))}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Invoice</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Client</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Due</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Total</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Balance</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map(invoice => {
                  const balance = Number(invoice.total) - Number(invoice.amount_paid || 0)
                  return (
                    <tr 
                      key={invoice.id} 
                      onClick={() => openDetail(invoice)} 
                      className={`cursor-pointer ${invoice.status === 'overdue' ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50'}`}
                    >
                      <td className="px-4 py-3 font-mono text-slate-600">{invoice.invoice_number}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{invoice.client_name}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(invoice.invoice_date)}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(invoice.due_date)}</td>
                      <td className="px-4 py-3"><StatusBadge status={invoice.status} /></td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(invoice.total)}</td>
                      <td className="px-4 py-3 text-right">
                        {invoice.status !== 'paid' ? (
                          <span className={balance > 0 ? 'text-amber-600 font-medium' : ''}>
                            {formatCurrency(balance)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => openPdf(invoice)}
                            className="flex items-center gap-1 bg-teal-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-teal-700"
                            title="View PDF"
                          >
                            <Eye className="w-3 h-3" />
                            PDF
                          </button>
                          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                            <button
                              onClick={() => openPaymentModal(invoice)}
                              className="flex items-center gap-1 bg-emerald-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-emerald-700"
                              title="Record Payment"
                            >
                              <CreditCard className="w-3 h-3" />
                              Pay
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      
      {/* Create Invoice Modal */}
      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create Invoice" wide>
        <form onSubmit={handleCreateSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {/* Link to Order */}
          <div className="bg-slate-50 rounded-xl p-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Link to Order <span className="text-slate-400">(optional - will pre-fill details)</span>
            </label>
            <select
              value={form.order_id}
              onChange={(e) => handleOrderSelect(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">— Select an order —</option>
              {orders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.order_number} - {o.client_name} ({formatCurrency(o.value_zar)})
                </option>
              ))}
            </select>
          </div>
          
          {/* Client Details */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700">Client Details</label>
            <select
              value={form.client_id}
              onChange={(e) => handleClientSelect(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Select existing client or enter manually...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input
              required
              placeholder="Client Name *"
              value={form.client_name}
              onChange={(e) => setForm(f => ({ ...f, client_name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="Email"
                value={form.client_email}
                onChange={(e) => setForm(f => ({ ...f, client_email: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <input
                placeholder="VAT Number"
                value={form.client_vat}
                onChange={(e) => setForm(f => ({ ...f, client_vat: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <input
              placeholder="Address"
              value={form.client_address}
              onChange={(e) => setForm(f => ({ ...f, client_address: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          
          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Date</label>
              <input
                type="date"
                required
                value={form.invoice_date}
                onChange={(e) => setForm(f => ({ ...f, invoice_date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
              <input
                type="date"
                required
                value={form.due_date}
                onChange={(e) => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
          
          {/* Line Items */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-700">Line Items</label>
              <button type="button" onClick={addLineItem} className="text-xs text-teal-600 font-semibold">
                + Add Item
              </button>
            </div>
            
            {form.line_items.map((item, index) => (
              <div key={index} className="bg-white rounded-lg border border-slate-200 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Item {index + 1}</span>
                  {form.line_items.length > 1 && (
                    <button type="button" onClick={() => removeLineItem(index)} className="text-xs text-red-500">
                      Remove
                    </button>
                  )}
                </div>
                <input
                  placeholder="Product/Description"
                  value={item.product}
                  onChange={(e) => updateLineItem(index, 'product', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    placeholder="Qty"
                    value={item.qty || ''}
                    onChange={(e) => updateLineItem(index, 'qty', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <input
                    type="number"
                    placeholder="Unit Price"
                    value={item.unitPrice || ''}
                    onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <div className="px-3 py-2 bg-slate-100 rounded-lg text-sm font-medium text-right">
                    {formatCurrency(item.qty * item.unitPrice)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Discount */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Discount (R)</label>
            <input
              type="number"
              value={form.discount || ''}
              onChange={(e) => setForm(f => ({ ...f, discount: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="0.00"
            />
          </div>
          
          {/* Notes & Terms */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Terms</label>
              <input
                value={form.payment_terms}
                onChange={(e) => setForm(f => ({ ...f, payment_terms: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <input
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Optional notes..."
              />
            </div>
          </div>
          
          {/* Preview Totals */}
          <div className="bg-slate-800 text-white rounded-xl p-4">
            <div className="flex justify-between text-sm mb-1 text-slate-300">
              <span>Subtotal:</span><span>{formatCurrency(previewTotals.subtotal)}</span>
            </div>
            {form.discount > 0 && (
              <div className="flex justify-between text-sm mb-1 text-red-400">
                <span>Discount:</span><span>-{formatCurrency(form.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm mb-2 text-slate-300">
              <span>VAT (15%):</span><span>{formatCurrency(previewTotals.vatAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-xl border-t border-slate-600 pt-2">
              <span>Total:</span><span>{formatCurrency(previewTotals.total)}</span>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 sticky bottom-0 bg-white">
            <button type="button" onClick={() => setCreateModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Creating...' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </Modal>
      
      {/* Invoice Detail Modal */}
      <Modal 
        open={!!selectedInvoice} 
        onClose={() => setSelectedInvoice(null)} 
        title={editing ? 'Edit Invoice' : `Invoice ${selectedInvoice?.invoice_number}`} 
        wide
      >
        {selectedInvoice && (
          <div className="space-y-4">
            {editing ? (
              /* EDIT MODE */
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                {/* Client Details */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-slate-700">Client Details</label>
                  <input
                    required
                    placeholder="Client Name *"
                    value={editForm.client_name}
                    onChange={(e) => setEditForm(f => ({ ...f, client_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      placeholder="Email"
                      value={editForm.client_email}
                      onChange={(e) => setEditForm(f => ({ ...f, client_email: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <input
                      placeholder="VAT Number"
                      value={editForm.client_vat}
                      onChange={(e) => setEditForm(f => ({ ...f, client_vat: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <input
                    placeholder="Address"
                    value={editForm.client_address}
                    onChange={(e) => setEditForm(f => ({ ...f, client_address: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                
                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Date</label>
                    <input
                      type="date"
                      value={editForm.invoice_date}
                      onChange={(e) => setEditForm(f => ({ ...f, invoice_date: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={editForm.due_date}
                      onChange={(e) => setEditForm(f => ({ ...f, due_date: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
                
                {/* Line Items */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-700">Line Items</label>
                    <button 
                      type="button" 
                      onClick={() => setEditForm(f => ({ ...f, line_items: [...f.line_items, { product: '', description: '', qty: 1, unitPrice: 0 }] }))} 
                      className="text-xs text-teal-600 font-semibold"
                    >
                      + Add Item
                    </button>
                  </div>
                  
                  {editForm.line_items.map((item, index) => (
                    <div key={index} className="bg-white rounded-lg border border-slate-200 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">Item {index + 1}</span>
                        {editForm.line_items.length > 1 && (
                          <button 
                            type="button" 
                            onClick={() => setEditForm(f => ({ ...f, line_items: f.line_items.filter((_, i) => i !== index) }))} 
                            className="text-xs text-red-500"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        placeholder="Product/Description"
                        value={item.product}
                        onChange={(e) => setEditForm(f => ({
                          ...f,
                          line_items: f.line_items.map((it, i) => i === index ? { ...it, product: e.target.value } : it)
                        }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          placeholder="Qty"
                          value={item.qty || ''}
                          onChange={(e) => setEditForm(f => ({
                            ...f,
                            line_items: f.line_items.map((it, i) => i === index ? { ...it, qty: parseInt(e.target.value) || 0 } : it)
                          }))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                        <input
                          type="number"
                          placeholder="Unit Price"
                          value={item.unitPrice || ''}
                          onChange={(e) => setEditForm(f => ({
                            ...f,
                            line_items: f.line_items.map((it, i) => i === index ? { ...it, unitPrice: parseFloat(e.target.value) || 0 } : it)
                          }))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                        <div className="px-3 py-2 bg-slate-100 rounded-lg text-sm font-medium text-right">
                          {formatCurrency(item.qty * item.unitPrice)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Discount & Notes */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Discount (R)</label>
                    <input
                      type="number"
                      value={editForm.discount || ''}
                      onChange={(e) => setEditForm(f => ({ ...f, discount: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                    <input
                      value={editForm.notes}
                      onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
                
                {/* Preview Totals */}
                <div className="bg-slate-100 rounded-xl p-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Subtotal:</span><span>{formatCurrency(editTotals.subtotal)}</span>
                  </div>
                  {editForm.discount > 0 && (
                    <div className="flex justify-between text-sm mb-1 text-red-600">
                      <span>Discount:</span><span>-{formatCurrency(editForm.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm mb-1">
                    <span>VAT (15%):</span><span>{formatCurrency(editTotals.vatAmount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t border-slate-300 pt-2 mt-2">
                    <span>Total:</span><span>{formatCurrency(editTotals.total)}</span>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 sticky bottom-0 bg-white">
                  <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
                  <button onClick={saveEdit} className="btn-primary">Save Changes</button>
                </div>
              </div>
            ) : (
              /* VIEW MODE */
              <>
                {/* Header */}
                <div className="bg-gradient-to-r from-teal-500 to-teal-600 rounded-xl p-4 text-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-white/70 text-sm">{selectedInvoice.invoice_number}</span>
                      <h3 className="text-xl font-bold">{selectedInvoice.client_name}</h3>
                    </div>
                    <StatusBadge status={selectedInvoice.status} />
                  </div>
                </div>
                
                {/* Info Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Client</h4>
                    <p className="font-medium text-slate-800">{selectedInvoice.client_name}</p>
                    {selectedInvoice.client_email && <p className="text-sm text-slate-600">{selectedInvoice.client_email}</p>}
                    {selectedInvoice.client_address && <p className="text-sm text-slate-600">{selectedInvoice.client_address}</p>}
                    {selectedInvoice.client_vat && <p className="text-sm text-slate-600">VAT: {selectedInvoice.client_vat}</p>}
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Details</h4>
                    <p className="text-sm"><span className="text-slate-500">Date:</span> <span className="font-medium">{formatDate(selectedInvoice.invoice_date)}</span></p>
                    <p className="text-sm"><span className="text-slate-500">Due:</span> <span className="font-medium">{formatDate(selectedInvoice.due_date)}</span></p>
                    <p className="text-sm"><span className="text-slate-500">Terms:</span> <span className="font-medium">{selectedInvoice.payment_terms}</span></p>
                  </div>
                </div>
                
                {/* Line Items */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 uppercase">
                    Line Items ({selectedInvoice.line_items?.length || 0})
                  </div>
                  <div className="divide-y divide-slate-100">
                    {selectedInvoice.line_items?.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-4">
                        <div className="flex-1">
                          <p className="font-medium text-slate-800">{item.product}</p>
                          {item.description && <p className="text-xs text-slate-500">{item.description}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-slate-500">× {item.qty} @ {formatCurrency(item.unitPrice)}</p>
                          <p className="font-semibold">{formatCurrency(item.qty * item.unitPrice)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Totals */}
                <div className="bg-slate-800 text-white rounded-xl p-4">
                  <div className="flex justify-between text-sm mb-1 text-slate-300">
                    <span>Subtotal:</span><span>{formatCurrency(selectedInvoice.subtotal)}</span>
                  </div>
                  {Number(selectedInvoice.discount) > 0 && (
                    <div className="flex justify-between text-sm mb-1 text-red-400">
                      <span>Discount:</span><span>-{formatCurrency(selectedInvoice.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm mb-2 text-slate-300">
                    <span>VAT (15%):</span><span>{formatCurrency(selectedInvoice.vat_amount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-xl border-t border-slate-600 pt-2">
                    <span>Total:</span><span>{formatCurrency(selectedInvoice.total)}</span>
                  </div>
                  {Number(selectedInvoice.amount_paid) > 0 && (
                    <>
                      <div className="flex justify-between text-sm mt-2 text-emerald-400">
                        <span>Paid:</span><span>-{formatCurrency(selectedInvoice.amount_paid)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg mt-1">
                        <span>Balance Due:</span>
                        <span>{formatCurrency(Number(selectedInvoice.total) - Number(selectedInvoice.amount_paid))}</span>
                      </div>
                    </>
                  )}
                </div>
                
                {/* Notes */}
                {selectedInvoice.notes && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-amber-700 uppercase mb-1">Notes</h4>
                    <p className="text-sm text-slate-700">{selectedInvoice.notes}</p>
                  </div>
                )}
                
                {/* Profit Indicator */}
                <div className={`rounded-xl p-4 ${profitMargin >= 60 ? 'bg-emerald-50 border border-emerald-200' : profitMargin >= 30 ? 'bg-amber-50 border border-amber-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className={`w-5 h-5 ${profitMargin >= 60 ? 'text-emerald-600' : profitMargin >= 30 ? 'text-amber-600' : 'text-red-600'}`} />
                      <span className="font-semibold text-slate-800">Job Profitability</span>
                    </div>
                    <button
                      onClick={() => setExpenseModalOpen(true)}
                      className="flex items-center gap-1 text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50"
                    >
                      <Plus className="w-3 h-3" />
                      Add Expense
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-slate-500">Invoice Total</p>
                      <p className="text-lg font-bold text-slate-800">{formatCurrency(selectedInvoice.total)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Expenses ({expenses.length})</p>
                      <p className="text-lg font-bold text-red-600">-{formatCurrency(totalExpenses)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Profit</p>
                      <p className={`text-lg font-bold ${profitMargin >= 60 ? 'text-emerald-600' : profitMargin >= 30 ? 'text-amber-600' : 'text-red-600'}`}>
                        {formatCurrency(profit)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Margin</span>
                      <span>{profitMargin.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${profitMargin >= 60 ? 'bg-emerald-500' : profitMargin >= 30 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, Math.max(0, profitMargin))}%` }}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Expenses List */}
                {expenses.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                      <Receipt className="w-4 h-4" />
                      Expenses ({expenses.length})
                    </div>
                    <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                      {expenses.map((expense) => (
                        <div key={expense.id} className="flex items-center justify-between p-3 hover:bg-slate-50">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{EXPENSE_CATEGORIES[expense.category]?.icon || '📄'}</span>
                            <div>
                              <p className="font-medium text-slate-800 text-sm">{expense.description}</p>
                              <p className="text-xs text-slate-500">
                                {EXPENSE_CATEGORIES[expense.category]?.label} • {formatDate(expense.expense_date)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-red-600">-{formatCurrency(expense.amount)}</span>
                            {expense.receipt_url && (
                              <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-slate-100 rounded">
                                <Camera className="w-4 h-4 text-slate-400" />
                              </a>
                            )}
                            <button onClick={() => deleteExpense(expense.id)} className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-200">
                  <button 
                    onClick={() => openPdf(selectedInvoice)} 
                    className="flex-1 flex items-center justify-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700"
                  >
                    <Eye className="w-4 h-4" />
                    View PDF
                  </button>
                  {selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'cancelled' && (
                    <button 
                      onClick={() => openPaymentModal(selectedInvoice)} 
                      className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700"
                    >
                      <CreditCard className="w-4 h-4" />
                      Record Payment
                    </button>
                  )}
                  <button 
                    onClick={() => setEditing(true)} 
                    className="flex items-center justify-center gap-2 border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button 
                    onClick={deleteInvoice} 
                    className="flex items-center justify-center gap-2 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
      
      {/* Payment Modal */}
      <Modal open={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} title="Record Payment">
        {paymentInvoice && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex justify-between mb-2">
                <span className="text-slate-600">Invoice:</span>
                <span className="font-medium">{paymentInvoice.invoice_number}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-slate-600">Total:</span>
                <span className="font-medium">{formatCurrency(paymentInvoice.total)}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-slate-600">Already Paid:</span>
                <span className="font-medium">{formatCurrency(paymentInvoice.amount_paid || 0)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t border-slate-200 pt-2 mt-2">
                <span>Balance Due:</span>
                <span>{formatCurrency(Number(paymentInvoice.total) - Number(paymentInvoice.amount_paid || 0))}</span>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Amount (R)</label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="0.00"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="EFT">EFT</option>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reference</label>
              <input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Payment reference..."
              />
            </div>
            
            <div className="flex gap-3 pt-4">
              <button onClick={() => setPaymentModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={recordPayment} className="btn-primary flex-1">Record Payment</button>
            </div>
          </div>
        )}
      </Modal>
      
      {/* Add Expense Modal */}
      <Modal open={expenseModalOpen} onClose={() => setExpenseModalOpen(false)} title="Add Expense">
        <div className="space-y-4">
          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(EXPENSE_CATEGORIES) as [ExpenseCategory, { label: string; icon: string }][]).map(([key, { label, icon }]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setExpenseForm(f => ({ ...f, category: key }))}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-left text-sm transition-all ${
                    expenseForm.category === key 
                      ? 'border-teal-500 bg-teal-50 text-teal-700' 
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xl">{icon}</span>
                  <span className="font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
            <input
              value={expenseForm.description}
              onChange={(e) => setExpenseForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="e.g., Fuel to client site, Cable ties, etc."
            />
          </div>
          
          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Amount (R) *</label>
              <input
                type="number"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={expenseForm.expense_date}
                onChange={(e) => setExpenseForm(f => ({ ...f, expense_date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
          
          {/* Receipt Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Receipt (optional)</label>
            {expenseForm.receipt_url ? (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={expenseForm.receipt_url} alt="Receipt" className="w-16 h-16 object-cover rounded" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-700">Receipt uploaded</p>
                  <button 
                    type="button" 
                    onClick={() => setExpenseForm(f => ({ ...f, receipt_url: null }))}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-teal-400 hover:bg-teal-50/50 transition-colors">
                <Camera className="w-5 h-5 text-slate-400" />
                <span className="text-sm text-slate-500">{uploadingReceipt ? 'Uploading...' : 'Upload receipt photo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={uploadingReceipt}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const url = await uploadReceipt(file)
                      if (url) setExpenseForm(f => ({ ...f, receipt_url: url }))
                    }
                  }}
                />
              </label>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button onClick={() => setExpenseModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={addExpense} disabled={savingExpense} className="btn-primary flex-1">
              {savingExpense ? 'Saving...' : 'Add Expense'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
