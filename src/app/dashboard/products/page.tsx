'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { StockItem, StockMovement, Formula } from '@/lib/types'
import { Package, Plus, Minus, AlertTriangle, TrendingUp, TrendingDown, X, Search, History, RefreshCw, Edit2, DollarSign, Upload, Trash2 } from 'lucide-react'

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

const ADJUSTMENT_REASONS = ['restock', 'sale', 'damaged', 'returned', 'adjustment', 'audit', 'other']

// Fixed product categories
const PRODUCT_CATEGORIES = [
  'Key Cabinet',
  'Parts',
  'Lockers',
  'Software',
] as const

// Currency type
type Currency = 'ZAR' | 'USD'

// Category badge colors
function getCategoryBadgeClass(category: string | null | undefined): string {
  switch (category) {
    case 'Key Cabinet':
      return 'bg-blue-100 text-blue-700'
    case 'Parts':
      return 'bg-slate-100 text-slate-600'
    case 'Lockers':
      return 'bg-purple-100 text-purple-700'
    case 'Software':
      return 'bg-emerald-100 text-emerald-700'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

function getStockStatus(quantity: number, reorderPoint: number): 'in_stock' | 'low_stock' | 'out_of_stock' {
  if (quantity <= 0) return 'out_of_stock'
  if (quantity <= reorderPoint) return 'low_stock'
  return 'in_stock'
}

function getStatusBadge(status: ReturnType<typeof getStockStatus>) {
  switch (status) {
    case 'in_stock':
      return <span className="badge badge-green">In Stock</span>
    case 'low_stock':
      return <span className="badge badge-amber">Low Stock</span>
    case 'out_of_stock':
      return <span className="badge badge-red">Out of Stock</span>
  }
}

function fmtCurrency(val: number | undefined | null, currency: Currency = 'ZAR'): string {
  if (val == null || isNaN(val)) return currency === 'USD' ? '$ 0.00' : 'R 0.00'
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
  }
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(val)
}

function calculateZarPrice(usdPrice: number, formula: Formula | null): number {
  if (!formula) return usdPrice * 17.5
  const exchangeRate = formula.exchange_rate || 17.5
  const shipping = formula.shipping_multiplier || 1.4
  const gp = formula.gp_divisor || 0.7
  const deliveryMult = 1 + (formula.delivery_percent || 10) / 100
  return (usdPrice * exchangeRate * shipping * deliveryMult) / gp
}

export default function ProductsPage() {
  const [items, setItems] = useState<StockItem[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [formula, setFormula] = useState<Formula | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterText, setFilterText] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all')
  const [filterCategory, setFilterCategory] = useState('all')

  // Modal states
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [addItemModalOpen, setAddItemModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)

  // Adjustment form
  const [adjustType, setAdjustType] = useState<'add' | 'remove'>('add')
  const [adjustQuantity, setAdjustQuantity] = useState('')
  const [adjustReason, setAdjustReason] = useState('restock')
  const [adjustReference, setAdjustReference] = useState('')
  const [saving, setSaving] = useState(false)

  // New/Edit item form
  const [formSku, setFormSku] = useState('')
  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formPrice, setFormPrice] = useState('')
  const [formCurrency, setFormCurrency] = useState<Currency>('ZAR')
  const [formDescription, setFormDescription] = useState('')
  const [formQuantity, setFormQuantity] = useState('')
  const [formReorderPoint, setFormReorderPoint] = useState('5')
  const [formImageUrl, setFormImageUrl] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  const fetchAll = useCallback(async () => {
    const [itemsRes, movementsRes, formulaRes] = await Promise.all([
      supabase.from('stock_items').select('*').order('name'),
      supabase.from('stock_movements').select('*, stock_items(name)').order('created_at', { ascending: false }).limit(100),
      supabase.from('formula').select('*').limit(1).single(),
    ])
    setItems(itemsRes.data || [])
    const mappedMovements = (movementsRes.data || []).map((m: { stock_items: { name: string } | null } & StockMovement) => ({
      ...m,
      stock_item_name: m.stock_items?.name || 'Unknown',
    }))
    setMovements(mappedMovements)
    if (formulaRes.data) setFormula(formulaRes.data)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Run migration on first load
  useEffect(() => {
    fetch('/api/migrate', { method: 'POST' }).catch(() => {})
  }, [])

  // Stats
  const stats = useMemo(() => {
    const totalItems = items.length
    const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0)
    const lowStock = items.filter(item => getStockStatus(item.quantity, item.reorder_point) === 'low_stock').length
    const outOfStock = items.filter(item => getStockStatus(item.quantity, item.reorder_point) === 'out_of_stock').length
    // Calculate total value - convert ZAR items to USD for comparison
    const totalValue = items.reduce((sum, item) => {
      const price = item.usd_price || 0
      const currency = item.currency || 'ZAR'
      // If ZAR, convert to USD for total (assuming ~18 exchange rate)
      const usdValue = currency === 'USD' ? price : price / 18
      return sum + (usdValue * item.quantity)
    }, 0)
    return { totalItems, totalQuantity, lowStock, outOfStock, totalValue }
  }, [items])

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const status = getStockStatus(item.quantity, item.reorder_point)
      if (filterStatus !== 'all' && status !== filterStatus) return false
      if (filterCategory !== 'all' && item.category !== filterCategory) return false
      if (filterText) {
        const search = filterText.toLowerCase()
        return item.sku?.toLowerCase().includes(search) ||
               item.name?.toLowerCase().includes(search) ||
               item.category?.toLowerCase().includes(search)
      }
      return true
    })
  }, [items, filterStatus, filterCategory, filterText])

  // Reset form
  const resetForm = () => {
    setFormSku('')
    setFormName('')
    setFormCategory('')
    setFormPrice('')
    setFormCurrency('ZAR')
    setFormDescription('')
    setFormQuantity('')
    setFormReorderPoint('5')
    setFormImageUrl('')
  }

  // Open add modal
  const openAddModal = () => {
    resetForm()
    setAddItemModalOpen(true)
  }

  // Open edit modal
  const openEditModal = (item: StockItem) => {
    setSelectedItem(item)
    setFormSku(item.sku || '')
    setFormName(item.name || '')
    setFormCategory(item.category || '')
    setFormPrice(item.usd_price?.toString() || '')
    setFormCurrency((item.currency as Currency) || 'ZAR')
    setFormDescription(item.description || '')
    setFormQuantity(item.quantity?.toString() || '0')
    setFormReorderPoint(item.reorder_point?.toString() || '5')
    setFormImageUrl(item.image_url || '')
    setEditModalOpen(true)
  }

  // Open adjustment modal
  const openAdjust = (item: StockItem) => {
    setSelectedItem(item)
    setAdjustType('add')
    setAdjustQuantity('')
    setAdjustReason('restock')
    setAdjustReference('')
    setAdjustModalOpen(true)
  }

  // Open history modal
  const openHistory = (item: StockItem) => {
    setSelectedItem(item)
    setHistoryModalOpen(true)
  }

  // Handle image upload via API route (uses service role key)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB')
      return
    }

    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setFormImageUrl(data.url)
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload image. Please try again or use a URL.')
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Submit adjustment
  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem || !adjustQuantity) return

    setSaving(true)
    const qty = parseInt(adjustQuantity)
    const change = adjustType === 'add' ? qty : -qty

    const { error: moveError } = await supabase.from('stock_movements').insert({
      stock_item_id: selectedItem.id,
      quantity_change: change,
      reason: adjustReason,
      reference: adjustReference || null,
    })

    if (moveError) {
      console.error('Error creating movement:', moveError)
      alert('Failed to record movement')
      setSaving(false)
      return
    }

    const newQuantity = Math.max(0, selectedItem.quantity + change)
    const updates: Partial<StockItem> = { quantity: newQuantity }
    
    if (adjustType === 'add' && adjustReason === 'restock') {
      updates.last_restocked_at = new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from('stock_items')
      .update(updates)
      .eq('id', selectedItem.id)

    setSaving(false)
    if (updateError) {
      console.error('Error updating stock:', updateError)
      alert('Failed to update stock')
      return
    }

    setAdjustModalOpen(false)
    fetchAll()
  }

  // Add new item
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName) return

    setSaving(true)
    // Build insert object
    const insertData: Record<string, unknown> = {
      sku: formSku || null,
      name: formName,
      category: formCategory || null,
      usd_price: formPrice ? parseFloat(formPrice) : null,
      description: formDescription || null,
      image_url: formImageUrl || null,
      quantity: parseInt(formQuantity) || 0,
      reorder_point: parseInt(formReorderPoint) || 5,
      active: true,
    }
    
    // Try with currency first, fallback without it if column doesn't exist
    let error = null
    const { error: err1 } = await supabase.from('stock_items').insert({ ...insertData, currency: formCurrency })
    if (err1?.message?.includes('currency')) {
      // Column doesn't exist, try without it
      const { error: err2 } = await supabase.from('stock_items').insert(insertData)
      error = err2
    } else {
      error = err1
    }

    setSaving(false)
    if (error) {
      console.error('Error adding item:', error)
      alert('Failed to add item')
      return
    }

    resetForm()
    setAddItemModalOpen(false)
    fetchAll()
  }

  // Delete item
  const handleDeleteItem = async (item: StockItem) => {
    if (!confirm(`Delete "${item.name}"? This permanently removes the product and cannot be undone.`)) return
    const { error } = await supabase.from('stock_items').delete().eq('id', item.id)
    if (error) {
      alert(`Could not delete product: ${error.message}`)
      return
    }
    fetchAll()
  }

  // Edit item
  const handleEditItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem || !formName) return

    setSaving(true)
    // Build update object
    const updateData: Record<string, unknown> = {
      sku: formSku || null,
      name: formName,
      category: formCategory || null,
      usd_price: formPrice ? parseFloat(formPrice) : null,
      description: formDescription || null,
      image_url: formImageUrl || null,
      reorder_point: parseInt(formReorderPoint) || 5,
    }
    
    // Try with currency first, fallback without it if column doesn't exist
    let error = null
    const { error: err1 } = await supabase.from('stock_items').update({ ...updateData, currency: formCurrency }).eq('id', selectedItem.id)
    if (err1?.message?.includes('currency')) {
      // Column doesn't exist, try without it
      const { error: err2 } = await supabase.from('stock_items').update(updateData).eq('id', selectedItem.id)
      error = err2
    } else {
      error = err1
    }

    setSaving(false)
    if (error) {
      console.error('Error updating item:', error)
      alert('Failed to update item')
      return
    }

    setEditModalOpen(false)
    fetchAll()
  }

  // Get movements for selected item
  const itemMovements = useMemo(() => {
    if (!selectedItem) return []
    return movements.filter(m => m.stock_item_id === selectedItem.id)
  }, [movements, selectedItem])

  // Image upload JSX - rendered inline to prevent focus loss
  const imageUploadField = (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">Product Image</label>
      <div className="space-y-2">
        {formImageUrl && (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={formImageUrl} 
              alt="Product preview" 
              className="w-24 h-24 object-cover rounded-lg border border-slate-200"
            />
            <button
              type="button"
              onClick={() => setFormImageUrl('')}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            ref={fileInputRef}
            className="hidden"
            id="image-upload"
          />
          <label
            htmlFor="image-upload"
            className={`flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition ${uploadingImage ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {uploadingImage ? (
              <>
                <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-slate-600">Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-600">Upload Image</span>
              </>
            )}
          </label>
          <span className="text-sm text-slate-400 self-center">or</span>
        </div>
        <input 
          type="url" 
          value={formImageUrl} 
          onChange={(e) => setFormImageUrl(e.target.value)} 
          placeholder="Paste image URL" 
          className="input"
        />
      </div>
    </div>
  )

  // Currency + Price field JSX - rendered inline to prevent focus loss
  const currencyPriceField = (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">Price</label>
      <div className="flex gap-2">
        <select 
          value={formCurrency} 
          onChange={(e) => setFormCurrency(e.target.value as Currency)}
          className="input w-24"
        >
          <option value="ZAR">R (ZAR)</option>
          <option value="USD">$ (USD)</option>
        </select>
        <input 
          type="number" 
          step="0.01" 
          min="0" 
          value={formPrice} 
          onChange={(e) => setFormPrice(e.target.value)} 
          placeholder="0.00" 
          className="input flex-1" 
        />
      </div>
      <p className="text-xs text-slate-500 mt-1">
        {formCurrency === 'USD' ? 'ZAR will be calculated using formula' : 'Price in South African Rand'}
      </p>
    </div>
  )

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
        <h1 className="text-2xl font-bold text-slate-900">Products</h1>
        <button onClick={openAddModal} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card-kpi gradient-blue">
          <div className="flex items-center gap-2 mb-2 text-white/80">
            <Package className="w-5 h-5" />
            <span className="text-sm font-medium">Products</span>
          </div>
          <div className="text-3xl font-bold">{stats.totalItems}</div>
        </div>

        <div className="card-kpi gradient-emerald">
          <div className="flex items-center gap-2 mb-2 text-white/80">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-medium">Total Units</span>
          </div>
          <div className="text-3xl font-bold">{stats.totalQuantity}</div>
        </div>

        <div className="card-kpi gradient-violet">
          <div className="flex items-center gap-2 mb-2 text-white/80">
            <DollarSign className="w-5 h-5" />
            <span className="text-sm font-medium">Stock Value</span>
          </div>
          <div className="text-2xl font-bold">{fmtCurrency(stats.totalValue, 'USD')}</div>
        </div>

        <div className="card-kpi gradient-amber">
          <div className="flex items-center gap-2 mb-2 text-white/80">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm font-medium">Low Stock</span>
          </div>
          <div className="text-3xl font-bold">{stats.lowStock}</div>
        </div>

        <div className={`card-kpi ${stats.outOfStock > 0 ? 'bg-gradient-to-br from-red-500 to-red-700' : 'gradient-slate'}`}>
          <div className="flex items-center gap-2 mb-2 text-white/80">
            <TrendingDown className="w-5 h-5" />
            <span className="text-sm font-medium">Out of Stock</span>
          </div>
          <div className="text-3xl font-bold">{stats.outOfStock}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 w-48"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">All Categories</option>
          {PRODUCT_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">All Status</option>
          <option value="in_stock">In Stock</option>
          <option value="low_stock">Low Stock</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>
      </div>

      {/* Products Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product Name</th>
                <th>Category</th>
                <th className="text-right">Price</th>
                <th className="text-right">ZAR (calc)</th>
                <th className="text-center">Qty</th>
                <th className="text-center">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => {
                const status = getStockStatus(item.quantity, item.reorder_point)
                const itemCurrency = (item.currency as Currency) || 'ZAR'
                const price = item.usd_price
                // Calculate ZAR only if price is in USD
                const zarPrice = itemCurrency === 'USD' && price ? calculateZarPrice(price, formula) : null
                return (
                  <tr key={item.id} className={status === 'out_of_stock' ? 'bg-red-50' : status === 'low_stock' ? 'bg-amber-50' : ''}>
                    <td className="font-mono text-sm text-slate-600">{item.sku || '—'}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        {item.image_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                            <Package className="w-5 h-5 text-slate-400" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-slate-900">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-slate-500 truncate max-w-[200px]">{item.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      {item.category && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryBadgeClass(item.category)}`}>
                          {item.category}
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <span className="font-medium">{price ? fmtCurrency(price, itemCurrency) : '—'}</span>
                      {itemCurrency === 'USD' && price && (
                        <span className="text-xs text-slate-400 ml-1">USD</span>
                      )}
                    </td>
                    <td className="text-right font-medium text-teal-600">
                      {itemCurrency === 'USD' && zarPrice ? fmtCurrency(zarPrice, 'ZAR') : 
                       itemCurrency === 'ZAR' && price ? <span className="text-slate-400 text-sm">—</span> : '—'}
                    </td>
                    <td className="text-center">
                      <span className={`font-bold text-lg ${
                        status === 'out_of_stock' ? 'text-red-600' :
                        status === 'low_stock' ? 'text-amber-600' :
                        'text-emerald-600'
                      }`}>
                        {item.quantity}
                      </span>
                    </td>
                    <td className="text-center">{getStatusBadge(status)}</td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
                          title="Edit product"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openHistory(item)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
                          title="View history"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openAdjust(item)}
                          className="p-1.5 hover:bg-teal-100 rounded-lg text-teal-600 hover:text-teal-700"
                          title="Adjust stock"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item)}
                          className="p-1.5 hover:bg-red-100 rounded-lg text-slate-400 hover:text-red-600"
                          title="Delete product"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    No products found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Movements */}
      {movements.length > 0 && (
        <div className="card">
          <h2 className="font-bold text-slate-900 text-lg mb-4">Recent Stock Movements</h2>
          <div className="space-y-2">
            {movements.slice(0, 10).map(movement => (
              <div key={movement.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    movement.quantity_change > 0 ? 'bg-emerald-100' : 'bg-red-100'
                  }`}>
                    {movement.quantity_change > 0 
                      ? <Plus className="w-5 h-5 text-emerald-600" />
                      : <Minus className="w-5 h-5 text-red-600" />
                    }
                  </div>
                  <div>
                    <div className="font-medium text-slate-800">{movement.stock_item_name}</div>
                    <div className="text-sm text-slate-500">{movement.reason} {movement.reference && `• ${movement.reference}`}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${movement.quantity_change > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {movement.quantity_change > 0 ? '+' : ''}{movement.quantity_change}
                  </div>
                  <div className="text-sm text-slate-500">
                    {new Date(movement.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      <Modal open={adjustModalOpen} onClose={() => setAdjustModalOpen(false)} title="Adjust Stock">
        {selectedItem && (
          <form onSubmit={handleAdjust} className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="font-medium text-slate-800">{selectedItem.name}</div>
              {selectedItem.sku && <div className="text-sm text-slate-500">SKU: {selectedItem.sku}</div>}
              <div className="mt-2 flex items-center gap-4">
                <span className="text-sm text-slate-500">Current:</span>
                <span className="font-bold text-lg">{selectedItem.quantity}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Adjustment Type</label>
              <div className="flex rounded-xl overflow-hidden border border-slate-300">
                <button
                  type="button"
                  onClick={() => setAdjustType('add')}
                  className={`flex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition ${
                    adjustType === 'add' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600'
                  }`}
                >
                  <Plus className="w-4 h-4" /> Add Stock
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('remove')}
                  className={`flex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition ${
                    adjustType === 'remove' ? 'bg-red-600 text-white' : 'bg-white text-slate-600'
                  }`}
                >
                  <Minus className="w-4 h-4" /> Remove Stock
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                value={adjustQuantity}
                onChange={(e) => setAdjustQuantity(e.target.value)}
                placeholder="Enter quantity"
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
              <select value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} className="input">
                {ADJUSTMENT_REASONS.map(r => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reference (optional)</label>
              <input
                type="text"
                value={adjustReference}
                onChange={(e) => setAdjustReference(e.target.value)}
                placeholder="e.g. Order #, PO #, note"
                className="input"
              />
            </div>

            <div className="bg-slate-100 rounded-xl p-4 flex items-center justify-between">
              <span className="text-slate-600">New quantity:</span>
              <span className="font-bold text-xl">
                {Math.max(0, selectedItem.quantity + (adjustType === 'add' ? 1 : -1) * (parseInt(adjustQuantity) || 0))}
              </span>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setAdjustModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Add Product Modal */}
      <Modal open={addItemModalOpen} onClose={() => setAddItemModalOpen(false)} title="Add Product">
        <form onSubmit={handleAddItem} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">SKU (optional)</label>
              <input type="text" value={formSku} onChange={(e) => setFormSku(e.target.value)} placeholder="e.g. LW-001" className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="input">
                <option value="">Select category...</option>
                {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Product Name *</label>
            <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Enter product name" className="input" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Product description" className="input" rows={2} />
          </div>

          {currencyPriceField}

          {imageUploadField}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Initial Quantity</label>
              <input type="number" min="0" value={formQuantity} onChange={(e) => setFormQuantity(e.target.value)} placeholder="0" className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reorder Point</label>
              <input type="number" min="0" value={formReorderPoint} onChange={(e) => setFormReorderPoint(e.target.value)} placeholder="5" className="input" />
              <p className="text-xs text-slate-500 mt-1">Alert when stock falls below</p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setAddItemModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving || uploadingImage} className="btn-primary flex-1">
              {saving ? 'Saving...' : 'Add Product'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Product Modal */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Product">
        <form onSubmit={handleEditItem} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">SKU</label>
              <input type="text" value={formSku} onChange={(e) => setFormSku(e.target.value)} placeholder="e.g. LW-001" className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="input">
                <option value="">Select category...</option>
                {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Product Name *</label>
            <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Enter product name" className="input" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Product description" className="input" rows={2} />
          </div>

          {currencyPriceField}

          {imageUploadField}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reorder Point</label>
            <input type="number" min="0" value={formReorderPoint} onChange={(e) => setFormReorderPoint(e.target.value)} placeholder="5" className="input" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setEditModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving || uploadingImage} className="btn-primary flex-1">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* History Modal */}
      <Modal open={historyModalOpen} onClose={() => setHistoryModalOpen(false)} title={`Stock History: ${selectedItem?.name || ''}`}>
        {selectedItem && (
          <div className="space-y-3">
            {itemMovements.length === 0 ? (
              <div className="text-center py-8 text-slate-400">No movements recorded</div>
            ) : (
              itemMovements.map(movement => (
                <div key={movement.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      movement.quantity_change > 0 ? 'bg-emerald-100' : 'bg-red-100'
                    }`}>
                      {movement.quantity_change > 0 
                        ? <Plus className="w-4 h-4 text-emerald-600" />
                        : <Minus className="w-4 h-4 text-red-600" />
                      }
                    </div>
                    <div>
                      <div className="font-medium text-slate-800 capitalize">{movement.reason}</div>
                      {movement.reference && <div className="text-sm text-slate-500">{movement.reference}</div>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${movement.quantity_change > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {movement.quantity_change > 0 ? '+' : ''}{movement.quantity_change}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(movement.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
