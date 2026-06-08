'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { OrderWithShipping, ShipmentStatus, Client, Quote } from '@/lib/types'
import { Package, Ship, Truck, CheckCircle, Clock, MapPin, X, Search, Edit2, Plus, Receipt, ClipboardList, Trash2 } from 'lucide-react'

const SHIPMENT_STAGES: { key: ShipmentStatus; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'pending', label: 'Pending', icon: Clock, color: 'bg-slate-400' },
  { key: 'order_placed', label: 'Order Placed', icon: Package, color: 'bg-blue-500' },
  { key: 'china_confirmed', label: 'China Confirmed', icon: CheckCircle, color: 'bg-indigo-500' },
  { key: 'in_production', label: 'In Production', icon: Package, color: 'bg-purple-500' },
  { key: 'shipped', label: 'Shipped', icon: Ship, color: 'bg-cyan-500' },
  { key: 'in_transit', label: 'In Transit', icon: Truck, color: 'bg-amber-500' },
  { key: 'customs', label: 'Customs', icon: MapPin, color: 'bg-orange-500' },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle, color: 'bg-emerald-500' },
]

function formatCurrency(val: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(val || 0)
}

function getStageIndex(status: ShipmentStatus | undefined): number {
  if (!status) return 0
  return SHIPMENT_STAGES.findIndex(s => s.key === status)
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

// Shipment Timeline Component
function ShipmentTimeline({ status }: { status: ShipmentStatus | undefined }) {
  const currentIndex = getStageIndex(status)
  
  return (
    <div className="flex items-center gap-1 w-full">
      {SHIPMENT_STAGES.map((stage, index) => {
        const isCompleted = index <= currentIndex
        const isCurrent = index === currentIndex
        const Icon = stage.icon
        
        return (
          <div key={stage.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div 
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  isCompleted ? stage.color : 'bg-slate-200'
                } ${isCurrent ? 'ring-2 ring-offset-2 ring-slate-300' : ''}`}
              >
                <Icon className={`w-3.5 h-3.5 ${isCompleted ? 'text-white' : 'text-slate-400'}`} />
              </div>
              <span className={`text-[9px] mt-1 text-center leading-tight ${
                isCompleted ? 'text-slate-700 font-medium' : 'text-slate-400'
              }`}>
                {stage.label}
              </span>
            </div>
            {index < SHIPMENT_STAGES.length - 1 && (
              <div className={`h-0.5 flex-1 -mt-4 ${index < currentIndex ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// Generate order number
async function generateOrderNumber(supabase: ReturnType<typeof createClient>): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2)
  const prefix = `ORD${year}`
  
  // Get highest existing order number for this year
  const { data } = await supabase
    .from('orders')
    .select('order_number')
    .like('order_number', `${prefix}%`)
    .order('order_number', { ascending: false })
    .limit(1)
  
  let sequence = 1
  if (data && data.length > 0) {
    const lastNum = data[0].order_number
    const lastSeq = parseInt(lastNum.slice(-4), 10)
    if (!isNaN(lastSeq)) {
      sequence = lastSeq + 1
    }
  }
  
  return `${prefix}${sequence.toString().padStart(4, '0')}`
}

// Create Order Modal Component
function CreateOrderModal({ 
  open, 
  onClose, 
  onSuccess 
}: { 
  open: boolean; 
  onClose: () => void; 
  onSuccess: () => void 
}) {
  const supabase = createClient()
  const [clients, setClients] = useState<Client[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  // Form state
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [clientName, setClientName] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0])
  const [totalAmount, setTotalAmount] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [linkedQuoteId, setLinkedQuoteId] = useState<string>('')
  const [chinaOrderNumber, setChinaOrderNumber] = useState('')
  const [previewOrderNumber, setPreviewOrderNumber] = useState('')

  // Fetch clients and quotes on open
  useEffect(() => {
    if (open) {
      setLoading(true)
      Promise.all([
        supabase.from('clients').select('*').order('name'),
        supabase.from('quotes').select('*').eq('status', 'accepted').order('created_at', { ascending: false }),
        generateOrderNumber(supabase)
      ]).then(([clientsRes, quotesRes, orderNum]) => {
        setClients(clientsRes.data || [])
        setQuotes(quotesRes.data || [])
        setPreviewOrderNumber(orderNum)
        setLoading(false)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Filter clients for dropdown
  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients.slice(0, 10)
    return clients.filter(c => 
      c.name.toLowerCase().includes(clientSearch.toLowerCase())
    ).slice(0, 10)
  }, [clients, clientSearch])

  // Select client from dropdown
  const selectClient = (client: Client) => {
    setSelectedClientId(client.id)
    setClientName(client.name)
    setClientSearch(client.name)
    setShowClientDropdown(false)
  }

  // Clear selection
  const clearClient = () => {
    setSelectedClientId('')
    setClientName('')
    setClientSearch('')
  }

  // Select quote and auto-fill
  const selectQuote = (quoteId: string) => {
    setLinkedQuoteId(quoteId)
    if (quoteId) {
      const quote = quotes.find(q => q.id === quoteId)
      if (quote) {
        setClientName(quote.client_name)
        setSelectedClientId(quote.client_id || '')
        setClientSearch(quote.client_name)
        // Calculate total from line items
        const total = quote.line_items?.reduce((sum, item) => 
          sum + (item.qty * item.unitPrice), 0) || 0
        setTotalAmount(total.toString())
      }
    }
  }

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (!clientName.trim()) {
      newErrors.clientName = 'Client name is required'
    }
    
    const amount = parseFloat(totalAmount)
    if (!totalAmount || isNaN(amount) || amount <= 0) {
      newErrors.totalAmount = 'Total amount must be a positive number'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Submit
  const handleSubmit = async () => {
    if (!validate()) return
    
    setSaving(true)
    
    // Generate final order number
    const orderNumber = await generateOrderNumber(supabase)
    
    const { error } = await supabase.from('orders').insert({
      order_number: orderNumber,
      client_id: selectedClientId || null,
      client_name: clientName.trim(),
      order_date: orderDate,
      value_zar: parseFloat(totalAmount),
      quote_id: linkedQuoteId || null,
      po_number: poNumber.trim() || null,
      notes: notes.trim() || null,
      china_order_number: chinaOrderNumber.trim() || null,
      status: 'pending',
      shipment_status: 'pending',
      created_at: new Date().toISOString(),
    })
    
    setSaving(false)
    
    if (error) {
      console.error('Error creating order:', error)
      setErrors({ submit: 'Failed to create order. Please try again.' })
      return
    }
    
    // Reset form
    setSelectedClientId('')
    setClientName('')
    setClientSearch('')
    setOrderDate(new Date().toISOString().split('T')[0])
    setTotalAmount('')
    setPoNumber('')
    setNotes('')
    setLinkedQuoteId('')
    setChinaOrderNumber('')
    setErrors({})
    
    onSuccess()
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">New Order</h2>
            <p className="text-sm text-slate-500 font-mono">{previewOrderNumber}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)] space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Link to Quote (optional) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Link to Quote <span className="text-slate-400">(optional)</span>
                </label>
                <select
                  value={linkedQuoteId}
                  onChange={(e) => selectQuote(e.target.value)}
                  className="input"
                >
                  <option value="">— No quote linked —</option>
                  {quotes.map(q => (
                    <option key={q.id} value={q.id}>
                      {q.quote_number} - {q.client_name} ({formatCurrency(
                        q.line_items?.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0) || 0
                      )})
                    </option>
                  ))}
                </select>
              </div>

              {/* Client Selection */}
              <div className="relative">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Client <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value)
                      setClientName(e.target.value)
                      setSelectedClientId('')
                      setShowClientDropdown(true)
                    }}
                    onFocus={() => setShowClientDropdown(true)}
                    placeholder="Search or enter client name..."
                    className={`input pr-8 ${errors.clientName ? 'border-red-500 focus:ring-red-500' : ''}`}
                  />
                  {selectedClientId && (
                    <button 
                      onClick={clearClient}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded"
                    >
                      <X className="w-4 h-4 text-slate-400" />
                    </button>
                  )}
                </div>
                {showClientDropdown && filteredClients.length > 0 && !selectedClientId && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredClients.map(client => (
                      <button
                        key={client.id}
                        onClick={() => selectClient(client)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                      >
                        <span className="font-medium">{client.name}</span>
                        {client.contact_person && (
                          <span className="text-slate-400 ml-2">({client.contact_person})</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {errors.clientName && (
                  <p className="text-red-500 text-xs mt-1">{errors.clientName}</p>
                )}
              </div>

              {/* Order Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Order Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="input"
                />
              </div>

              {/* Total Amount */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Total Amount (ZAR) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">R</span>
                  <input
                    type="number"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className={`input pl-8 ${errors.totalAmount ? 'border-red-500 focus:ring-red-500' : ''}`}
                  />
                </div>
                {errors.totalAmount && (
                  <p className="text-red-500 text-xs mt-1">{errors.totalAmount}</p>
                )}
              </div>

              {/* PO Number */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Reference / PO Number <span className="text-slate-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  placeholder="Client's PO number"
                  className="input"
                />
              </div>

              {/* China Order Number */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  China Order Number <span className="text-slate-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={chinaOrderNumber}
                  onChange={(e) => setChinaOrderNumber(e.target.value)}
                  placeholder="e.g. CN-2025-12345"
                  className="input"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notes <span className="text-slate-400">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  rows={3}
                  className="input resize-none"
                />
              </div>

              {errors.submit && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                  {errors.submit}
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button 
            onClick={handleSubmit} 
            disabled={saving || loading}
            className="btn-primary flex-1"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Create Order
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderWithShipping[]>([])
  const [loading, setLoading] = useState(true)
  const [filterText, setFilterText] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  
  // Detail/Edit modal
  const [selectedOrder, setSelectedOrder] = useState<OrderWithShipping | null>(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<OrderWithShipping>>({})
  const [saving, setSaving] = useState(false)
  
  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false)

  const supabase = createClient()

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (filterStatus !== 'all') {
        const shipmentStatus = order.shipment_status || 'pending'
        if (filterStatus !== shipmentStatus) return false
      }
      if (filterText) {
        const search = filterText.toLowerCase()
        return order.order_number?.toLowerCase().includes(search) ||
               order.client_name?.toLowerCase().includes(search) ||
               order.china_order_number?.toLowerCase().includes(search)
      }
      return true
    })
  }, [orders, filterStatus, filterText])

  // Group by shipment status
  const ordersByStatus = useMemo(() => {
    const groups: Record<string, OrderWithShipping[]> = {}
    SHIPMENT_STAGES.forEach(stage => {
      groups[stage.key] = []
    })
    
    filteredOrders.forEach(order => {
      const status = order.shipment_status || 'pending'
      if (groups[status]) {
        groups[status].push(order)
      }
    })
    
    return groups
  }, [filteredOrders])

  // Open detail modal
  const openDetail = (order: OrderWithShipping) => {
    setSelectedOrder(order)
    setEditForm({
      china_order_number: order.china_order_number || '',
      shipment_status: order.shipment_status || 'pending',
      ship_date: order.ship_date || '',
      eta: order.eta || '',
      tracking_number: order.tracking_number || '',
      vessel_flight: order.vessel_flight || '',
      customs_cleared_date: order.customs_cleared_date || '',
    })
    setEditing(false)
  }

  const closeDetail = () => {
    setSelectedOrder(null)
    setEditing(false)
  }

  // Save shipment details
  const saveShipment = async () => {
    if (!selectedOrder) return
    setSaving(true)

    const { error } = await supabase
      .from('orders')
      .update({
        china_order_number: editForm.china_order_number || null,
        shipment_status: editForm.shipment_status || 'pending',
        ship_date: editForm.ship_date || null,
        eta: editForm.eta || null,
        tracking_number: editForm.tracking_number || null,
        vessel_flight: editForm.vessel_flight || null,
        customs_cleared_date: editForm.customs_cleared_date || null,
      })
      .eq('id', selectedOrder.id)

    setSaving(false)
    if (error) {
      console.error('Error updating shipment:', error)
      alert('Failed to update shipment details')
      return
    }

    setEditing(false)
    closeDetail()
    fetchOrders()
  }

  // Quick status update
  const updateStatus = async (orderId: string, newStatus: ShipmentStatus) => {
    const updates: Partial<OrderWithShipping> = { shipment_status: newStatus }
    
    // Auto-set dates based on status
    const today = new Date().toISOString().split('T')[0]
    if (newStatus === 'shipped' && !orders.find(o => o.id === orderId)?.ship_date) {
      updates.ship_date = today
    }
    if (newStatus === 'customs') {
      updates.customs_cleared_date = today
    }

    await supabase.from('orders').update(updates).eq('id', orderId)
    fetchOrders()
  }

  // Delete order
  const deleteOrder = async (orderId: string, orderNumber: string) => {
    if (!confirm(`Are you sure you want to delete order ${orderNumber}? This action cannot be undone.`)) {
      return
    }
    
    const { error } = await supabase.from('orders').delete().eq('id', orderId)
    
    if (error) {
      console.error('Error deleting order:', error)
      alert('Failed to delete order. Please try again.')
      return
    }
    
    closeDetail()
    fetchOrders()
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
        <h1 className="text-2xl font-bold text-slate-900">Orders & Shipping</h1>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          New Order
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
        {SHIPMENT_STAGES.map(stage => {
          const count = ordersByStatus[stage.key]?.length || 0
          return (
            <div 
              key={stage.key}
              onClick={() => setFilterStatus(filterStatus === stage.key ? 'all' : stage.key)}
              className={`rounded-xl p-3 cursor-pointer transition-all ${
                filterStatus === stage.key 
                  ? `${stage.color} text-white shadow-lg scale-105` 
                  : 'bg-white border border-slate-200 hover:border-slate-300'
              }`}
            >
              <stage.icon className={`w-5 h-5 mb-1 ${filterStatus === stage.key ? 'text-white' : 'text-slate-400'}`} />
              <div className={`text-xl font-bold ${filterStatus === stage.key ? 'text-white' : 'text-slate-900'}`}>{count}</div>
              <div className={`text-[10px] leading-tight ${filterStatus === stage.key ? 'text-white/80' : 'text-slate-500'}`}>{stage.label}</div>
            </div>
          )
        })}
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
        {filterStatus !== 'all' && (
          <button 
            onClick={() => setFilterStatus('all')}
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            <X className="w-4 h-4" /> Clear filter
          </button>
        )}
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.map(order => (
          <div 
            key={order.id}
            className="card hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => openDetail(order)}
          >
            {/* Order Header */}
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900">{order.order_number}</span>
                  {order.china_order_number && (
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                      CN: {order.china_order_number}
                    </span>
                  )}
                </div>
                <div className="text-slate-600 font-medium">{order.client_name}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg text-slate-900">{formatCurrency(order.value_zar)}</div>
                <div className="text-sm text-slate-500">{new Date(order.created_at).toLocaleDateString()}</div>
              </div>
            </div>

            {/* Shipment Timeline */}
            <ShipmentTimeline status={order.shipment_status as ShipmentStatus} />

            {/* Quick Info */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-4 text-sm">
              {order.ship_date && (
                <div className="flex items-center gap-1.5">
                  <Ship className="w-4 h-4 text-cyan-500" />
                  <span className="text-slate-600">Shipped: {order.ship_date}</span>
                </div>
              )}
              {order.eta && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span className="text-slate-600">ETA: {order.eta}</span>
                </div>
              )}
              {order.tracking_number && (
                <div className="flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-purple-500" />
                  <span className="text-slate-600">Track: {order.tracking_number}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {filteredOrders.length === 0 && (
          <div className="card text-center py-12">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No orders found</p>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1 mx-auto"
            >
              <Plus className="w-4 h-4" /> Create your first order
            </button>
          </div>
        )}
      </div>

      {/* Create Order Modal */}
      <CreateOrderModal 
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchOrders}
      />

      {/* Order Detail Modal */}
      <Modal 
        open={!!selectedOrder} 
        onClose={closeDetail} 
        title={editing ? 'Edit Shipment Details' : `Order ${selectedOrder?.order_number}`}
      >
        {selectedOrder && (
          <div className="space-y-4">
            {!editing ? (
              /* VIEW MODE */
              <>
                {/* Order Info */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-500">Client:</span>
                      <span className="ml-2 font-medium text-slate-900">{selectedOrder.client_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Total:</span>
                      <span className="ml-2 font-bold text-slate-900">{formatCurrency(selectedOrder.value_zar)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Created:</span>
                      <span className="ml-2 text-slate-700">{new Date(selectedOrder.created_at).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Order Status:</span>
                      <span className="ml-2 badge badge-default">{selectedOrder.status}</span>
                    </div>
                  </div>
                </div>

                {/* Shipment Timeline */}
                <div className="py-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Shipment Progress</h3>
                  <ShipmentTimeline status={selectedOrder.shipment_status as ShipmentStatus} />
                </div>

                {/* Shipment Details */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700">Shipment Details</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-slate-500 text-xs mb-1">China Order #</div>
                      <div className="font-medium">{selectedOrder.china_order_number || '—'}</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-slate-500 text-xs mb-1">Ship Date</div>
                      <div className="font-medium">{selectedOrder.ship_date || '—'}</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-slate-500 text-xs mb-1">ETA</div>
                      <div className="font-medium">{selectedOrder.eta || '—'}</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-slate-500 text-xs mb-1">Tracking #</div>
                      <div className="font-medium">{selectedOrder.tracking_number || '—'}</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-slate-500 text-xs mb-1">Vessel/Flight</div>
                      <div className="font-medium">{selectedOrder.vessel_flight || '—'}</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-slate-500 text-xs mb-1">Customs Cleared</div>
                      <div className="font-medium">{selectedOrder.customs_cleared_date || '—'}</div>
                    </div>
                  </div>
                </div>

                {/* Quick Status Update */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Quick Status Update</h3>
                  <div className="flex flex-wrap gap-2">
                    {SHIPMENT_STAGES.map(stage => {
                      const isCurrent = (selectedOrder.shipment_status || 'pending') === stage.key
                      return (
                        <button
                          key={stage.key}
                          onClick={() => { 
                            updateStatus(selectedOrder.id, stage.key)
                            setSelectedOrder({ ...selectedOrder, shipment_status: stage.key })
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            isCurrent 
                              ? `${stage.color} text-white` 
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {stage.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="pt-4 flex flex-wrap gap-3">
                  <button onClick={closeDetail} className="btn-secondary flex-1">Close</button>
                  <a
                    href={`/invoices?order=${selectedOrder.id}`}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                    onClick={closeDetail}
                  >
                    <Receipt className="w-4 h-4" /> Create Invoice
                  </a>
                  <a
                    href={`/purchase-orders?fromOrder=${selectedOrder.id}`}
                    className="btn-secondary flex-1 flex items-center justify-center gap-2"
                    onClick={closeDetail}
                  >
                    <ClipboardList className="w-4 h-4" /> Generate PO
                  </a>
                  <button onClick={() => setEditing(true)} className="btn-secondary flex-1">
                    <Edit2 className="w-4 h-4" /> Edit Details
                  </button>
                  <button 
                    onClick={() => deleteOrder(selectedOrder.id, selectedOrder.order_number)}
                    className="flex items-center justify-center gap-2 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50 border border-red-200"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </>
            ) : (
              /* EDIT MODE */
              <>
                <div className="space-y-4">
                  {/* Shipment Status */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Shipment Status</label>
                    <select
                      value={editForm.shipment_status || 'pending'}
                      onChange={(e) => setEditForm({ ...editForm, shipment_status: e.target.value as ShipmentStatus })}
                      className="input"
                    >
                      {SHIPMENT_STAGES.map(stage => (
                        <option key={stage.key} value={stage.key}>{stage.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* China Order Number */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">China Order Number</label>
                    <input
                      type="text"
                      value={editForm.china_order_number || ''}
                      onChange={(e) => setEditForm({ ...editForm, china_order_number: e.target.value })}
                      placeholder="e.g. CN-2024-12345"
                      className="input"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Ship Date */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Ship Date</label>
                      <input
                        type="date"
                        value={editForm.ship_date || ''}
                        onChange={(e) => setEditForm({ ...editForm, ship_date: e.target.value })}
                        className="input"
                      />
                    </div>

                    {/* ETA */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">ETA</label>
                      <input
                        type="date"
                        value={editForm.eta || ''}
                        onChange={(e) => setEditForm({ ...editForm, eta: e.target.value })}
                        className="input"
                      />
                    </div>
                  </div>

                  {/* Tracking Number */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tracking Number</label>
                    <input
                      type="text"
                      value={editForm.tracking_number || ''}
                      onChange={(e) => setEditForm({ ...editForm, tracking_number: e.target.value })}
                      placeholder="Enter tracking number"
                      className="input"
                    />
                  </div>

                  {/* Vessel/Flight */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Vessel / Flight</label>
                    <input
                      type="text"
                      value={editForm.vessel_flight || ''}
                      onChange={(e) => setEditForm({ ...editForm, vessel_flight: e.target.value })}
                      placeholder="e.g. MSC Barcelona / CX789"
                      className="input"
                    />
                  </div>

                  {/* Customs Cleared */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Customs Cleared Date</label>
                    <input
                      type="date"
                      value={editForm.customs_cleared_date || ''}
                      onChange={(e) => setEditForm({ ...editForm, customs_cleared_date: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button onClick={() => setEditing(false)} className="btn-secondary flex-1">Cancel</button>
                  <button onClick={saveShipment} disabled={saving} className="btn-primary flex-1">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
