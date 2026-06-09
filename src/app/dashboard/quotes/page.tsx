'use client'

import { useEffect, useState, useCallback, useMemo, useRef, memo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Quote, QuoteLineItem, Client, StockItem, Formula } from '@/lib/types'
import { Plus, X, Search, Edit2, Copy, Trash2, Package, Clock, TrendingUp, Target, AlertTriangle, ChevronDown, Send, Check, XCircle, Timer, Download, Eye } from 'lucide-react'
import { toast } from 'sonner'

function daysBetween(date1: Date, date2: Date): number {
  const diff = date2.getTime() - date1.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

// Separate ProductInput component to manage its own search state (prevents keyboard from closing)
const ProductInput = memo(function ProductInput({
  value,
  products,
  onSelect,
  onManualEntry,
}: {
  value: string
  products: StockItem[]
  onSelect: (product: StockItem) => void
  onManualEntry: (text: string) => void
}) {
  const [search, setSearch] = useState(value)
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    if (!search) return products.slice(0, 50)
    const lower = search.toLowerCase()
    return products.filter(p => p.name?.toLowerCase().includes(lower)).slice(0, 50)
  }, [search, products])

  const showCustomOption = search && !filtered.some(p => p.name?.toLowerCase() === search.toLowerCase())

  return (
    <div className="relative">
      <input
        ref={inputRef}
        placeholder="Search pricelist or type custom item..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          setTimeout(() => {
            setIsOpen(false)
            if (search !== value) {
              onManualEntry(search)
            }
          }, 200)
        }}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
      {isOpen && (filtered.length > 0 || showCustomOption) && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {showCustomOption && (
            <button
              type="button"
              onClick={() => {
                onManualEntry(search)
                setIsOpen(false)
              }}
              className="w-full px-3 py-2 text-left bg-amber-50 hover:bg-amber-100 flex justify-between items-center text-sm border-b border-amber-200"
            >
              <span className="font-medium text-amber-800">
                <Plus className="w-4 h-4 inline mr-1" />
                Add custom: &ldquo;{search}&rdquo;
              </span>
              <span className="text-amber-600 text-xs">Enter price manually</span>
            </button>
          )}
          {filtered.map(product => (
            <button
              key={product.id}
              type="button"
              onClick={() => {
                onSelect(product)
                setSearch(product.name)
                setIsOpen(false)
              }}
              className="w-full px-3 py-2 text-left hover:bg-slate-50 flex justify-between items-center text-sm"
            >
              <span className="font-medium truncate">{product.name}</span>
              <span className="text-slate-500 ml-2">${product.usd_price || 0}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
})

const REGIONS = ['Gauteng', 'Rustenburg', 'Northern Cape', 'KZN', 'Cape Town']
const STATUSES = ['draft', 'sent', 'accepted', 'declined', 'expired']
const STATUS_LABELS: Record<string, string> = { 
  draft: 'Draft', 
  sent: 'Sent', 
  accepted: 'Accepted', 
  declined: 'Declined',
  expired: 'Expired'
}

// Status colors for badges
const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  draft: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  sent: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  accepted: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  declined: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  expired: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
}

// Status icons
const STATUS_ICONS: Record<string, React.ReactNode> = {
  draft: <Edit2 className="w-3 h-3" />,
  sent: <Send className="w-3 h-3" />,
  accepted: <Check className="w-3 h-3" />,
  declined: <XCircle className="w-3 h-3" />,
  expired: <Timer className="w-3 h-3" />,
}

interface EmptyQuote {
  client_id: string
  client_name: string
  client_contact: string
  client_email: string
  client_vat: string
  client_type: string
  project_title: string
  date: string
  due_date: string
  status: string
  currency: string
  region: string
  include_installation: boolean
  discount: number
  discount_type: string
  notes: string
  line_items: QuoteLineItem[]
}

const getEmptyQuote = (): EmptyQuote => {
  const today = new Date()
  const dueDate = new Date(today)
  dueDate.setDate(dueDate.getDate() + 14) // Quote valid for 14 days
  
  return {
    client_id: '',
    client_name: '',
    client_contact: '',
    client_email: '',
    client_vat: '',
    client_type: 'End User',
    project_title: '',
    date: today.toISOString().split('T')[0],
    due_date: dueDate.toISOString().split('T')[0],
    status: 'draft',
    currency: 'USD', // Default currency for new items (legacy, now per-item)
    region: 'Gauteng',
    include_installation: false,
    discount: 0,
    discount_type: 'percent',
    notes: '',
    line_items: [{ product: '', description: '', qty: 1, unitPrice: 0, currency: 'USD', image: null }],
  }
}

function fmtCurrency(val: number | undefined | null): string {
  if (val == null || isNaN(val)) return `R 0.00`
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(val)
}

function calculateZarPrice(
  usdPrice: number,
  clientType: string,
  formula: Formula | null,
  region: string | null = null,
  includeInstallation: boolean = false
): number {
  if (!formula) return usdPrice * 17.5
  const exchangeRate = formula.exchange_rate || 17.5
  const shipping = formula.shipping_multiplier || 1.4
  const gp = formula.gp_divisor || 0.7
  const endUserDivisor = formula.end_user_divisor || 0.75
  const deliveryMult = 1 + (formula.delivery_percent || 10) / 100
  const regionMult = (region && formula.region_markups?.[region]) ? 1 + formula.region_markups[region] / 100 : 1

  const resellerNoInstall = (usdPrice * exchangeRate * shipping * deliveryMult) / gp
  const resellerWithInstall = (usdPrice * exchangeRate * shipping * deliveryMult * regionMult) / gp

  if (clientType === 'End User' || clientType === 'end_user') {
    return resellerWithInstall / endUserDivisor
  }

  // Reseller and Single Seller share the same base; Single Seller adds 15%.
  const resellerBase = includeInstallation ? resellerWithInstall : resellerNoInstall
  if (clientType === 'Single Seller' || clientType === 'single_seller') {
    return resellerBase * 1.15
  }
  return resellerBase
}

// Normalise a client-type value (display label or db value) to the db value.
function toDbClientType(v: string): string {
  if (v === 'Reseller' || v === 'reseller') return 'reseller'
  if (v === 'Single Seller' || v === 'single_seller') return 'single_seller'
  return 'end_user'
}

// Keep full precision - no rounding
function roundUpTo100(amount: number): number {
  // Previously rounded to R100, now disabled per request
  return amount
}

function calculateQuoteTotal(quote: EmptyQuote | Quote, formula: Formula | null) {
  let subtotal = 0

  quote.line_items?.forEach(item => {
    // Per-item currency: if item.currency is USD, convert using formula; if ZAR, use as-is
    const itemCurrency = item.currency || quote.currency || 'USD' // Fallback for legacy items
    const isItemUSD = itemCurrency === 'USD'
    
    const zarPrice = isItemUSD
      ? calculateZarPrice(Number(item.unitPrice), quote.client_type, formula, quote.region, quote.include_installation)
      : Number(item.unitPrice)
    let lineTotal = Number(item.qty) * zarPrice
    // Round up to nearest R100 if line total > R100
    lineTotal = roundUpTo100(lineTotal)
    subtotal += lineTotal
  })

  let discountAmount = 0
  if (quote.discount) {
    if (quote.discount_type === 'percent') {
      discountAmount = subtotal * (Number(quote.discount) / 100)
    } else {
      discountAmount = Number(quote.discount)
    }
  }

  const afterDiscount = subtotal - discountAmount
  const vat = afterDiscount * 0.15
  const total = afterDiscount + vat

  return { subtotal, discountAmount, afterDiscount, vat, total }
}

function generatePdfHtml(quote: Quote, formula: Formula | null): string {
  if (!quote) {
    console.error('generatePdfHtml: No quote provided')
    return '<html><body>Error: No quote data</body></html>'
  }

  // Ensure line_items is a proper array
  let lineItems: QuoteLineItem[] = []
  if (Array.isArray(quote.line_items)) {
    lineItems = quote.line_items
  } else if (typeof quote.line_items === 'string') {
    try {
      lineItems = JSON.parse(quote.line_items)
    } catch (e) {
      console.error('Failed to parse line_items:', e)
      lineItems = []
    }
  }
  
  console.log('generatePdfHtml: Generating PDF for quote:', quote.quote_number, 'with', lineItems.length, 'items')

  let totalExcl = 0
  const lineItemsWithZar = lineItems.map(item => {
    // Per-item currency: if item.currency is USD, convert using formula; if ZAR, use as-is
    const itemCurrency = item.currency || quote.currency || 'USD' // Fallback for legacy items
    const isItemUSD = itemCurrency === 'USD'
    
    // Calculate ZAR price and round the unit price itself
    const rawZarPrice = isItemUSD
      ? calculateZarPrice(item.unitPrice, quote.client_type, formula, quote.region, quote.include_installation)
      : item.unitPrice
    const zarPrice = roundUpTo100(rawZarPrice) // Round unit price
    const lineTotal = item.qty * zarPrice // Line total is naturally rounded since unit is
    totalExcl += lineTotal
    return { ...item, zarPrice, lineTotal, isUSD: isItemUSD }
  })

  let discountAmount = 0
  if (quote.discount) {
    if (quote.discount_type === 'percent') {
      discountAmount = totalExcl * (Number(quote.discount) / 100)
    } else {
      discountAmount = Number(quote.discount)
    }
  }
  const afterDiscount = totalExcl - discountAmount
  const totalVat = afterDiscount * 0.15
  const grandTotal = afterDiscount + totalVat

  // Show RRP for Resellers - calculate using End User pricing for any USD items
  const hasUsdItems = lineItems.some(item => (item.currency || quote.currency || 'USD') === 'USD')
  const rrp = ['Reseller', 'reseller', 'Single Seller', 'single_seller'].includes(quote.client_type) && hasUsdItems
    ? lineItems.reduce((sum, item) => {
        const itemCurrency = item.currency || quote.currency || 'USD'
        if (itemCurrency === 'USD') {
          return sum + (item.qty * calculateZarPrice(item.unitPrice, 'End User', formula, quote.region, quote.include_installation))
        } else {
          // ZAR items don't have markup, use as-is
          return sum + (item.qty * item.unitPrice)
        }
      }, 0) * 1.15
    : null

  const lineItemsHtml = lineItemsWithZar.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; width: 70px;">
        ${item.image
          ? `<img src="${item.image}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;" />`
          : `<div style="width: 60px; height: 60px; background: #f1f5f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 10px;">No image</div>`
        }
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
        <div style="font-weight: 600; font-size: 9px;">${item.product}</div>
        ${item.description ? `<div style="font-size: 8px; color: #64748b; margin-top: 2px;">${item.description}</div>` : ''}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 9px;">${item.qty}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 9px;">R${item.zarPrice.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; font-size: 9px;">R${item.lineTotal.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
    </tr>
  `).join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Quote ${quote.quote_number}</title>
  <style>
    @page { margin: 30px 40px; size: A4; }
    @media print { 
      .page-break { page-break-before: always; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.4; margin: 0; padding: 20px 30px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #4AB3E6; }
    .logo { font-size: 18px; font-weight: 700; color: #0f172a; }
    .logo span { color: #4AB3E6; }
    .quote-badge { background: #4AB3E6; color: white; padding: 4px 12px; border-radius: 12px; font-weight: 600; font-size: 11px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
    .meta-box { background: #f8fafc; padding: 10px 12px; border-radius: 8px; }
    .meta-box h3 { margin: 0 0 4px 0; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
    .meta-box p { margin: 1px 0; font-size: 11px; }
    .meta-box .name { font-weight: 600; font-size: 12px; color: #0f172a; }
    .project-title { background: linear-gradient(135deg, #4AB3E6 0%, #2A8FC4 100%); color: white; padding: 10px 14px; border-radius: 8px; margin-bottom: 12px; }
    .project-title h2 { margin: 0; font-size: 13px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #0f172a; color: white; padding: 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
    th:nth-child(3), th:nth-child(4), th:nth-child(5) { text-align: right; }
    .totals { margin-left: auto; width: 200px; }
    .totals-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid #e2e8f0; font-size: 9px; }
    .totals-row span:first-child { text-align: left; }
    .totals-row span:last-child { text-align: right; font-weight: 500; }
    .totals-row.discount { color: #dc2626; }
    .totals-row.grand { background: #0f172a; color: white; padding: 6px 8px; border-radius: 4px; font-weight: 700; font-size: 10px; margin-top: 4px; border: none; }
    .rrp { background: #fef3c7; border: 1px solid #f59e0b; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; }
    .rrp span { font-weight: 700; color: #b45309; }
    .banking { background: #f1f5f9; padding: 14px 18px; border-radius: 8px; margin-bottom: 16px; font-size: 12px; }
    .banking strong { color: #0f172a; }
    .quote-info { text-align: right; font-size: 10px; color: #64748b; }
    .quote-info .number { font-size: 16px; font-weight: 700; color: #0f172a; }
    .terms-page { padding-top: 20px; }
    .terms-header { background: #0f172a; color: white; padding: 16px 20px; border-radius: 10px; margin-bottom: 20px; }
    .terms-header h2 { margin: 0; font-size: 18px; }
    .terms { font-size: 11px; color: #475569; line-height: 1.7; }
    .terms h4 { color: #0f172a; margin: 14px 0 6px 0; font-size: 12px; font-weight: 600; }
    .terms p { margin: 0 0 8px 0; }
    .terms-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .terms-section { background: #f8fafc; padding: 14px; border-radius: 8px; }
    .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <img src="https://iwyiqsmcwoengowjipws.supabase.co/storage/v1/object/public/product-images/landwell-logo.png?v=3" alt="Landwell Africa" style="height: 45px; width: auto;" />
    </div>
    <div class="quote-info">
      <div class="quote-badge">QUOTE</div>
      <div class="number" style="margin-top: 4px;">${quote.quote_number}</div>
      <div>Date: ${quote.date} | Due: ${quote.due_date || 'N/A'}</div>
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
      <h3>To</h3>
      <p class="name">${quote.client_name}</p>
      <p>Attn: ${quote.client_contact || '-'}</p>
      <p>${quote.client_email || '-'}</p>
      <p>VAT: ${quote.client_vat || '-'}</p>
      ${quote.include_installation ? `<div style="margin-top: 4px; display: inline-block; background: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 6px; font-size: 8px; font-weight: 600;">Installation Included</div>` : ''}
    </div>
  </div>

  ${quote.project_title ? `<div class="project-title"><h2>${quote.project_title}</h2></div>` : ''}

  <table>
    <thead>
      <tr>
        <th style="width: 70px;">Image</th>
        <th>Product</th>
        <th style="text-align: center; width: 60px;">Qty</th>
        <th style="text-align: right; width: 100px;">Unit (ZAR)</th>
        <th style="text-align: right; width: 120px;">Total (ZAR)</th>
      </tr>
    </thead>
    <tbody>${lineItemsHtml}</tbody>
  </table>

  ${quote.notes ? `
  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
    <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 6px; font-weight: 600;">Notes</div>
    <div style="font-size: 12px; color: #334155; white-space: pre-wrap;">${quote.notes}</div>
  </div>
  ` : ''}

  <div class="totals">
    <div class="totals-row"><span>Subtotal:</span><span>R${totalExcl.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>
    ${discountAmount > 0 ? `<div class="totals-row discount"><span>Discount${quote.discount_type === 'percent' ? ` (${quote.discount}%)` : ''}:</span><span>-R${discountAmount.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>` : ''}
    <div class="totals-row"><span>VAT (15%):</span><span>R${totalVat.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>
    <div class="totals-row grand"><span>Grand Total:</span><span>R${grandTotal.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>
  </div>

  ${rrp ? `<div class="rrp">Recommended Retail Price (End User): <span>R${rrp.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>` : ''}

  <div class="banking">
    <strong>Banking:</strong> FNB | Acc: 63102227112 | Branch: 210835 | Ref: ${quote.client_name} - ${quote.quote_number}<br>
    <em>Quote valid for 30 days from date of issue.</em>
  </div>

  <div class="page-break terms-page">
    <div class="terms-header"><h2>Terms & Conditions</h2></div>
    <div class="terms">
      <div class="terms-grid">
        <div class="terms-section">
          <h4>Prices</h4><p>Prices quoted are exclusive of 15% VAT. Prices are subject to Rate of Exchange Variation.</p>
          <h4>Delivery</h4><p>Delivery is 4-6 weeks from receipt of an official signed order. Upon receipt of confirmation this is a firm order and is not subject to cancellation.</p>
          <h4>Rate of Exchange</h4><p>A Forward exchange contract can be arranged on request. Our quote is based on an exchange rate of $1.00 = R16.50. Any variation will be for your account and calculated on the date of invoice.</p>
          <h4>Validity</h4><p>This proposal shall remain valid for 30 days from date of issue. Thereafter subject to written confirmation by Landwell Africa (Pty) Ltd.</p>
        </div>
        <div class="terms-section">
          <h4>Payment</h4><p>Payment terms: 50% on placing of order, 50% on date of installation, unless otherwise advised in writing.</p><p>Ownership remains with Landwell Africa (Pty) Ltd until payment is received in full. Interest at prime plus 3% per month applies to overdue amounts.</p>
          <h4>Warranty</h4><p>Landwell cabinets are provided with a 36-month warranty starting on the day of installation. During this period, we provide parts and labour to repair any manufacturing defects.</p><p>After warranty expiry, annual maintenance agreements or Time & Material support is available.</p>
          <h4>Acceptance</h4><p>This must be accepted in writing via official order form or letter. Verbal orders are not acceptable. Work commences only upon receipt of official order.</p>
        </div>
      </div>
    </div>
    <div class="footer"><div style="margin-bottom: 8px;"><strong>LANDWELL AFRICA (PTY) LTD</strong></div>Quote ${quote.quote_number} | Generated ${new Date().toLocaleDateString('en-ZA')}</div>
  </div>
</body>
</html>`
}

// Badge component
function Badge({ variant = 'default', children, className = '' }: { variant?: string; children: React.ReactNode; className?: string }) {
  const colors: Record<string, string> = {
    default: 'bg-slate-100 text-slate-700',
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
    red: 'bg-red-100 text-red-700',
    yellow: 'bg-amber-100 text-amber-700',
  }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[variant] || colors.default} ${className}`}>
      {children}
    </span>
  )
}

// Status Badge with dropdown
function StatusBadge({ 
  status, 
  onStatusChange, 
  disabled = false 
}: { 
  status: string
  onStatusChange: (newStatus: string) => void
  disabled?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // Normalize status to lowercase for consistency
  const normalizedStatus = status?.toLowerCase() || 'draft'
  const colors = STATUS_COLORS[normalizedStatus] || STATUS_COLORS.draft
  const icon = STATUS_ICONS[normalizedStatus]
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])
  
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (!disabled) setIsOpen(!isOpen)
        }}
        disabled={disabled}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${colors.bg} ${colors.text} ${colors.border} ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md cursor-pointer'}`}
      >
        {icon}
        <span>{STATUS_LABELS[normalizedStatus] || status}</span>
        {!disabled && <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
      </button>
      
      {isOpen && (
        <div className="absolute z-50 mt-1 left-0 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[140px]">
          {STATUSES.map(s => {
            const sColors = STATUS_COLORS[s]
            const sIcon = STATUS_ICONS[s]
            const isActive = s === normalizedStatus
            return (
              <button
                key={s}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onStatusChange(s)
                  setIsOpen(false)
                }}
                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${isActive ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
              >
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${sColors.bg} ${sColors.text}`}>
                  {sIcon}
                </span>
                <span className={isActive ? 'font-medium' : ''}>{STATUS_LABELS[s]}</span>
                {isActive && <Check className="w-4 h-4 ml-auto text-teal-600" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Modal component
function Modal({ open, onClose, title, wide, children }: { open: boolean; onClose: () => void; title: string; wide?: boolean; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-xl ${wide ? 'max-w-3xl' : 'max-w-lg'} w-full max-h-[90vh] overflow-hidden`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-60px)]">{children}</div>
      </div>
    </div>
  )
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<StockItem[]>([])
  const [formula, setFormula] = useState<Formula | null>(null)
  const [loading, setLoading] = useState(true)

  // Create modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<EmptyQuote>(getEmptyQuote())
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [saving, setSaving] = useState(false)

  // Detail modal state
  const [detailQuote, setDetailQuote] = useState<Quote | null>(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<EmptyQuote>(getEmptyQuote())

  // Filter state
  const [filterText, setFilterText] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  // PDF generation state
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null)

  const supabase = createClient()

  const fetchAll = useCallback(async () => {
    const [quotesRes, clientsRes, productsRes, formulaRes] = await Promise.all([
      supabase.from('quotes').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').order('name'),
      supabase.from('stock_items').select('*').order('name'),
      supabase.from('formula').select('*').limit(1).single(),
    ])
    
    // Process quotes to ensure line_items is always an array
    const processedQuotes = (quotesRes.data || []).map(q => ({
      ...q,
      line_items: typeof q.line_items === 'string' 
        ? JSON.parse(q.line_items) 
        : (Array.isArray(q.line_items) ? q.line_items : [])
    }))
    
    setQuotes(processedQuotes)
    setClients(clientsRes.data || [])
    setProducts(productsRes.data || [])
    if (formulaRes.data) setFormula(formulaRes.data)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Generate next quote number
  const nextQuoteNo = useCallback(() => {
    const year = new Date().getFullYear().toString().slice(-2)
    const existing = quotes.filter(q => q.quote_number?.startsWith(`Q${year}`))
    const maxNum = existing.reduce((max, q) => {
      const num = parseInt(q.quote_number?.slice(3) || '0')
      return num > max ? num : max
    }, 0)
    return `Q${year}${String(maxNum + 1).padStart(4, '0')}`
  }, [quotes])

  // Update quote status
  const updateQuoteStatus = useCallback(async (quote: Quote, newStatus: string) => {
    const loadingToast = toast.loading(`Updating status to ${STATUS_LABELS[newStatus]}...`)
    
    try {
      const { error } = await supabase
        .from('quotes')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', quote.id)
      
      if (error) throw error
      
      // If status changed to accepted, update pipeline
      if (newStatus === 'accepted') {
        await supabase
          .from('pipeline')
          .update({ quotes_status: 'Approved' })
          .eq('client_name', quote.client_name)
      }
      
      // Update local state
      setQuotes(prev => prev.map(q => 
        q.id === quote.id ? { ...q, status: newStatus } : q
      ))
      
      // Update detail modal if open
      if (detailQuote?.id === quote.id) {
        setDetailQuote(prev => prev ? { ...prev, status: newStatus } : null)
        setEditForm(prev => ({ ...prev, status: newStatus }))
      }
      
      toast.success(`Status updated to ${STATUS_LABELS[newStatus]}`, { id: loadingToast })
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status', { id: loadingToast })
    }
  }, [supabase, detailQuote])

  // Download PDF
  const downloadPdf = useCallback((quote: Quote) => {
    setGeneratingPdf(quote.id)
    // Use print-based PDF approach (more reliable than html2pdf)
    // Ensure line_items is properly parsed
    let lineItems: QuoteLineItem[] = []
    if (Array.isArray(quote.line_items)) {
      lineItems = quote.line_items
    } else if (typeof quote.line_items === 'string') {
      try {
        lineItems = JSON.parse(quote.line_items)
      } catch (e) {
        console.error('Failed to parse line_items:', e)
      }
    }

    const quoteWithItems = {
      ...quote,
      line_items: lineItems
    }

    const html = generatePdfHtml(quoteWithItems, formula)
    const printWindow = window.open('', '_blank')
    
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      
      // Auto-trigger print dialog after a short delay
      setTimeout(() => {
        printWindow.print()
      }, 500)
      
      toast.success('Print dialog opened - select "Save as PDF" to download')
      setGeneratingPdf(null)
    } else {
      toast.error('Please allow popups to download the quote')
      setGeneratingPdf(null)
    }
  }, [formula])

  // View PDF in new tab (secondary action)
  const viewPdf = useCallback((quote: Quote) => {
    // Ensure line_items is properly parsed
    let lineItems: QuoteLineItem[] = []
    if (Array.isArray(quote.line_items)) {
      lineItems = quote.line_items
    } else if (typeof quote.line_items === 'string') {
      try {
        lineItems = JSON.parse(quote.line_items)
      } catch (e) {
        console.error('Failed to parse line_items:', e)
      }
    }

    const quoteWithItems = {
      ...quote,
      line_items: lineItems
    }

    const html = generatePdfHtml(quoteWithItems, formula)
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      
      // Add print button for easy PDF download via browser print
      const printButton = printWindow.document.createElement('button')
      printButton.textContent = '📥 Download as PDF (Print)'
      printButton.style.cssText = 'position:fixed;top:10px;right:10px;padding:10px 20px;background:#4AB3E6;color:white;border:none;border-radius:8px;cursor:pointer;z-index:9999;font-weight:600;'
      printButton.onclick = () => {
        printButton.style.display = 'none'
        printWindow.print()
        printButton.style.display = 'block'
      }
      printWindow.document.body.appendChild(printButton)
    } else {
      toast.error('Please allow popups to view the quote')
    }
  }, [formula])

  // Filter quotes
  const filteredQuotes = useMemo(() => {
    return quotes.filter(q => {
      const normalizedStatus = q.status?.toLowerCase() || 'draft'
      if (filterStatus !== 'all' && normalizedStatus !== filterStatus) return false
      if (filterText) {
        const search = filterText.toLowerCase()
        return q.quote_number?.toLowerCase().includes(search) ||
               q.client_name?.toLowerCase().includes(search) ||
               q.project_title?.toLowerCase().includes(search)
      }
      return true
    })
  }, [quotes, filterStatus, filterText])

  // Group by status
  const groupedQuotes = useMemo(() => {
    return STATUSES.reduce((acc, status) => {
      acc[status] = filteredQuotes.filter(q => (q.status?.toLowerCase() || 'draft') === status)
      return acc
    }, {} as Record<string, Quote[]>)
  }, [filteredQuotes])

  // Handle client selection
  const handleClientSelect = (clientId: string) => {
    const client = clients.find(c => c.id === clientId)
    if (client) {
      setSelectedClientId(clientId)
      setForm(f => ({
        ...f,
        client_id: clientId,
        client_name: client.name || '',
        client_contact: client.contact_person || '',
        client_email: client.email || '',
        client_vat: client.vat_number || '',
        // Don't overwrite manually selected client_type
      }))
    }
  }

  // Line item functions
  const addLineItem = () => {
    setForm(f => ({
      ...f,
      line_items: [...f.line_items, { product: '', description: '', qty: 1, unitPrice: 0, currency: 'USD', image: null }]
    }))
  }

  const updateLineItem = (index: number, field: keyof QuoteLineItem, value: string | number | null) => {
    setForm(f => ({
      ...f,
      line_items: f.line_items.map((item, i) => i === index ? { ...item, [field]: value } : item)
    }))
  }

  const removeLineItem = (index: number) => {
    setForm(f => ({
      ...f,
      line_items: f.line_items.filter((_, i) => i !== index)
    }))
  }

  const handleImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => updateLineItem(index, 'image', ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const selectFromProducts = (index: number, product: StockItem) => {
    setForm(f => {
      // Products from pricelist are always in USD
      const usdPrice = product.usd_price || 0
      
      return {
        ...f,
        line_items: f.line_items.map((item, i) =>
          i === index
            ? { ...item, product: product.name, unitPrice: usdPrice, currency: 'USD', image: product.image_url }
            : item
        )
      }
    })
  }

  // Edit line item functions
  const addEditLineItem = () => {
    setEditForm(f => ({
      ...f,
      line_items: [...f.line_items, { product: '', description: '', qty: 1, unitPrice: 0, currency: 'USD', image: null }]
    }))
  }

  const updateEditLineItem = (index: number, field: keyof QuoteLineItem, value: string | number | null) => {
    setEditForm(f => ({
      ...f,
      line_items: f.line_items.map((item, i) => i === index ? { ...item, [field]: value } : item)
    }))
  }

  const removeEditLineItem = (index: number) => {
    setEditForm(f => ({
      ...f,
      line_items: f.line_items.filter((_, i) => i !== index)
    }))
  }

  const handleEditImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => updateEditLineItem(index, 'image', ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const selectEditFromProducts = (index: number, product: StockItem) => {
    setEditForm(f => {
      // Products from pricelist are always in USD
      const usdPrice = product.usd_price || 0
      
      return {
        ...f,
        line_items: f.line_items.map((item, i) =>
          i === index
            ? { ...item, product: product.name, unitPrice: usdPrice, currency: 'USD', image: product.image_url }
            : item
        )
      }
    })
  }

  // Submit new quote
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.client_name) return toast.error('Client name is required')
    if (form.line_items.some(li => !li.product || !li.qty || !li.unitPrice)) {
      return toast.error('All line items need product name, quantity, and price')
    }

    setSaving(true)
    const quoteNumber = nextQuoteNo()

    // If new client, add to clients table and create pipeline entry
    if (clientMode === 'new' && form.client_name) {
      const existing = clients.find(c => c.name?.toLowerCase() === form.client_name.toLowerCase())
      if (!existing) {
        const { data: newClient } = await supabase.from('clients').insert({
          name: form.client_name,
          contact_person: form.client_contact,
          email: form.client_email,
          vat_number: form.client_vat,
          type: toDbClientType(form.client_type) === 'end_user' ? 'end_user' : 'reseller',
        }).select('id').single()

        if (newClient) {
          // Create pipeline entry for new client
          await supabase.from('pipeline').insert({
            client_id: newClient.id,
            client_name: form.client_name,
            status: 'lead_generated',
            quotes_status: 'Quoted',
          })
        }
      }
    } else if (clientMode === 'existing' && form.client_id) {
      // Update existing client's pipeline entry
      await supabase.from('pipeline')
        .update({ quotes_status: 'Quoted' })
        .eq('client_id', form.client_id)
    }

    const { error } = await supabase.from('quotes').insert({
      quote_number: quoteNumber,
      client_id: form.client_id || null,
      client_name: form.client_name,
      client_contact: form.client_contact,
      client_email: form.client_email,
      client_vat: form.client_vat,
      client_type: toDbClientType(form.client_type),
      project_title: form.project_title,
      date: form.date,
      due_date: form.due_date,
      status: form.status,
      currency: form.currency,
      region: form.region,
      include_installation: form.include_installation,
      discount: form.discount,
      discount_type: form.discount_type,
      notes: form.notes,
      line_items: form.line_items,
    })

    setSaving(false)
    if (error) {
      console.error('Error creating quote:', error)
      toast.error('Failed to create quote')
      return
    }

    toast.success(`Quote ${quoteNumber} created successfully`)
    setForm(getEmptyQuote())
    setClientMode('existing')
    setSelectedClientId('')
    setModalOpen(false)
    fetchAll()
  }

  // Open detail modal
  const openDetail = (quote: Quote) => {
    setDetailQuote(quote)
    setEditForm({
      client_id: quote.client_id || '',
      client_name: quote.client_name || '',
      client_contact: quote.client_contact || '',
      client_email: quote.client_email || '',
      client_vat: quote.client_vat || '',
      client_type: quote.client_type || 'End User',
      project_title: quote.project_title || '',
      date: quote.date || '',
      due_date: quote.due_date || '',
      status: quote.status?.toLowerCase() || 'draft',
      currency: quote.currency || 'ZAR',
      region: quote.region || 'Gauteng',
      include_installation: quote.include_installation || false,
      discount: quote.discount || 0,
      discount_type: quote.discount_type || 'percent',
      notes: quote.notes || '',
      line_items: quote.line_items || [],
    })
    setEditing(false)
  }

  const closeDetail = () => {
    setDetailQuote(null)
    setEditing(false)
  }

  // Save edit
  const saveEdit = async () => {
    if (!detailQuote) return
    const loadingToast = toast.loading('Saving changes...')
    
    const { error } = await supabase.from('quotes').update({
      client_name: editForm.client_name,
      client_contact: editForm.client_contact,
      client_email: editForm.client_email,
      client_vat: editForm.client_vat,
      client_type: toDbClientType(editForm.client_type),
      project_title: editForm.project_title,
      date: editForm.date,
      due_date: editForm.due_date,
      status: editForm.status,
      currency: editForm.currency,
      region: editForm.region,
      include_installation: editForm.include_installation,
      discount: editForm.discount,
      discount_type: editForm.discount_type,
      notes: editForm.notes,
      line_items: editForm.line_items,
      updated_at: new Date().toISOString(),
    }).eq('id', detailQuote.id)

    if (error) {
      console.error('Error saving quote:', JSON.stringify(error))
      toast.error('Failed to save changes', { id: loadingToast })
      console.log('Edit form data:', JSON.stringify(editForm, null, 2))
      return
    }

    toast.success('Quote updated successfully', { id: loadingToast })
    setDetailQuote({ ...detailQuote, ...editForm })
    setEditing(false)
    fetchAll()
  }

  // Delete quote
  const deleteQuote = async () => {
    if (!detailQuote) return
    if (!confirm(`Delete quote "${detailQuote.quote_number}"? This cannot be undone.`)) return
    
    const loadingToast = toast.loading('Deleting quote...')
    const { error } = await supabase.from('quotes').delete().eq('id', detailQuote.id)
    if (error) {
      console.error('Error deleting:', error)
      toast.error('Failed to delete quote', { id: loadingToast })
      return
    }
    toast.success('Quote deleted', { id: loadingToast })
    closeDetail()
    fetchAll()
  }

  // Duplicate quote
  const duplicateQuote = async () => {
    if (!detailQuote) return
    const newQuoteNo = nextQuoteNo()
    const loadingToast = toast.loading('Duplicating quote...')
    
    const { error } = await supabase.from('quotes').insert({
      ...detailQuote,
      id: undefined,
      quote_number: newQuoteNo,
      date: new Date().toISOString().split('T')[0],
      status: 'draft',
      created_at: undefined,
      updated_at: undefined,
    })

    if (error) {
      console.error('Error duplicating:', error)
      toast.error('Failed to duplicate quote', { id: loadingToast })
      return
    }

    toast.success(`Quote duplicated as ${newQuoteNo}`, { id: loadingToast })
    closeDetail()
    fetchAll()
  }

  // Convert to order
  const convertToOrder = async () => {
    if (!detailQuote) return
    const totals = calculateQuoteTotal(detailQuote, formula)
    const loadingToast = toast.loading('Creating order...')

    const { error } = await supabase.from('orders').insert({
      quote_id: detailQuote.id,
      client_id: detailQuote.client_id,
      client_name: detailQuote.client_name,
      order_number: `ORD${new Date().getFullYear().toString().slice(-2)}${String(Date.now()).slice(-4)}`,
      status: 'order_created',
      value_zar: totals.total,
      notes: detailQuote.project_title || '',
      order_date: new Date().toISOString().split('T')[0],
    })

    if (error) {
      console.error('Error creating order:', error)
      toast.error('Failed to create order', { id: loadingToast })
      return
    }

    // Update quote status
    await supabase.from('quotes').update({ status: 'accepted' }).eq('id', detailQuote.id)

    // Update pipeline status to po_received
    await supabase.from('pipeline')
      .update({ status: 'po_received', quotes_status: 'Approved' })
      .eq('client_name', detailQuote.client_name)

    toast.success('Order created successfully!', { id: loadingToast })
    closeDetail()
    fetchAll()
  }

  // Convert to invoice
  const convertToInvoice = async () => {
    if (!detailQuote) return
    const totals = calculateQuoteTotal(detailQuote, formula)
    const loadingToast = toast.loading('Creating invoice...')

    // Generate invoice number
    const year = new Date().getFullYear().toString().slice(-2)
    const { data: existingInvoices } = await supabase
      .from('invoices')
      .select('invoice_number')
      .like('invoice_number', `INV-${year}%`)
    
    const maxNum = (existingInvoices || []).reduce((max, inv) => {
      const num = parseInt(inv.invoice_number?.slice(-4) || '0')
      return num > max ? num : max
    }, 0)
    const invoiceNumber = `INV-${year}${String(maxNum + 1).padStart(4, '0')}`

    // Convert quote line items to invoice format (ZAR prices)
    const invoiceLineItems = (detailQuote.line_items || []).map(item => {
      const itemCurrency = item.currency || detailQuote.currency || 'USD'
      const isItemUSD = itemCurrency === 'USD'
      const zarPrice = isItemUSD
        ? calculateZarPrice(item.unitPrice, detailQuote.client_type, formula, detailQuote.region, detailQuote.include_installation)
        : item.unitPrice
      return {
        product: item.product,
        description: item.description || '',
        qty: item.qty,
        unitPrice: zarPrice,
      }
    })

    // Calculate due date (30 days from now)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)

    const { error } = await supabase.from('invoices').insert({
      invoice_number: invoiceNumber,
      quote_id: detailQuote.id,
      client_id: detailQuote.client_id,
      client_name: detailQuote.client_name,
      client_email: detailQuote.client_email || null,
      client_vat: detailQuote.client_vat || null,
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: dueDate.toISOString().split('T')[0],
      status: 'unpaid',
      subtotal: totals.subtotal,
      discount: totals.discountAmount,
      vat_amount: totals.vat,
      total: totals.total,
      amount_paid: 0,
      line_items: invoiceLineItems,
      notes: detailQuote.notes || null,
      payment_terms: 'Payment due within 30 days of invoice date',
    })

    if (error) {
      console.error('Error creating invoice:', error)
      toast.error('Failed to create invoice', { id: loadingToast })
      return
    }

    // Update quote status to accepted if not already
    if (detailQuote.status?.toLowerCase() !== 'accepted') {
      await supabase.from('quotes').update({ status: 'accepted' }).eq('id', detailQuote.id)
    }

    toast.success(`Invoice ${invoiceNumber} created successfully!`, { id: loadingToast })
    closeDetail()
    fetchAll()
  }

  // Preview totals
  const previewTotal = calculateQuoteTotal(form, formula)
  const editTotal = calculateQuoteTotal(editForm, formula)

  // Line item editor - renders inline to avoid component recreation issues
  const renderLineItems = (
    items: QuoteLineItem[],
    onAdd: () => void,
    onUpdate: (idx: number, field: keyof QuoteLineItem, val: string | number | null | 'USD' | 'ZAR') => void,
    onRemove: (idx: number) => void,
    onImageUpload: (idx: number, e: React.ChangeEvent<HTMLInputElement>) => void,
    onSelectFromProducts: (idx: number, product: StockItem) => void,
    defaultCurrency: string
  ) => (
    <div className="p-3 bg-slate-50 rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-500 uppercase">Products (per-item currency)</div>
        <button type="button" onClick={onAdd} className="text-xs text-teal-600 font-semibold">+ Add Item</button>
      </div>

      {items.map((item, index) => {
        const itemCurrency = item.currency || defaultCurrency || 'USD'
        return (
          <div key={`item-${index}`} className="p-3 bg-white rounded-lg border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Item {index + 1}</span>
              {items.length > 1 && (
                <button type="button" onClick={() => onRemove(index)} className="text-xs text-red-500">Remove</button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {item.image ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.image} alt="Product" className="w-16 h-16 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => onUpdate(index, 'image', null)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                  >×</button>
                </div>
              ) : (
                <label className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition">
                  <input type="file" accept="image/*" onChange={(e) => onImageUpload(index, e)} className="hidden" />
                  <Package className="w-6 h-6 text-slate-400" />
                </label>
              )}
              <div className="flex-1 space-y-2">
                <ProductInput
                  value={item.product || ''}
                  products={products}
                  onSelect={(product) => onSelectFromProducts(index, product)}
                  onManualEntry={(text) => onUpdate(index, 'product', text)}
                />
                <input
                  placeholder="Description (optional)"
                  value={item.description || ''}
                  onChange={(e) => onUpdate(index, 'description', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Qty"
                value={item.qty || ''}
                onChange={(e) => onUpdate(index, 'qty', e.target.value === '' ? 0 : parseInt(e.target.value) || item.qty)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <input
                type="text"
                inputMode="decimal"
                placeholder={`Price`}
                value={item.unitPrice || ''}
                onChange={(e) => {
                  let val = e.target.value
                  // Replace comma with dot for decimal (mobile keyboard support)
                  val = val.replace(',', '.')
                  // Allow decimal input - accept . and digits
                  if (val === '' || val === '.' || /^\d*\.?\d*$/.test(val)) {
                    // Keep the string value to preserve decimal point while typing
                    onUpdate(index, 'unitPrice', val === '' ? 0 : val)
                  }
                }}
                onBlur={(e) => {
                  // On blur, ensure it's stored as a proper number
                  const val = e.target.value.replace(',', '.')
                  const num = parseFloat(val) || 0
                  onUpdate(index, 'unitPrice', num)
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {/* Per-item currency toggle */}
              <div className="flex rounded-lg overflow-hidden border border-slate-300">
                <button
                  type="button"
                  onClick={() => onUpdate(index, 'currency', 'USD')}
                  className={`flex-1 py-2 text-xs font-semibold transition ${itemCurrency === 'USD' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                  title="USD - will convert using formula"
                >
                  $ USD
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate(index, 'currency', 'ZAR')}
                  className={`flex-1 py-2 text-xs font-semibold transition ${itemCurrency === 'ZAR' ? 'bg-green-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                  title="ZAR - direct price, no conversion"
                >
                  R ZAR
                </button>
              </div>
            </div>
            {itemCurrency === 'USD' && (
              <p className="text-xs text-blue-600">💱 Will convert using formula</p>
            )}
            {itemCurrency === 'ZAR' && (
              <p className="text-xs text-green-600">🇿🇦 Direct ZAR price (no conversion)</p>
            )}
          </div>
        )
      })}
    </div>
  )

  // Quote intelligence stats
  const quoteStats = useMemo(() => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    
    const quotesThisMonth = quotes.filter(q => new Date(q.created_at) >= startOfMonth)
    const accepted = quotes.filter(q => q.status?.toLowerCase() === 'accepted')
    const declined = quotes.filter(q => q.status?.toLowerCase() === 'declined')
    const sent = quotes.filter(q => q.status?.toLowerCase() === 'sent')
    
    const totalDecided = accepted.length + declined.length
    const winRate = totalDecided > 0 ? Math.round((accepted.length / totalDecided) * 100) : 0
    
    // Calculate cold quotes (sent > 7 days ago)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const coldQuotes = sent.filter(q => {
      const sentDate = new Date(q.date || q.created_at)
      return sentDate < sevenDaysAgo
    })
    
    // Total value of pending quotes
    const pendingValue = sent.reduce((sum, q) => {
      const total = calculateQuoteTotal(q, formula)
      return sum + total.total
    }, 0)
    
    return {
      total: quotes.length,
      thisMonth: quotesThisMonth.length,
      accepted: accepted.length,
      declined: declined.length,
      sent: sent.length,
      winRate,
      coldQuotes: coldQuotes.length,
      pendingValue
    }
  }, [quotes, formula])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Quotes</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 w-32 sm:w-48"
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
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700"
          >
            <Plus className="w-4 h-4" /> Create
          </button>
        </div>
      </div>

      {/* Quote Intelligence Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
            <TrendingUp className="w-4 h-4" />
            Total Quotes
          </div>
          <div className="text-2xl font-bold text-slate-900">{quoteStats.total}</div>
          <div className="text-xs text-slate-500 mt-1">{quoteStats.thisMonth} this month</div>
        </div>
        
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
          <div className="flex items-center gap-2 text-emerald-600 text-sm mb-1">
            <Target className="w-4 h-4" />
            Win Rate
          </div>
          <div className="text-2xl font-bold text-emerald-700">{quoteStats.winRate}%</div>
          <div className="text-xs text-emerald-600 mt-1">{quoteStats.accepted} won / {quoteStats.declined} lost</div>
        </div>
        
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
          <div className="flex items-center gap-2 text-blue-600 text-sm mb-1">
            <Clock className="w-4 h-4" />
            Pending
          </div>
          <div className="text-2xl font-bold text-blue-700">{quoteStats.sent}</div>
          <div className="text-xs text-blue-600 mt-1">{fmtCurrency(quoteStats.pendingValue)} value</div>
        </div>
        
        {quoteStats.coldQuotes > 0 ? (
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
            <div className="flex items-center gap-2 text-amber-600 text-sm mb-1">
              <AlertTriangle className="w-4 h-4" />
              Going Cold
            </div>
            <div className="text-2xl font-bold text-amber-700">{quoteStats.coldQuotes}</div>
            <div className="text-xs text-amber-600 mt-1">7+ days no response</div>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
              <Clock className="w-4 h-4" />
              Going Cold
            </div>
            <div className="text-2xl font-bold text-slate-400">0</div>
            <div className="text-xs text-slate-400 mt-1">All quotes fresh</div>
          </div>
        )}
      </div>

      {/* Quotes List */}
      {filteredQuotes.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="text-4xl mb-3">📝</div>
          <p className="text-slate-500 mb-3">No quotes found</p>
          <button onClick={() => setModalOpen(true)} className="text-teal-600 font-medium hover:underline">
            + Create your first quote
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {STATUSES.map(status => {
            const statusQuotes = groupedQuotes[status]
            if (!statusQuotes || statusQuotes.length === 0) return null
            const colors = STATUS_COLORS[status]

            return (
              <div key={status}>
                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3 flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                    {STATUS_ICONS[status]}
                    {STATUS_LABELS[status]}
                  </span>
                  <span>({statusQuotes.length})</span>
                </h3>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {statusQuotes.map(quote => {
                    const totals = calculateQuoteTotal(quote, formula)
                    const quoteAge = daysBetween(new Date(quote.date || quote.created_at), new Date())
                    const isCold = (quote.status?.toLowerCase() === 'sent') && quoteAge > 7
                    
                    return (
                      <div
                        key={quote.id}
                        onClick={() => openDetail(quote)}
                        className={`rounded-xl border p-4 cursor-pointer active:bg-slate-50 ${
                          isCold ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="font-mono text-sm text-slate-500">{quote.quote_number}</span>
                            <h3 className="font-semibold text-slate-800">{quote.client_name}</h3>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <StatusBadge 
                              status={quote.status} 
                              onStatusChange={(newStatus) => updateQuoteStatus(quote, newStatus)} 
                            />
                            {isCold && (
                              <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {quoteAge}d old
                              </span>
                            )}
                          </div>
                        </div>
                        {quote.project_title && <p className="text-sm text-slate-600 mb-2 truncate">{quote.project_title}</p>}
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-500">{quote.date}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">{fmtCurrency(totals.total)}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); downloadPdf(quote) }}
                              disabled={generatingPdf === quote.id}
                              className="p-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                            >
                              {generatingPdf === quote.id ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">Quote</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">Client</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">Project</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">Date</th>
                        <th className="px-4 py-3 text-center font-semibold text-slate-600">Age</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-600">Total</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {statusQuotes.map(quote => {
                        const totals = calculateQuoteTotal(quote, formula)
                        const quoteAge = daysBetween(new Date(quote.date || quote.created_at), new Date())
                        const isCold = (quote.status?.toLowerCase() === 'sent') && quoteAge > 7
                        
                        return (
                          <tr key={quote.id} onClick={() => openDetail(quote)} className={`cursor-pointer ${isCold ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50'}`}>
                            <td className="px-4 py-3 font-mono text-slate-600">{quote.quote_number}</td>
                            <td className="px-4 py-3 font-medium text-slate-800">{quote.client_name}</td>
                            <td className="px-4 py-3 text-slate-600 truncate max-w-[200px]">{quote.project_title || '-'}</td>
                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                              <StatusBadge 
                                status={quote.status} 
                                onStatusChange={(newStatus) => updateQuoteStatus(quote, newStatus)} 
                              />
                            </td>
                            <td className="px-4 py-3 text-slate-500">{quote.date}</td>
                            <td className="px-4 py-3 text-center">
                              {isCold ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                                  <Clock className="w-3 h-3" /> {quoteAge}d
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">{quoteAge}d</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">{fmtCurrency(totals.total)}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => downloadPdf(quote)}
                                  disabled={generatingPdf === quote.id}
                                  className="flex items-center gap-1 bg-teal-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-teal-700 disabled:opacity-50"
                                  title="Download PDF"
                                >
                                  {generatingPdf === quote.id ? (
                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Download className="w-3 h-3" />
                                  )}
                                  PDF
                                </button>
                                <button
                                  onClick={() => viewPdf(quote)}
                                  className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
                                  title="View PDF"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Quote Detail Modal */}
      <Modal open={!!detailQuote} onClose={closeDetail} title={editing ? 'Edit Quote' : 'Quote Details'} wide>
        {detailQuote && (
          <div className="space-y-4">
            {editing ? (
              /* EDIT MODE */
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                {/* Client Type */}
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Client Type</label>
                  <div className="flex rounded-xl overflow-hidden border border-slate-300">
                    <button type="button" onClick={() => setEditForm(f => ({ ...f, client_type: 'Reseller' }))} className={`flex-1 py-2 text-sm font-semibold transition ${editForm.client_type === 'Reseller' || editForm.client_type === 'reseller' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}>Reseller</button>
                    <button type="button" onClick={() => setEditForm(f => ({ ...f, client_type: 'Single Seller' }))} className={`flex-1 py-2 text-sm font-semibold transition ${editForm.client_type === 'Single Seller' || editForm.client_type === 'single_seller' ? 'bg-purple-600 text-white' : 'bg-white text-slate-600'}`}>Single Seller</button>
                    <button type="button" onClick={() => setEditForm(f => ({ ...f, client_type: 'End User' }))} className={`flex-1 py-2 text-sm font-semibold transition ${editForm.client_type === 'End User' || editForm.client_type === 'end_user' ? 'bg-green-600 text-white' : 'bg-white text-slate-600'}`}>End User</button>
                  </div>
                </div>

                {/* Region & Installation */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Region</label>
                    <select value={editForm.region} onChange={(e) => setEditForm(f => ({ ...f, region: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                      {REGIONS.map(r => <option key={r} value={r}>{r} ({formula?.region_markups?.[r] || 0}%)</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Installation</label>
                    <div className="flex rounded-xl overflow-hidden border border-slate-300">
                      <button type="button" onClick={() => setEditForm(f => ({ ...f, include_installation: false }))} className={`flex-1 py-2 text-sm font-semibold transition ${!editForm.include_installation ? 'bg-slate-700 text-white' : 'bg-white text-slate-600'}`}>No</button>
                      <button type="button" onClick={() => setEditForm(f => ({ ...f, include_installation: true }))} className={`flex-1 py-2 text-sm font-semibold transition ${editForm.include_installation ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}>Yes</button>
                    </div>
                  </div>
                </div>

                {/* Client */}
                <div className="grid grid-cols-2 gap-3">
                  <input value={editForm.client_name || ''} onChange={(e) => setEditForm(f => ({ ...f, client_name: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Client Name" />
                  <input value={editForm.client_contact || ''} onChange={(e) => setEditForm(f => ({ ...f, client_contact: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Contact Person" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input value={editForm.client_email || ''} onChange={(e) => setEditForm(f => ({ ...f, client_email: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Email" />
                  <input value={editForm.client_vat || ''} onChange={(e) => setEditForm(f => ({ ...f, client_vat: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="VAT Number" />
                </div>

                {/* Project & Dates */}
                <input value={editForm.project_title || ''} onChange={(e) => setEditForm(f => ({ ...f, project_title: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Project Title" />
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
                    <input type="date" value={editForm.date || ''} onChange={(e) => setEditForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Due Date</label>
                    <input type="date" value={editForm.due_date || ''} onChange={(e) => setEditForm(f => ({ ...f, due_date: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                    <select value={editForm.status || ''} onChange={(e) => setEditForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                      {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </div>
                </div>

                {/* Line Items */}
                {renderLineItems(
                  editForm.line_items || [],
                  addEditLineItem,
                  updateEditLineItem,
                  removeEditLineItem,
                  handleEditImageUpload,
                  selectEditFromProducts,
                  editForm.currency
                )}

                {/* Discount */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <label className="mb-2 block text-sm font-semibold text-amber-800">💰 Discount</label>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      value={editForm.discount || ''}
                      onChange={(e) => setEditForm(f => ({ ...f, discount: Number(e.target.value) }))}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="0"
                    />
                    <select
                      value={editForm.discount_type || 'percent'}
                      onChange={(e) => setEditForm(f => ({ ...f, discount_type: e.target.value }))}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="percent">%</option>
                      <option value="fixed">R (fixed)</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Notes</label>
                  <textarea value={editForm.notes || ''} onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" rows={2} placeholder="Notes (appears on printed quote)..." />
                </div>

                {/* Preview Total */}
                <div className="p-4 bg-slate-100 rounded-xl">
                  <div className="flex justify-between text-sm mb-1"><span>Subtotal:</span><span>{fmtCurrency(editTotal.subtotal)}</span></div>
                  {editTotal.discountAmount > 0 && <div className="flex justify-between text-sm text-red-600 mb-1"><span>Discount:</span><span>-{fmtCurrency(editTotal.discountAmount)}</span></div>}
                  <div className="flex justify-between text-sm mb-1"><span>VAT (15%):</span><span>{fmtCurrency(editTotal.vat)}</span></div>
                  <div className="flex justify-between font-bold text-lg border-t border-slate-300 pt-2 mt-2"><span>Total:</span><span>{fmtCurrency(editTotal.total)}</span></div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 sticky bottom-0 bg-white">
                  <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                  <button onClick={saveEdit} className="bg-teal-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-teal-700">Save Changes</button>
                </div>
              </div>
            ) : (
              /* VIEW MODE */
              <>
                {/* Header */}
                <div className="bg-gradient-to-r from-teal-500 to-teal-600 rounded-xl p-4 text-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-white/70 text-sm">{detailQuote.quote_number}</span>
                      <h3 className="text-xl font-bold">{detailQuote.client_name}</h3>
                      {detailQuote.project_title && <p className="text-white/80">{detailQuote.project_title}</p>}
                    </div>
                    <StatusBadge 
                      status={detailQuote.status} 
                      onStatusChange={(newStatus) => updateQuoteStatus(detailQuote, newStatus)} 
                    />
                  </div>
                </div>

                {/* Quick Status Actions */}
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Quick Actions</div>
                  <div className="flex flex-wrap gap-2">
                    {detailQuote.status?.toLowerCase() === 'draft' && (
                      <button
                        onClick={() => updateQuoteStatus(detailQuote, 'sent')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                      >
                        <Send className="w-3.5 h-3.5" /> Mark as Sent
                      </button>
                    )}
                    {(detailQuote.status?.toLowerCase() === 'draft' || detailQuote.status?.toLowerCase() === 'sent') && (
                      <>
                        <button
                          onClick={() => updateQuoteStatus(detailQuote, 'accepted')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
                        >
                          <Check className="w-3.5 h-3.5" /> Mark as Accepted
                        </button>
                        <button
                          onClick={() => updateQuoteStatus(detailQuote, 'declined')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Mark as Declined
                        </button>
                      </>
                    )}
                    {detailQuote.status?.toLowerCase() === 'sent' && (
                      <button
                        onClick={() => updateQuoteStatus(detailQuote, 'expired')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
                      >
                        <Timer className="w-3.5 h-3.5" /> Mark as Expired
                      </button>
                    )}
                  </div>
                </div>

                {/* Client Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Client</h4>
                    <p className="font-medium text-slate-800">{detailQuote.client_name}</p>
                    {detailQuote.client_contact && <p className="text-sm text-slate-600">{detailQuote.client_contact}</p>}
                    {detailQuote.client_email && <p className="text-sm text-slate-600">{detailQuote.client_email}</p>}
                    <Badge variant={detailQuote.client_type === 'end_user' || detailQuote.client_type === 'End User' ? 'green' : 'blue'} className="mt-2">{detailQuote.client_type === 'reseller' ? 'Reseller' : detailQuote.client_type === 'single_seller' ? 'Single Seller' : detailQuote.client_type === 'end_user' ? 'End User' : detailQuote.client_type}</Badge>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Details</h4>
                    <p className="text-sm"><span className="text-slate-500">Date:</span> <span className="font-medium">{detailQuote.date}</span></p>
                    <p className="text-sm"><span className="text-slate-500">Due:</span> <span className="font-medium">{detailQuote.due_date || '-'}</span></p>
                    <p className="text-sm"><span className="text-slate-500">Region:</span> <span className="font-medium">{detailQuote.region}</span></p>
                    <p className="text-sm"><span className="text-slate-500">Installation:</span> <span className="font-medium">{detailQuote.include_installation ? 'Yes' : 'No'}</span></p>
                  </div>
                </div>

                {/* Line Items */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Line Items ({detailQuote.line_items?.length || 0})</div>
                  <div className="divide-y divide-slate-100">
                    {detailQuote.line_items?.map((item, i) => {
                      // Per-item currency
                      const itemCurrency = item.currency || detailQuote.currency || 'USD'
                      const isItemUSD = itemCurrency === 'USD'
                      const zarPrice = isItemUSD
                        ? calculateZarPrice(item.unitPrice, detailQuote.client_type, formula, detailQuote.region, detailQuote.include_installation)
                        : item.unitPrice
                      return (
                        <div key={i} className="flex items-center gap-4 p-4">
                          {item.image ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={item.image} alt="" className="w-12 h-12 rounded-lg object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400"><Package className="w-5 h-5" /></div>
                          )}
                          <div className="flex-1">
                            <p className="font-medium text-slate-800">{item.product}</p>
                            {item.description && <p className="text-xs text-slate-500">{item.description}</p>}
                            <span className={`inline-block mt-1 text-xs px-1.5 py-0.5 rounded ${isItemUSD ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                              {isItemUSD ? `$${item.unitPrice} USD` : `R${item.unitPrice} ZAR`}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate-500">× {item.qty}</p>
                            <p className="font-semibold">{fmtCurrency(zarPrice * item.qty)}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Totals */}
                {(() => {
                  const totals = calculateQuoteTotal(detailQuote, formula)
                  return (
                    <div className="bg-slate-800 text-white rounded-xl p-4">
                      <div className="flex justify-between text-sm mb-1 text-slate-300"><span>Subtotal:</span><span>{fmtCurrency(totals.subtotal)}</span></div>
                      {totals.discountAmount > 0 && <div className="flex justify-between text-sm mb-1 text-red-400"><span>Discount:</span><span>-{fmtCurrency(totals.discountAmount)}</span></div>}
                      <div className="flex justify-between text-sm mb-2 text-slate-300"><span>VAT (15%):</span><span>{fmtCurrency(totals.vat)}</span></div>
                      <div className="flex justify-between font-bold text-xl border-t border-slate-600 pt-2"><span>Total:</span><span>{fmtCurrency(totals.total)}</span></div>
                    </div>
                  )
                })()}

                {/* Notes */}
                {detailQuote.notes && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-amber-700 uppercase mb-1">Notes</h4>
                    <p className="text-sm text-slate-700">{detailQuote.notes}</p>
                  </div>
                )}

                {/* Convert to Order/Invoice - Only for Accepted quotes */}
                {detailQuote.status?.toLowerCase() === 'accepted' && (
                  <div className="flex gap-2 mb-2">
                    <button onClick={convertToOrder} className="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
                      📦 Convert to Order
                    </button>
                    <button onClick={convertToInvoice} className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                      📄 Convert to Invoice
                    </button>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-200">
                  <button 
                    onClick={() => downloadPdf(detailQuote)} 
                    disabled={generatingPdf === detailQuote.id}
                    className="flex-1 flex items-center justify-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                  >
                    {generatingPdf === detailQuote.id ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    Download PDF
                  </button>
                  <button 
                    onClick={() => viewPdf(detailQuote)} 
                    className="flex items-center justify-center gap-2 border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50"
                  >
                    <Eye className="w-4 h-4" /> View
                  </button>
                  <button onClick={() => setEditing(true)} className="flex-1 flex items-center justify-center gap-2 border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50">
                    <Edit2 className="w-4 h-4" /> Edit
                  </button>
                  <button onClick={duplicateQuote} className="flex items-center justify-center gap-2 border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50">
                    <Copy className="w-4 h-4" /> Duplicate
                  </button>
                  <button onClick={deleteQuote} className="flex items-center justify-center gap-2 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50">
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Create Quote Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Quote" wide>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {/* Client Type */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Client Type</label>
            <div className="flex rounded-xl overflow-hidden border border-slate-300">
              <button type="button" onClick={() => setForm(f => ({ ...f, client_type: 'Reseller' }))} className={`flex-1 py-3 text-sm font-semibold transition ${form.client_type === 'Reseller' || form.client_type === 'reseller' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}>Reseller</button>
              <button type="button" onClick={() => setForm(f => ({ ...f, client_type: 'Single Seller' }))} className={`flex-1 py-3 text-sm font-semibold transition ${form.client_type === 'Single Seller' || form.client_type === 'single_seller' ? 'bg-purple-600 text-white' : 'bg-white text-slate-600'}`}>Single Seller</button>
              <button type="button" onClick={() => setForm(f => ({ ...f, client_type: 'End User' }))} className={`flex-1 py-3 text-sm font-semibold transition ${form.client_type === 'End User' || form.client_type === 'end_user' ? 'bg-green-600 text-white' : 'bg-white text-slate-600'}`}>End User</button>
            </div>
          </div>

          {/* Region & Installation */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Region</label>
              <select value={form.region} onChange={(e) => setForm(f => ({ ...f, region: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                {REGIONS.map(r => <option key={r} value={r}>{r} ({formula?.region_markups?.[r] || 0}%)</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Installation</label>
              <div className="flex rounded-xl overflow-hidden border border-slate-300">
                <button type="button" onClick={() => setForm(f => ({ ...f, include_installation: false }))} className={`flex-1 py-3 text-sm font-semibold transition ${!form.include_installation ? 'bg-slate-700 text-white' : 'bg-white text-slate-600'}`}>No</button>
                <button type="button" onClick={() => setForm(f => ({ ...f, include_installation: true }))} className={`flex-1 py-3 text-sm font-semibold transition ${form.include_installation ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}>Yes (+Region)</button>
              </div>
            </div>
          </div>

          {/* Client */}
          <div className="p-3 bg-slate-50 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-500 uppercase">Client Details</div>
              <div className="flex rounded-lg overflow-hidden border border-slate-300 text-xs">
                <button type="button" onClick={() => { setClientMode('existing'); setSelectedClientId(''); setForm(f => ({ ...f, client_name: '', client_contact: '', client_email: '', client_vat: '', client_id: '' })) }} className={`px-3 py-1.5 font-medium transition ${clientMode === 'existing' ? 'bg-teal-600 text-white' : 'bg-white text-slate-600'}`}>Existing</button>
                <button type="button" onClick={() => { setClientMode('new'); setSelectedClientId('') }} className={`px-3 py-1.5 font-medium transition ${clientMode === 'new' ? 'bg-teal-600 text-white' : 'bg-white text-slate-600'}`}>+ New</button>
              </div>
            </div>

            {clientMode === 'existing' ? (
              <>
                <select required value={selectedClientId} onChange={(e) => handleClientSelect(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                  <option value="">Select a client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type === 'reseller' ? 'Reseller' : 'End User'})</option>)}
                </select>
                {selectedClientId && (
                  <div className="text-xs text-slate-500 bg-white p-2 rounded-lg">
                    {form.client_contact && <div>Contact: {form.client_contact}</div>}
                    {form.client_email && <div>Email: {form.client_email}</div>}
                  </div>
                )}
              </>
            ) : (
              <>
                <input required value={form.client_name} onChange={(e) => setForm(f => ({ ...f, client_name: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Company Name *" />
                <input value={form.client_contact} onChange={(e) => setForm(f => ({ ...f, client_contact: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Contact Person" />
                <input type="email" value={form.client_email} onChange={(e) => setForm(f => ({ ...f, client_email: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Email" />
                <input value={form.client_vat} onChange={(e) => setForm(f => ({ ...f, client_vat: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="VAT Number" />
                <p className="text-xs text-amber-600">💡 New client will be added to Clients table</p>
              </>
            )}
          </div>

          {/* Project & Dates */}
          <input value={form.project_title} onChange={(e) => setForm(f => ({ ...f, project_title: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Project Title" />
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm font-medium text-slate-700">Date</label><input type="date" required value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
            <div><label className="mb-1 block text-sm font-medium text-slate-700">Due Date</label><input type="date" required value={form.due_date} onChange={(e) => setForm(f => ({ ...f, due_date: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
          </div>

          {/* Line Items */}
          {renderLineItems(
            form.line_items,
            addLineItem,
            updateLineItem,
            removeLineItem,
            handleImageUpload,
            selectFromProducts,
            form.currency
          )}

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Notes (appears on printed quote)</label>
            <textarea value={form.notes || ''} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" rows={2} placeholder="Notes for the client..." />
          </div>

          {/* Discount */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <label className="mb-2 block text-sm font-semibold text-amber-800">💰 Discount (optional)</label>
            <div className="flex gap-3">
              <input type="number" value={form.discount || ''} onChange={(e) => setForm(f => ({ ...f, discount: Number(e.target.value) }))} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="0" />
              <select value={form.discount_type || 'percent'} onChange={(e) => setForm(f => ({ ...f, discount_type: e.target.value }))} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="percent">%</option>
                <option value="fixed">R (fixed)</option>
              </select>
            </div>
          </div>

          {/* Preview Total */}
          {previewTotal.subtotal > 0 && (
            <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
              <div className="flex justify-between text-sm"><span>Subtotal:</span><span>{fmtCurrency(previewTotal.subtotal)}</span></div>
              {previewTotal.discountAmount > 0 && <div className="flex justify-between text-sm text-red-600"><span>Discount:</span><span>-{fmtCurrency(previewTotal.discountAmount)}</span></div>}
              <div className="flex justify-between text-sm"><span>VAT (15%):</span><span>{fmtCurrency(previewTotal.vat)}</span></div>
              <div className="flex justify-between font-bold text-lg border-t border-teal-200 pt-2 mt-2"><span>Total:</span><span>{fmtCurrency(previewTotal.total)}</span></div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 sticky bottom-0 bg-white">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="bg-teal-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Quote'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
