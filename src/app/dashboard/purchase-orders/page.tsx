'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { PurchaseOrder, POLineItem, PurchaseOrderStatus } from '@/lib/types'
import { PO_STATUS_CONFIG } from '@/lib/types'
import { Plus, X, Search, Edit2, Trash2, Download, Eye, ClipboardList } from 'lucide-react'
import { toast } from 'sonner'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(val: number | undefined | null, currency = 'USD'): string {
  if (val == null || isNaN(val)) return '$0.00'
  if (currency === 'ZAR') return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(val)
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function calcLineItem(item: POLineItem) {
  const exclTotal = item.qty * item.unit_price
  const discAmount = exclTotal * (item.disc_percent / 100)
  const afterDisc = exclTotal - discAmount
  const vatAmount = afterDisc * (item.vat_percent / 100)
  const inclTotal = afterDisc + vatAmount
  return { exclTotal, discAmount, afterDisc, vatAmount, inclTotal }
}

function recalcTotals(items: POLineItem[], overallDiscount: number) {
  let subtotal = 0
  let totalItemDisc = 0
  let totalVat = 0

  items.forEach(item => {
    const calc = calcLineItem(item)
    subtotal += calc.exclTotal
    totalItemDisc += calc.discAmount
    totalVat += calc.vatAmount
  })

  const overallDiscAmount = subtotal * (overallDiscount / 100)
  const totalDiscount = totalItemDisc + overallDiscAmount
  const totalExcl = subtotal - totalDiscount
  // Recalculate VAT on discounted amount if there's an overall discount
  const adjustedVat = overallDiscount > 0
    ? items.reduce((sum, item) => {
        const lineExcl = item.qty * item.unit_price
        const lineDisc = lineExcl * (item.disc_percent / 100) + lineExcl * (overallDiscount / 100)
        return sum + (lineExcl - lineDisc) * (item.vat_percent / 100)
      }, 0)
    : totalVat

  const grandTotal = totalExcl + adjustedVat

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    total_discount: parseFloat(totalDiscount.toFixed(2)),
    total_vat: parseFloat(adjustedVat.toFixed(2)),
    grand_total: parseFloat(grandTotal.toFixed(2)),
    balance_due: parseFloat(grandTotal.toFixed(2)),
  }
}

// ── Generate PO Number ───────────────────────────────────────────────────────

async function generatePONumber(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data } = await supabase
    .from('purchase_orders')
    .select('po_number')
    .order('po_number', { ascending: false })
    .limit(1)

  let sequence = 1
  if (data && data.length > 0) {
    const lastNum = data[0].po_number
    const lastSeq = parseInt(lastNum.replace('PO', ''), 10)
    if (!isNaN(lastSeq)) {
      sequence = lastSeq + 1
    }
  }

  return `PO${sequence.toString().padStart(7, '0')}`
}

// ── PDF Generator ────────────────────────────────────────────────────────────

function generatePOPdfHtml(po: PurchaseOrder): string {
  const lineItems: POLineItem[] = Array.isArray(po.line_items)
    ? po.line_items
    : typeof po.line_items === 'string'
      ? JSON.parse(po.line_items)
      : []

  const cs = po.currency === 'ZAR' ? 'R' : '$'

  const fmtMoney = (v: number) => `${cs}${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const lineItemsHtml = lineItems.map((item) => {
    const calc = calcLineItem(item)
    return `
    <tr>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #334155;">${item.description}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 11px;">${item.qty}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 11px;">${fmtMoney(item.unit_price)}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 11px;">${item.disc_percent}%</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 11px;">${item.vat_percent}%</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 11px;">${fmtMoney(calc.afterDisc)}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 11px; font-weight: 600;">${fmtMoney(calc.inclTotal)}</td>
    </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html>
<head>
  <title>Purchase Order ${po.po_number}</title>
  <style>
    @page { margin: 25px 35px; size: A4; }
    @media print {
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
      .no-print { display: none !important; }
    }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.4; margin: 0; padding: 20px 30px; }
  </style>
</head>
<body>
  <!-- Header -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 0;">
    <tr>
      <td style="width: 50%; vertical-align: top; padding: 0;">
        <img src="https://iwyiqsmcwoengowjipws.supabase.co/storage/v1/object/public/product-images/landwell-logo.png?v=3" alt="Landwell Africa" style="height: 50px; width: auto;" />
      </td>
      <td style="width: 50%; vertical-align: top; text-align: right; padding: 0;">
        <div style="font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: 1px;">PURCHASE ORDER</div>
      </td>
    </tr>
  </table>

  <div style="height: 2px; background: #4AB3E6; margin: 10px 0 16px 0;"></div>

  <!-- PO Meta Fields -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px;">
    <tr>
      <td style="padding: 4px 0; width: 50%;"><strong>PO Number:</strong> ${po.po_number}</td>
      <td style="padding: 4px 0; width: 50%; text-align: right;"><strong>Date:</strong> ${formatDate(po.date)}</td>
    </tr>
    <tr>
      <td style="padding: 4px 0;"><strong>Reference:</strong> ${po.reference || '-'}</td>
      <td style="padding: 4px 0; text-align: right;"><strong>Due Date:</strong> ${formatDate(po.due_date)}</td>
    </tr>
    <tr>
      <td style="padding: 4px 0;"><strong>Overall Discount:</strong> ${po.overall_discount || 0}%</td>
      <td style="padding: 4px 0; text-align: right;"><strong>Page:</strong> 1 of 1</td>
    </tr>
  </table>

  <!-- FROM / TO -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
    <tr>
      <td style="width: 50%; vertical-align: top; padding: 12px 16px; background: #f8fafc; border-radius: 8px;">
        <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; font-weight: 700; margin-bottom: 6px;">From</div>
        <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">LANDWELL AFRICA (PTY) LTD</div>
        <div style="font-size: 10px; color: #475569; line-height: 1.5;">
          VAT: 4940318589<br>
          Unit 4 The Refinery<br>
          Cnr North Reef &amp; George Allen Road<br>
          Bedfordview, Gauteng, 2007
        </div>
      </td>
      <td style="width: 10px;"></td>
      <td style="width: 50%; vertical-align: top; padding: 12px 16px; background: #f8fafc; border-radius: 8px;">
        <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; font-weight: 700; margin-bottom: 6px;">To</div>
        <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">${po.supplier_name}</div>
        <div style="font-size: 10px; color: #475569; line-height: 1.5;">
          ${(po.supplier_address || '').replace(/,\s*/g, '<br>')}
        </div>
      </td>
    </tr>
  </table>

  <!-- Line Items Table -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
    <thead>
      <tr style="background: #0f172a;">
        <th style="padding: 10px; text-align: left; color: white; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em;">Description</th>
        <th style="padding: 10px; text-align: center; color: white; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; width: 55px;">Qty</th>
        <th style="padding: 10px; text-align: right; color: white; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; width: 90px;">Excl. Price (${po.currency})</th>
        <th style="padding: 10px; text-align: center; color: white; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; width: 50px;">Disc %</th>
        <th style="padding: 10px; text-align: center; color: white; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; width: 50px;">VAT %</th>
        <th style="padding: 10px; text-align: right; color: white; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; width: 90px;">Excl. Total</th>
        <th style="padding: 10px; text-align: right; color: white; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; width: 90px;">Incl. Total</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemsHtml}
      ${lineItems.length === 0 ? '<tr><td colspan="7" style="padding: 20px; text-align: center; color: #94a3b8; font-size: 11px;">No items</td></tr>' : ''}
    </tbody>
  </table>

  <!-- Totals -->
  <table style="width: 260px; margin-left: auto; border-collapse: collapse;">
    ${po.total_discount > 0 ? `
    <tr>
      <td style="padding: 6px 8px; font-size: 11px; color: #dc2626;">Total Discount:</td>
      <td style="padding: 6px 8px; font-size: 11px; text-align: right; color: #dc2626;">-${fmtMoney(po.total_discount)}</td>
    </tr>` : ''}
    <tr>
      <td style="padding: 6px 8px; font-size: 11px; border-bottom: 1px solid #e2e8f0;">Total Exclusive:</td>
      <td style="padding: 6px 8px; font-size: 11px; text-align: right; border-bottom: 1px solid #e2e8f0;">${fmtMoney(po.subtotal - po.total_discount)}</td>
    </tr>
    <tr>
      <td style="padding: 6px 8px; font-size: 11px; border-bottom: 1px solid #e2e8f0;">Total VAT:</td>
      <td style="padding: 6px 8px; font-size: 11px; text-align: right; border-bottom: 1px solid #e2e8f0;">${fmtMoney(po.total_vat)}</td>
    </tr>
    <tr style="background: #0f172a;">
      <td style="padding: 8px 10px; font-size: 12px; font-weight: 700; color: white; border-radius: 4px 0 0 4px;">Grand Total:</td>
      <td style="padding: 8px 10px; font-size: 12px; font-weight: 700; color: white; text-align: right; border-radius: 0 4px 4px 0;">${fmtMoney(po.grand_total)}</td>
    </tr>
    <tr>
      <td style="padding: 8px; font-size: 11px; font-weight: 600;">Balance Due:</td>
      <td style="padding: 8px; font-size: 11px; text-align: right; font-weight: 700; color: #0f172a;">${fmtMoney(po.balance_due)}</td>
    </tr>
  </table>

  ${po.notes ? `
  <div style="margin-top: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px;">
    <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 6px; font-weight: 600;">Notes</div>
    <div style="font-size: 11px; color: #334155; white-space: pre-wrap;">${po.notes}</div>
  </div>` : ''}

  <div style="margin-top: 40px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px;">
    LANDWELL AFRICA (PTY) LTD | Unit 4 The Refinery, Cnr North Reef & George Allen Road, Bedfordview, Gauteng, 2007 | VAT: 4940318589
  </div>
</body>
</html>`
}

// ── Modal ────────────────────────────────────────────────────────────────────

function Modal({
  open,
  onClose,
  title,
  wide = false,
  children,
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
        className={`bg-white rounded-2xl shadow-xl ${wide ? 'max-w-4xl' : 'max-w-lg'} w-full max-h-[90vh] overflow-hidden`}
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

// ── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const cfg = PO_STATUS_CONFIG[status] || PO_STATUS_CONFIG.draft
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

// ── Empty Line Item ──────────────────────────────────────────────────────────

const emptyLineItem: POLineItem = { description: '', qty: 1, unit_price: 0, disc_percent: 0, vat_percent: 0 }

// ── Main Page ────────────────────────────────────────────────────────────────

export default function PurchaseOrdersPage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [orders, setOrders] = useState<{ id: string; order_number: string; client_name: string; value_zar: number; status: string; quote_id?: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Modal state
  const [showCreate, setShowCreate] = useState(false)
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null)
  const [detailPO, setDetailPO] = useState<PurchaseOrder | null>(null)
  const [showDelete, setShowDelete] = useState<PurchaseOrder | null>(null)

  // Form state
  const [formRef, setFormRef] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [formDueDate, setFormDueDate] = useState('')
  const [formOrderId, setFormOrderId] = useState<string>('')
  const [formSupplierName, setFormSupplierName] = useState('LANDWELL TECHNOLOGY CO, LIMITED')
  const [formSupplierAddress, setFormSupplierAddress] = useState('7F Building 1, Beijing Donghang Center No 6, Beijing, China, 101300')
  const [formCurrency, setFormCurrency] = useState('USD')
  const [formOverallDiscount, setFormOverallDiscount] = useState(0)
  const [formLineItems, setFormLineItems] = useState<POLineItem[]>([{ ...emptyLineItem }])
  const [formNotes, setFormNotes] = useState('')
  const [formStatus, setFormStatus] = useState<PurchaseOrderStatus>('draft')
  const [previewPONumber, setPreviewPONumber] = useState('')
  const [saving, setSaving] = useState(false)

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    const [posRes, ordersRes] = await Promise.all([
      supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('orders').select('id, order_number, client_name, value_zar, status, quote_id'),
    ])
    setPurchaseOrders(posRes.data || [])
    setOrders(ordersRes.data || [])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Handle ?fromOrder=xxx URL param to auto-open create modal
  useEffect(() => {
    const fromOrder = searchParams.get('fromOrder')
    if (fromOrder && orders.length > 0 && !showCreate && !editingPO) {
      const order = orders.find(o => o.id === fromOrder)
      if (order) {
        openCreateFromOrder(order)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, orders])

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = purchaseOrders
    if (statusFilter !== 'all') result = result.filter(po => po.status === statusFilter)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(po =>
        po.po_number.toLowerCase().includes(q) ||
        po.supplier_name.toLowerCase().includes(q) ||
        (po.reference || '').toLowerCase().includes(q)
      )
    }
    return result
  }, [purchaseOrders, statusFilter, search])

  // ── Stat counts ────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const counts: Record<string, number> = { all: purchaseOrders.length }
    purchaseOrders.forEach(po => {
      counts[po.status] = (counts[po.status] || 0) + 1
    })
    const totalValue = purchaseOrders
      .filter(po => po.status !== 'cancelled')
      .reduce((sum, po) => sum + (po.grand_total || 0), 0)
    return { counts, totalValue }
  }, [purchaseOrders])

  // ── Reset form ─────────────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setFormRef('')
    setFormDate(new Date().toISOString().split('T')[0])
    setFormDueDate('')
    setFormOrderId('')
    setFormSupplierName('LANDWELL TECHNOLOGY CO, LIMITED')
    setFormSupplierAddress('7F Building 1, Beijing Donghang Center No 6, Beijing, China, 101300')
    setFormCurrency('USD')
    setFormOverallDiscount(0)
    setFormLineItems([{ ...emptyLineItem }])
    setFormNotes('')
    setFormStatus('draft')
    setPreviewPONumber('')
  }, [])

  // ── Open create modal ──────────────────────────────────────────────────────

  const openCreate = useCallback(async () => {
    resetForm()
    const poNum = await generatePONumber(supabase)
    setPreviewPONumber(poNum)
    setShowCreate(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetForm])

  // ── Create from order ──────────────────────────────────────────────────────

  const openCreateFromOrder = useCallback(async (order: { id: string; order_number: string; client_name: string; quote_id?: string }) => {
    resetForm()
    const poNum = await generatePONumber(supabase)
    setPreviewPONumber(poNum)
    setFormOrderId(order.id)
    setFormRef(order.order_number)

    // Try to load quote line items for this order
    if (order.quote_id) {
      const { data: quote } = await supabase.from('quotes').select('line_items').eq('id', order.quote_id).single()
      if (quote?.line_items) {
        const items = Array.isArray(quote.line_items) ? quote.line_items : JSON.parse(quote.line_items as string)
        const poItems: POLineItem[] = items.map((item: { product?: string; description?: string; qty?: number; unitPrice?: number }) => ({
          description: item.product || item.description || '',
          qty: item.qty || 1,
          unit_price: item.unitPrice || 0,
          disc_percent: 0,
          vat_percent: 0,
        }))
        setFormLineItems(poItems.length > 0 ? poItems : [{ ...emptyLineItem }])
      }
    }

    setShowCreate(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetForm])

  // ── Open edit modal ────────────────────────────────────────────────────────

  const openEdit = useCallback((po: PurchaseOrder) => {
    const items = Array.isArray(po.line_items)
      ? po.line_items
      : typeof po.line_items === 'string'
        ? JSON.parse(po.line_items)
        : []

    setFormRef(po.reference || '')
    setFormDate(po.date)
    setFormDueDate(po.due_date || '')
    setFormOrderId(po.order_id || '')
    setFormSupplierName(po.supplier_name)
    setFormSupplierAddress(po.supplier_address || '')
    setFormCurrency(po.currency)
    setFormOverallDiscount(po.overall_discount || 0)
    setFormLineItems(items.length > 0 ? items : [{ ...emptyLineItem }])
    setFormNotes(po.notes || '')
    setFormStatus(po.status)
    setPreviewPONumber(po.po_number)
    setEditingPO(po)
  }, [])

  // ── Line item management ───────────────────────────────────────────────────

  const addLineItem = () => setFormLineItems(prev => [...prev, { ...emptyLineItem }])
  const removeLineItem = (idx: number) => setFormLineItems(prev => prev.filter((_, i) => i !== idx))
  const updateLineItem = (idx: number, field: keyof POLineItem, value: string | number) => {
    setFormLineItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  // ── Computed totals for form ───────────────────────────────────────────────

  const formTotals = useMemo(() => recalcTotals(formLineItems, formOverallDiscount), [formLineItems, formOverallDiscount])

  // ── Save (create or update) ────────────────────────────────────────────────

  const handleSave = async () => {
    if (formLineItems.length === 0 || !formLineItems.some(i => i.description.trim())) {
      toast.error('Add at least one line item with a description')
      return
    }

    setSaving(true)
    const totals = recalcTotals(formLineItems, formOverallDiscount)

    const payload = {
      reference: formRef.trim() || null,
      date: formDate,
      due_date: formDueDate || null,
      order_id: formOrderId || null,
      supplier_name: formSupplierName,
      supplier_address: formSupplierAddress,
      currency: formCurrency,
      overall_discount: formOverallDiscount,
      line_items: formLineItems.filter(i => i.description.trim()),
      notes: formNotes.trim() || null,
      status: formStatus,
      ...totals,
      balance_due: totals.grand_total - (editingPO?.amount_paid || 0),
      updated_at: new Date().toISOString(),
    }

    let error
    if (editingPO) {
      const res = await supabase.from('purchase_orders').update(payload).eq('id', editingPO.id)
      error = res.error
    } else {
      const poNumber = await generatePONumber(supabase)
      const res = await supabase.from('purchase_orders').insert({ ...payload, po_number: poNumber })
      error = res.error
    }

    setSaving(false)

    if (error) {
      toast.error('Failed to save purchase order')
      console.error(error)
      return
    }

    toast.success(editingPO ? 'Purchase order updated' : 'Purchase order created')
    setShowCreate(false)
    setEditingPO(null)
    resetForm()
    loadData()
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!showDelete) return
    const { error } = await supabase.from('purchase_orders').delete().eq('id', showDelete.id)
    if (error) {
      toast.error('Failed to delete')
      return
    }
    toast.success('Purchase order deleted')
    setShowDelete(null)
    if (detailPO?.id === showDelete.id) setDetailPO(null)
    loadData()
  }

  // ── PDF ────────────────────────────────────────────────────────────────────

  const downloadPdf = useCallback((po: PurchaseOrder) => {
    const html = generatePOPdfHtml(po)
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      setTimeout(() => printWindow.print(), 500)
      toast.success('Print dialog opened - select "Save as PDF" to download')
    } else {
      toast.error('Please allow popups to download the PO')
    }
  }, [])

  const viewPdf = useCallback((po: PurchaseOrder) => {
    const html = generatePOPdfHtml(po)
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      const printButton = printWindow.document.createElement('button')
      printButton.textContent = 'Download as PDF (Print)'
      printButton.style.cssText = 'position:fixed;top:10px;right:10px;padding:10px 20px;background:#4AB3E6;color:white;border:none;border-radius:8px;cursor:pointer;z-index:9999;font-weight:600;font-size:13px;'
      printButton.onclick = () => {
        printButton.style.display = 'none'
        printWindow.print()
        printButton.style.display = 'block'
      }
      printWindow.document.body.appendChild(printButton)
    } else {
      toast.error('Please allow popups to view the PO')
    }
  }, [])

  // ── Form UI ────────────────────────────────────────────────────────────────

  const renderForm = () => (
    <div className="space-y-4">
      {/* PO Number preview */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between">
        <span className="text-sm text-slate-500">PO Number</span>
        <span className="font-mono font-bold text-slate-900">{previewPONumber}</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Link to Order */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Link to Order</label>
          <select value={formOrderId} onChange={e => setFormOrderId(e.target.value)} className="input">
            <option value="">— None —</option>
            {orders.map(o => (
              <option key={o.id} value={o.id}>{o.order_number} - {o.client_name}</option>
            ))}
          </select>
        </div>
        {/* Reference */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Reference</label>
          <input type="text" value={formRef} onChange={e => setFormRef(e.target.value)} placeholder="e.g. Order ref" className="input" />
        </div>
        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
          <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="input" />
        </div>
        {/* Due Date */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
          <input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} className="input" />
        </div>
      </div>

      {/* Supplier */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Name</label>
          <input type="text" value={formSupplierName} onChange={e => setFormSupplierName(e.target.value)} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
          <select value={formCurrency} onChange={e => setFormCurrency(e.target.value)} className="input">
            <option value="USD">USD ($)</option>
            <option value="ZAR">ZAR (R)</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Address</label>
        <input type="text" value={formSupplierAddress} onChange={e => setFormSupplierAddress(e.target.value)} className="input" />
      </div>

      {/* Status + Overall Discount */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
          <select value={formStatus} onChange={e => setFormStatus(e.target.value as PurchaseOrderStatus)} className="input">
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Overall Discount %</label>
          <input
            type="number"
            value={formOverallDiscount}
            onChange={e => setFormOverallDiscount(parseFloat(e.target.value) || 0)}
            min="0"
            max="100"
            step="0.5"
            className="input"
          />
        </div>
      </div>

      {/* Line Items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-700">Line Items</label>
          <button type="button" onClick={addLineItem} className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Add Item
          </button>
        </div>
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 px-1">
            <div className="col-span-4">Description</div>
            <div className="col-span-1">Qty</div>
            <div className="col-span-2">Price</div>
            <div className="col-span-2">Disc %</div>
            <div className="col-span-2">VAT %</div>
            <div className="col-span-1"></div>
          </div>
          {formLineItems.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <input
                className="col-span-4 input text-sm"
                value={item.description}
                onChange={e => updateLineItem(idx, 'description', e.target.value)}
                placeholder="Item description"
              />
              <input
                className="col-span-1 input text-sm text-center"
                type="number"
                value={item.qty}
                onChange={e => updateLineItem(idx, 'qty', parseInt(e.target.value) || 0)}
                min="1"
              />
              <input
                className="col-span-2 input text-sm"
                type="number"
                value={item.unit_price}
                onChange={e => updateLineItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
              />
              <input
                className="col-span-2 input text-sm text-center"
                type="number"
                value={item.disc_percent}
                onChange={e => updateLineItem(idx, 'disc_percent', parseFloat(e.target.value) || 0)}
                min="0"
                max="100"
              />
              <input
                className="col-span-2 input text-sm text-center"
                type="number"
                value={item.vat_percent}
                onChange={e => updateLineItem(idx, 'vat_percent', parseFloat(e.target.value) || 0)}
                min="0"
                max="100"
              />
              <div className="col-span-1 flex justify-center">
                {formLineItems.length > 1 && (
                  <button onClick={() => removeLineItem(idx)} className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals preview */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Subtotal:</span>
          <span className="font-medium">{formatCurrency(formTotals.subtotal, formCurrency)}</span>
        </div>
        {formTotals.total_discount > 0 && (
          <div className="flex justify-between text-sm text-red-600">
            <span>Total Discount:</span>
            <span>-{formatCurrency(formTotals.total_discount, formCurrency)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Total VAT:</span>
          <span className="font-medium">{formatCurrency(formTotals.total_vat, formCurrency)}</span>
        </div>
        <div className="flex justify-between text-sm font-bold pt-1 border-t border-slate-300">
          <span>Grand Total:</span>
          <span>{formatCurrency(formTotals.grand_total, formCurrency)}</span>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
        <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={3} className="input resize-none" placeholder="Optional notes..." />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button onClick={() => { setShowCreate(false); setEditingPO(null); resetForm() }} className="btn-secondary flex-1">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </span>
          ) : editingPO ? 'Update PO' : 'Create PO'}
        </button>
      </div>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading purchase orders...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchase Orders</h1>
          <p className="text-sm text-slate-500 mt-1">
            {purchaseOrders.length} purchase order{purchaseOrders.length !== 1 ? 's' : ''} &middot; Total value: {formatCurrency(stats.totalValue, 'USD')}
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New PO
        </button>
      </div>

      {/* Stat pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {['all', 'draft', 'sent', 'confirmed', 'cancelled'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              statusFilter === s
                ? 'bg-teal-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {s === 'all' ? 'All' : PO_STATUS_CONFIG[s as PurchaseOrderStatus]?.label || s} ({stats.counts[s] || 0})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search PO number, supplier, reference..."
          className="input pl-10"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No purchase orders found</p>
          <p className="text-sm text-slate-400 mt-1">Create your first PO to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">PO #</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Supplier</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Reference</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Date</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Grand Total</th>
                  <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(po => (
                  <tr
                    key={po.id}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition"
                    onClick={() => setDetailPO(po)}
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-sm text-slate-900">{po.po_number}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{po.supplier_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{po.reference || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{formatDate(po.date)}</td>
                    <td className="px-4 py-3"><StatusBadge status={po.status} /></td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">{formatCurrency(po.grand_total, po.currency)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => viewPdf(po)} className="p-1.5 hover:bg-slate-100 rounded-lg" title="View PDF">
                          <Eye className="w-4 h-4 text-slate-500" />
                        </button>
                        <button onClick={() => downloadPdf(po)} className="p-1.5 hover:bg-slate-100 rounded-lg" title="Download PDF">
                          <Download className="w-4 h-4 text-slate-500" />
                        </button>
                        <button onClick={() => openEdit(po)} className="p-1.5 hover:bg-slate-100 rounded-lg" title="Edit">
                          <Edit2 className="w-4 h-4 text-slate-500" />
                        </button>
                        <button onClick={() => setShowDelete(po)} className="p-1.5 hover:bg-red-50 rounded-lg" title="Delete">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <Modal open={!!detailPO} onClose={() => setDetailPO(null)} title={`PO: ${detailPO?.po_number || ''}`} wide>
        {detailPO && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <StatusBadge status={detailPO.status} />
              <div className="flex gap-2">
                <button onClick={() => viewPdf(detailPO)} className="btn-secondary text-sm flex items-center gap-1.5">
                  <Eye className="w-4 h-4" /> View PDF
                </button>
                <button onClick={() => downloadPdf(detailPO)} className="btn-primary text-sm flex items-center gap-1.5">
                  <Download className="w-4 h-4" /> Download PDF
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">PO Number:</span>
                <span className="font-mono font-semibold ml-2">{detailPO.po_number}</span>
              </div>
              <div>
                <span className="text-slate-500">Reference:</span>
                <span className="ml-2">{detailPO.reference || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500">Date:</span>
                <span className="ml-2">{formatDate(detailPO.date)}</span>
              </div>
              <div>
                <span className="text-slate-500">Due Date:</span>
                <span className="ml-2">{formatDate(detailPO.due_date)}</span>
              </div>
              <div>
                <span className="text-slate-500">Supplier:</span>
                <span className="font-medium ml-2">{detailPO.supplier_name}</span>
              </div>
              <div>
                <span className="text-slate-500">Currency:</span>
                <span className="ml-2">{detailPO.currency}</span>
              </div>
            </div>

            {/* Line items table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Description</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500">Qty</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Price</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500">Disc %</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500">VAT %</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Excl.</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Incl.</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(detailPO.line_items) ? detailPO.line_items : []).map((item: POLineItem, idx: number) => {
                    const calc = calcLineItem(item)
                    return (
                      <tr key={idx} className="border-b border-slate-100">
                        <td className="px-3 py-2 text-slate-700">{item.description}</td>
                        <td className="px-3 py-2 text-center">{item.qty}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(item.unit_price, detailPO.currency)}</td>
                        <td className="px-3 py-2 text-center">{item.disc_percent}%</td>
                        <td className="px-3 py-2 text-center">{item.vat_percent}%</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(calc.afterDisc, detailPO.currency)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatCurrency(calc.inclTotal, detailPO.currency)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 ml-auto w-64 space-y-1">
              {detailPO.total_discount > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Total Discount:</span>
                  <span>-{formatCurrency(detailPO.total_discount, detailPO.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total Exclusive:</span>
                <span>{formatCurrency(detailPO.subtotal - detailPO.total_discount, detailPO.currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total VAT:</span>
                <span>{formatCurrency(detailPO.total_vat, detailPO.currency)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-1 border-t border-slate-300">
                <span>Grand Total:</span>
                <span>{formatCurrency(detailPO.grand_total, detailPO.currency)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span>Balance Due:</span>
                <span>{formatCurrency(detailPO.balance_due, detailPO.currency)}</span>
              </div>
            </div>

            {detailPO.notes && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Notes</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{detailPO.notes}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setDetailPO(null); openEdit(detailPO) }} className="btn-secondary flex-1 flex items-center justify-center gap-2">
                <Edit2 className="w-4 h-4" /> Edit
              </button>
              <button onClick={() => setShowDelete(detailPO)} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); resetForm() }} title="New Purchase Order" wide>
        {renderForm()}
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editingPO} onClose={() => { setEditingPO(null); resetForm() }} title={`Edit ${editingPO?.po_number || ''}`} wide>
        {renderForm()}
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!showDelete} onClose={() => setShowDelete(null)} title="Delete Purchase Order">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete <strong>{showDelete?.po_number}</strong>? This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setShowDelete(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleDelete} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition">
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
