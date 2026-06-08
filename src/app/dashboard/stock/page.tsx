'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { StockItem, StockMovement } from '@/lib/types'
import { Package, Plus, Minus, AlertTriangle, TrendingUp, TrendingDown, X, Search, History, RefreshCw } from 'lucide-react'

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

export default function StockPage() {
  const [items, setItems] = useState<StockItem[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [filterText, setFilterText] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all')

  // Modal states
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [addItemModalOpen, setAddItemModalOpen] = useState(false)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)

  // Adjustment form
  const [adjustType, setAdjustType] = useState<'add' | 'remove'>('add')
  const [adjustQuantity, setAdjustQuantity] = useState('')
  const [adjustReason, setAdjustReason] = useState('restock')
  const [adjustReference, setAdjustReference] = useState('')
  const [saving, setSaving] = useState(false)

  // New item form
  const [newItemSku, setNewItemSku] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newItemQuantity, setNewItemQuantity] = useState('')
  const [newItemReorderPoint, setNewItemReorderPoint] = useState('5')

  const supabase = createClient()

  const fetchAll = useCallback(async () => {
    const [itemsRes, movementsRes] = await Promise.all([
      supabase.from('stock_items').select('*').order('name'),
      supabase.from('stock_movements').select('*, stock_items(name)').order('created_at', { ascending: false }).limit(100),
    ])
    setItems(itemsRes.data || [])
    // Map movements with item name
    const mappedMovements = (movementsRes.data || []).map((m: { stock_items: { name: string } | null } & StockMovement) => ({
      ...m,
      stock_item_name: m.stock_items?.name || 'Unknown',
    }))
    setMovements(mappedMovements)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Stats
  const stats = useMemo(() => {
    const totalItems = items.length
    const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0)
    const lowStock = items.filter(item => getStockStatus(item.quantity, item.reorder_point) === 'low_stock').length
    const outOfStock = items.filter(item => getStockStatus(item.quantity, item.reorder_point) === 'out_of_stock').length
    return { totalItems, totalQuantity, lowStock, outOfStock }
  }, [items])

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const status = getStockStatus(item.quantity, item.reorder_point)
      if (filterStatus !== 'all' && status !== filterStatus) return false
      if (filterText) {
        const search = filterText.toLowerCase()
        return item.sku?.toLowerCase().includes(search) ||
               item.name?.toLowerCase().includes(search)
      }
      return true
    })
  }, [items, filterStatus, filterText])

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

  // Submit adjustment
  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem || !adjustQuantity) return

    setSaving(true)
    const qty = parseInt(adjustQuantity)
    const change = adjustType === 'add' ? qty : -qty

    // Create movement record
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

    // Update stock item quantity
    const newQuantity = Math.max(0, selectedItem.quantity + change)
    const updates: Partial<StockItem> = { quantity: newQuantity }
    
    // If restocking, update last_restocked_at
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
    if (!newItemName) return

    setSaving(true)
    const { error } = await supabase.from('stock_items').insert({
      sku: newItemSku || null,
      name: newItemName,
      quantity: parseInt(newItemQuantity) || 0,
      reorder_point: parseInt(newItemReorderPoint) || 5,
    })

    setSaving(false)
    if (error) {
      console.error('Error adding item:', error)
      alert('Failed to add item')
      return
    }

    setNewItemSku('')
    setNewItemName('')
    setNewItemQuantity('')
    setNewItemReorderPoint('5')
    setAddItemModalOpen(false)
    fetchAll()
  }

  // Get movements for selected item
  const itemMovements = useMemo(() => {
    if (!selectedItem) return []
    return movements.filter(m => m.stock_item_id === selectedItem.id)
  }, [movements, selectedItem])

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
        <h1 className="text-2xl font-bold text-slate-900">Stock Management</h1>
        <button onClick={() => setAddItemModalOpen(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-kpi gradient-blue">
          <div className="flex items-center gap-2 mb-2 text-white/80">
            <Package className="w-5 h-5" />
            <span className="text-sm font-medium">Total Items</span>
          </div>
          <div className="text-3xl font-bold">{stats.totalItems}</div>
        </div>

        <div className="card-kpi gradient-emerald">
          <div className="flex items-center gap-2 mb-2 text-white/80">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-medium">Total Quantity</span>
          </div>
          <div className="text-3xl font-bold">{stats.totalQuantity}</div>
        </div>

        <div className="card-kpi gradient-amber">
          <div className="flex items-center gap-2 mb-2 text-white/80">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm font-medium">Low Stock</span>
          </div>
          <div className="text-3xl font-bold">{stats.lowStock}</div>
        </div>

        <div className={`card-kpi ${stats.outOfStock > 0 ? 'bg-gradient-to-br from-red-500 to-red-700' : 'gradient-violet'}`}>
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
            placeholder="Search items..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 w-48"
          />
        </div>
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

      {/* Stock Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product Name</th>
                <th className="text-center">Quantity</th>
                <th className="text-center">Reorder Point</th>
                <th className="text-center">Status</th>
                <th>Last Restocked</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => {
                const status = getStockStatus(item.quantity, item.reorder_point)
                return (
                  <tr key={item.id} className={status === 'out_of_stock' ? 'bg-red-50' : status === 'low_stock' ? 'bg-amber-50' : ''}>
                    <td className="font-mono text-sm text-slate-600">{item.sku || '—'}</td>
                    <td className="font-medium text-slate-900">{item.name}</td>
                    <td className="text-center">
                      <span className={`font-bold text-lg ${
                        status === 'out_of_stock' ? 'text-red-600' :
                        status === 'low_stock' ? 'text-amber-600' :
                        'text-emerald-600'
                      }`}>
                        {item.quantity}
                      </span>
                    </td>
                    <td className="text-center text-slate-500">{item.reorder_point}</td>
                    <td className="text-center">{getStatusBadge(status)}</td>
                    <td className="text-sm text-slate-500">
                      {item.last_restocked_at 
                        ? new Date(item.last_restocked_at).toLocaleDateString() 
                        : '—'}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
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
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    No items found
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
            {/* Item info */}
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="font-medium text-slate-800">{selectedItem.name}</div>
              {selectedItem.sku && <div className="text-sm text-slate-500">SKU: {selectedItem.sku}</div>}
              <div className="mt-2 flex items-center gap-4">
                <span className="text-sm text-slate-500">Current:</span>
                <span className="font-bold text-lg">{selectedItem.quantity}</span>
              </div>
            </div>

            {/* Adjustment Type */}
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

            {/* Quantity */}
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

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
              <select
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="input"
              >
                {ADJUSTMENT_REASONS.map(r => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Reference */}
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

            {/* Preview */}
            <div className="bg-slate-100 rounded-xl p-4 flex items-center justify-between">
              <span className="text-slate-600">New quantity:</span>
              <span className="font-bold text-xl">
                {Math.max(0, selectedItem.quantity + (adjustType === 'add' ? 1 : -1) * (parseInt(adjustQuantity) || 0))}
              </span>
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setAdjustModalOpen(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving...' : 'Confirm Adjustment'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Add Item Modal */}
      <Modal open={addItemModalOpen} onClose={() => setAddItemModalOpen(false)} title="Add Stock Item">
        <form onSubmit={handleAddItem} className="space-y-4">
          {/* SKU */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">SKU (optional)</label>
            <input
              type="text"
              value={newItemSku}
              onChange={(e) => setNewItemSku(e.target.value)}
              placeholder="e.g. LAB-001"
              className="input"
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Product Name</label>
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Enter product name"
              className="input"
              required
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Initial Quantity</label>
            <input
              type="number"
              min="0"
              value={newItemQuantity}
              onChange={(e) => setNewItemQuantity(e.target.value)}
              placeholder="0"
              className="input"
            />
          </div>

          {/* Reorder Point */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reorder Point</label>
            <input
              type="number"
              min="0"
              value={newItemReorderPoint}
              onChange={(e) => setNewItemReorderPoint(e.target.value)}
              placeholder="5"
              className="input"
            />
            <p className="text-xs text-slate-500 mt-1">Alert when stock falls below this level</p>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setAddItemModalOpen(false)} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : 'Add Item'}
            </button>
          </div>
        </form>
      </Modal>

      {/* History Modal */}
      <Modal open={historyModalOpen} onClose={() => setHistoryModalOpen(false)} title={`Stock History: ${selectedItem?.name || ''}`}>
        {selectedItem && (
          <div className="space-y-3">
            {itemMovements.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                No movements recorded
              </div>
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
