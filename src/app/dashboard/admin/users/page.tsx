'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, UserRole, UserStatus } from '@/lib/types'
import { CheckCircle2, XCircle, Clock, Plus, X, UserPlus, Trash2 } from 'lucide-react'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [preApprovedEmails, setPreApprovedEmails] = useState<Array<{ email: string; role: string; full_name: string | null }>>([])

  const supabase = createClient()

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }

  const fetchPreApproved = async () => {
    const { data } = await supabase.from('approved_emails').select('*').order('created_at', { ascending: false })
    setPreApprovedEmails(data || [])
  }

  useEffect(() => { 
    fetchUsers()
    fetchPreApproved()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateUser = async (id: string, updates: { status?: UserStatus; role?: UserRole }) => {
    await supabase.from('profiles').update(updates).eq('id', id)
    fetchUsers()
  }

  const deleteUser = async (id: string, email: string) => {
    if (!confirm(`Are you sure you want to delete ${email}? This cannot be undone.`)) return
    
    const response = await fetch('/api/delete-user', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id }),
    })

    if (!response.ok) {
      const result = await response.json()
      alert('Error: ' + (result.error || 'Failed to delete user'))
      return
    }

    fetchUsers()
  }

  const handleAddUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setAddLoading(true)
    
    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const fullName = formData.get('fullName') as string
    const role = formData.get('role') as string
    
    // Check if email already exists in profiles
    const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase())
    if (existingUser) {
      alert('A user with this email already exists.')
      setAddLoading(false)
      return
    }
    
    // Check if already pre-approved
    const existingPreApproved = preApprovedEmails.find(e => e.email.toLowerCase() === email.toLowerCase())
    if (existingPreApproved) {
      alert('This email is already pre-approved.')
      setAddLoading(false)
      return
    }
    
    // Insert into approved_emails
    const { error } = await supabase.from('approved_emails').insert({
      email: email.toLowerCase(),
      full_name: fullName || null,
      role: role || 'viewer',
    })
    
    if (error) {
      alert('Error: ' + error.message)
      setAddLoading(false)
      return
    }
    
    setShowAddModal(false)
    setAddLoading(false)
    fetchPreApproved()
  }

  const removePreApproved = async (email: string) => {
    if (!confirm(`Remove pre-approval for ${email}?`)) return
    await supabase.from('approved_emails').delete().eq('email', email)
    fetchPreApproved()
  }

  const statusIcon = (status: UserStatus) => {
    if (status === 'approved') return <CheckCircle2 className="w-4 h-4 text-green-500" />
    if (status === 'rejected') return <XCircle className="w-4 h-4 text-red-500" />
    return <Clock className="w-4 h-4 text-amber-500" />
  }

  const pendingUsers = users.filter(u => u.status === 'pending')
  const otherUsers = users.filter(u => u.status !== 'pending')

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div>
      {/* Header with Add Button */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
        <button 
          onClick={() => setShowAddModal(true)} 
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Pending Users Section */}
      {pendingUsers.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h2 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Pending Approval ({pendingUsers.length})
          </h2>
          <div className="space-y-2">
            {pendingUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-amber-200">
                <div>
                  <p className="font-medium text-slate-900">{user.full_name || 'No name'}</p>
                  <p className="text-sm text-slate-500">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateUser(user.id, { status: 'approved' })}
                    className="px-3 py-1.5 text-xs font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => updateUser(user.id, { status: 'rejected' })}
                    className="px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => deleteUser(user.id, user.email)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Delete user"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pre-Approved Emails Section */}
      {preApprovedEmails.length > 0 && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h2 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Pre-Approved ({preApprovedEmails.length})
          </h2>
          <p className="text-sm text-blue-600 mb-3">These users will be auto-approved when they sign up.</p>
          <div className="space-y-2">
            {preApprovedEmails.map((item) => (
              <div key={item.email} className="flex items-center justify-between bg-white rounded-lg p-3 border border-blue-200">
                <div>
                  <p className="font-medium text-slate-900">{item.full_name || item.email}</p>
                  <p className="text-sm text-slate-500">{item.email} • {item.role}</p>
                </div>
                <button
                  onClick={() => removePreApproved(item.email)}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Role</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {otherUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{user.full_name || '-'}</td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{user.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      onChange={(e) => updateUser(user.id, { role: e.target.value as UserRole })}
                      className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="sales_rep">Sales Rep</option>
                      <option value="admin">Admin</option>
                      <option value="founder">Founder</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {statusIcon(user.status)}
                      <span className="text-xs capitalize">{user.status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {user.status === 'approved' && (
                        <button
                          onClick={() => updateUser(user.id, { status: 'rejected' })}
                          className="px-3 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                        >
                          Revoke
                        </button>
                      )}
                      {user.status === 'rejected' && (
                        <button
                          onClick={() => updateUser(user.id, { status: 'approved' })}
                          className="px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                        >
                          Approve
                        </button>
                      )}
                      <button
                        onClick={() => deleteUser(user.id, user.email)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {otherUsers.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Add User</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  name="fullName"
                  placeholder="John Doe"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select
                  name="role"
                  defaultValue="viewer"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="viewer">Viewer</option>
                  <option value="sales_rep">Sales Rep</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  The user will be pre-approved. When they sign up with this email, they&apos;ll have immediate access with the selected role.
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {addLoading ? 'Adding...' : 'Add User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
