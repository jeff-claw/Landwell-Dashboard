'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Client } from '@/lib/types'
import { Plus, Pencil, Trash2, X, Search, Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'

// const REGIONS = ['Gauteng', 'Rustenburg', 'Northern Cape', 'KZN', 'Cape Town']

const emptyClient = {
  name: '',
  type: 'end_user',
  contact_person: '',
  email: '',
  phone: '',
  vat_number: '',
  address: '',
  notes: '',
}

export default function ClientsPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState(emptyClient)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const supabase = createClient()

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
    setClients(data || [])
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchClients() }, [])

  const filtered = clients.filter(c => {
    if (!search) return true
    const s = search.toLowerCase()
    return c.name?.toLowerCase().includes(s) ||
      c.contact_person?.toLowerCase().includes(s) ||
      c.email?.toLowerCase().includes(s)
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    if (editing) {
      await supabase.from('clients').update(form).eq('id', editing.id)
    } else {
      await supabase.from('clients').insert(form)
    }

    setSaving(false)
    setShowForm(false)
    setEditing(null)
    setForm(emptyClient)
    fetchClients()
  }

  const handleEdit = (client: Client) => {
    setEditing(client)
    setForm({
      name: client.name,
      type: client.type,
      contact_person: client.contact_person,
      email: client.email,
      phone: client.phone,
      vat_number: client.vat_number || '',
      address: client.address || '',
      notes: client.notes || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this client?')) return
    await supabase.from('clients').delete().eq('id', id)
    fetchClients()
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="h-12 skeleton w-48" />
        <div className="h-96 skeleton" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
          <p className="text-sm text-slate-500">{clients.length} total</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input !pl-9 !w-40 sm:!w-56"
            />
          </div>
          <button
            onClick={() => { setShowForm(true); setEditing(null); setForm(emptyClient) }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" /> Add Client
          </button>
        </div>
      </div>

      {/* Form Modal Overlay */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => { setShowForm(false); setEditing(null) }}>
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto p-6 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">{editing ? 'Edit Client' : 'New Client'}</h2>
              <button onClick={() => { setShowForm(false); setEditing(null) }} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company Name *</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="input" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</label>
                  <input type="text" value={form.contact_person} onChange={e => setForm({...form, contact_person: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Client Type</label>
                  <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="input">
                    <option value="end_user">End User</option>
                    <option value="reseller">Reseller</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input type="text" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">VAT Number</label>
                  <input type="text" value={form.vat_number} onChange={e => setForm({...form, vat_number: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                  <input type="text" value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="input" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="input" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditing(null) }} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clients Grid */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">&#128101;</div>
          <p className="text-slate-500 mb-3">{search ? 'No clients match your search' : 'No clients yet'}</p>
          {!search && (
            <button onClick={() => { setShowForm(true); setEditing(null); setForm(emptyClient) }} className="text-teal-600 font-semibold hover:underline">
              + Add your first client
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(client => (
              <div 
                key={client.id} 
                className="card cursor-pointer hover:border-teal-300 transition"
                onClick={() => router.push(`/clients/${client.id}`)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-slate-900">{client.name}</h3>
                    {client.contact_person && <p className="text-sm text-slate-500">{client.contact_person}</p>}
                  </div>
                  <span className={`badge ${client.type === 'reseller' ? 'badge-purple' : 'badge-blue'}`}>
                    {client.type === 'end_user' ? 'End User' : 'Reseller'}
                  </span>
                </div>
                {client.email && <p className="text-sm text-slate-600">{client.email}</p>}
                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => router.push(`/clients/${client.id}`)} className="btn-primary !py-1.5 !px-3 text-xs">
                    <Eye className="w-3 h-3" /> View
                  </button>
                  <button onClick={() => handleEdit(client)} className="btn-secondary !py-1.5 !px-3 text-xs">Edit</button>
                  <button onClick={() => handleDelete(client.id)} className="text-red-500 hover:text-red-700 text-xs px-3 py-1.5">Delete</button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block card !p-0 overflow-hidden">
            <table className="table-modern">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Contact</th>
                  <th className="hidden lg:table-cell">Email</th>
                  <th className="hidden lg:table-cell">Phone</th>
                  <th>Type</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(client => (
                  <tr 
                    key={client.id} 
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => router.push(`/clients/${client.id}`)}
                  >
                    <td className="font-medium text-slate-900">{client.name}</td>
                    <td className="text-slate-600">{client.contact_person}</td>
                    <td className="text-slate-600 hidden lg:table-cell">{client.email}</td>
                    <td className="text-slate-600 hidden lg:table-cell">{client.phone}</td>
                    <td>
                      <span className={`badge ${client.type === 'reseller' ? 'badge-purple' : 'badge-blue'}`}>
                        {client.type === 'end_user' ? 'End User' : 'Reseller'}
                      </span>
                    </td>
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => router.push(`/clients/${client.id}`)} className="p-1.5 text-slate-400 hover:text-teal-600 transition" title="View"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => handleEdit(client)} className="p-1.5 text-slate-400 hover:text-teal-600 transition ml-1" title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(client.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition ml-1" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
