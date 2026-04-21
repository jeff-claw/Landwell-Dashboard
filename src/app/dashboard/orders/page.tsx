'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { formatZAR, formatUSD, ORDER_STATUSES } from '@/lib/utils'

type Order = {
  id: string
  order_number: string
  client_name: string
  china_order_number: string | null
  status: string
  value_usd: number
  value_zar: number
  deposit_paid: boolean
  shipment_status: string
  eta: string | null
  tracking_number: string | null
  vessel_flight: string | null
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadOrders() }, [])

  const loadOrders = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500 mt-1">{orders.length} orders</p>
        </div>
      </div>
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No orders found</div>
      ) : (
        <div className="grid gap-4">
          {orders.map((o) => (
            <div key={o.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{o.order_number} — {o.client_name}</h3>
                  {o.china_order_number && <p className="text-xs text-gray-500 mt-1">China ref: {o.china_order_number}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatZAR(o.value_zar)}</p>
                    <p className="text-xs text-gray-500">{formatUSD(o.value_usd)}</p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    o.status === 'Delivered' || o.status === 'Installed' ? 'bg-green-100 text-green-800' :
                    o.status === 'In Production' || o.status === 'Shipped' ? 'bg-blue-100 text-blue-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>{o.status}</span>
                </div>
              </div>
              {(o.tracking_number || o.vessel_flight || o.eta) && (
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                  {o.tracking_number && <span>Tracking: {o.tracking_number}</span>}
                  {o.vessel_flight && <span>Vessel: {o.vessel_flight}</span>}
                  {o.eta && <span>ETA: {new Date(o.eta).toLocaleDateString('en-ZA')}</span>}
                  <span>Deposit: {o.deposit_paid ? '✅ Paid' : '❌ Unpaid'}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}