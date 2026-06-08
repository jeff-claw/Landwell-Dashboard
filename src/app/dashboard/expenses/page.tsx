'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { MonthlyExpense, MonthlyExpenseCategory, MonthlyExpenseFrequency } from '@/lib/types'
import { MONTHLY_EXPENSE_CATEGORIES } from '@/lib/types'
import {
  Banknote,
  Plus,
  X,
  Edit2,
  Trash2,
  Search,
  TrendingUp,
  Calendar,
} from 'lucide-react'
import { toast } from 'sonner'

function formatZAR(val: number) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 2,
  }).format(val || 0)
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

const FREQUENCY_OPTIONS: { value: MonthlyExpenseFrequency; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual', label: 'Annual' },
  { value: 'once-off', label: 'Once-off' },
]

const CATEGORY_COLORS: Record<MonthlyExpenseCategory, { bg: string; text: string; border: string }> = {
  salaries: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  rent: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  utilities: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  phone: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200' },
  insurance: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  software: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
  other: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
}

interface ExpenseForm {
  name: string
  category: MonthlyExpenseCategory
  amount: string
  frequency: MonthlyExpenseFrequency
  start_date: string
  end_date: string
  notes: string
}

const getEmptyForm = (): ExpenseForm => ({
  name: '',
  category: 'other',
  amount: '',
  frequency: 'monthly',
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
  notes: '',
})

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<MonthlyExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Modal states
  const [showModal, setShowModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<MonthlyExpense | null>(null)
  const [form, setForm] = useState<ExpenseForm>(getEmptyForm())

  // Delete confirmation
  const [deleteModal, setDeleteModal] = useState<MonthlyExpense | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Filters
  const [filterText, setFilterText] = useState('')
  const [filterCategory, setFilterCategory] = useState<MonthlyExpenseCategory | 'all'>('all')
  const [filterFrequency, setFilterFrequency] = useState<MonthlyExpenseFrequency | 'all'>('all')

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('monthly_expenses')
      .select('*')
      .order('category')
      .order('name')

    if (error) {
      console.error('Error fetching expenses:', error)
      toast.error('Failed to load expenses')
    } else {
      setExpenses(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      if (filterCategory !== 'all' && exp.category !== filterCategory) return false
      if (filterFrequency !== 'all' && exp.frequency !== filterFrequency) return false
      if (filterText) {
        const search = filterText.toLowerCase()
        return (
          exp.name.toLowerCase().includes(search) ||
          exp.notes?.toLowerCase().includes(search) ||
          exp.category.toLowerCase().includes(search)
        )
      }
      return true
    })
  }, [expenses, filterCategory, filterFrequency, filterText])

  // Stats
  const stats = useMemo(() => {
    const now = new Date()

    // Only count active expenses (no end_date or end_date in the future)
    const active = expenses.filter(e => !e.end_date || new Date(e.end_date) >= now)

    const totalMonthly = active.reduce((sum, e) => {
      if (e.frequency === 'monthly') return sum + Number(e.amount)
      if (e.frequency === 'annual') return sum + Number(e.amount) / 12
      return sum
    }, 0)

    const totalAnnual = totalMonthly * 12

    // Category breakdown (monthly equivalent)
    const byCategory: Record<string, number> = {}
    active.forEach(e => {
      const monthly = e.frequency === 'monthly' ? Number(e.amount) : e.frequency === 'annual' ? Number(e.amount) / 12 : 0
      byCategory[e.category] = (byCategory[e.category] || 0) + monthly
    })

    return { totalMonthly, totalAnnual, byCategory, activeCount: active.length }
  }, [expenses])

  // Open create modal
  const openCreateModal = () => {
    setEditingExpense(null)
    setForm(getEmptyForm())
    setShowModal(true)
  }

  // Open edit modal
  const openEditModal = (expense: MonthlyExpense) => {
    setEditingExpense(expense)
    setForm({
      name: expense.name,
      category: expense.category,
      amount: String(expense.amount),
      frequency: expense.frequency,
      start_date: expense.start_date,
      end_date: expense.end_date || '',
      notes: expense.notes || '',
    })
    setShowModal(true)
  }

  // Save expense
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.amount) {
      toast.error('Name and amount are required')
      return
    }

    setSaving(true)
    const supabase = createClient()

    const payload = {
      name: form.name.trim(),
      category: form.category,
      amount: parseFloat(form.amount),
      frequency: form.frequency,
      start_date: form.start_date,
      end_date: form.end_date || null,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    }

    let error
    if (editingExpense) {
      const result = await supabase
        .from('monthly_expenses')
        .update(payload)
        .eq('id', editingExpense.id)
      error = result.error
    } else {
      const result = await supabase
        .from('monthly_expenses')
        .insert(payload)
      error = result.error
    }

    setSaving(false)

    if (error) {
      console.error('Error saving expense:', error)
      toast.error('Failed to save expense')
      return
    }

    toast.success(editingExpense ? 'Expense updated' : 'Expense added')
    setShowModal(false)
    setEditingExpense(null)
    setForm(getEmptyForm())
    fetchData()
  }

  // Delete expense
  const handleDelete = async () => {
    if (!deleteModal) return
    setDeleting(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('monthly_expenses')
      .delete()
      .eq('id', deleteModal.id)

    if (error) {
      console.error('Error deleting expense:', error)
      toast.error('Failed to delete expense')
    } else {
      toast.success('Expense deleted')
      setDeleteModal(null)
      fetchData()
    }
    setDeleting(false)
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-16 skeleton rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-24 skeleton rounded-xl" />)}
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
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Banknote className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Monthly Expenses</h1>
            <p className="text-sm text-slate-500">Track recurring business costs</p>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Expense
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
            <Banknote className="w-4 h-4" />
            Monthly Total
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatZAR(stats.totalMonthly)}</div>
          <div className="text-xs text-slate-400 mt-1">{stats.activeCount} active expenses</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
            <TrendingUp className="w-4 h-4" />
            Annual Projection
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatZAR(stats.totalAnnual)}</div>
          <div className="text-xs text-slate-400 mt-1">Based on recurring costs</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
            <Calendar className="w-4 h-4" />
            Largest Category
          </div>
          {Object.keys(stats.byCategory).length > 0 ? (() => {
            const sorted = Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1])
            const [topCat, topVal] = sorted[0]
            return (
              <>
                <div className="text-2xl font-bold text-slate-900">{formatZAR(topVal)}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {MONTHLY_EXPENSE_CATEGORIES[topCat as MonthlyExpenseCategory]?.label || topCat} / month
                </div>
              </>
            )
          })() : (
            <>
              <div className="text-2xl font-bold text-slate-400">-</div>
              <div className="text-xs text-slate-400 mt-1">No active expenses</div>
            </>
          )}
        </div>
      </div>

      {/* Category Breakdown Bar */}
      {Object.keys(stats.byCategory).length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <h3 className="font-semibold text-slate-900 mb-3">Monthly Breakdown by Category</h3>
          <div className="space-y-2">
            {Object.entries(stats.byCategory)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, amount]) => {
                const pct = stats.totalMonthly > 0 ? (amount / stats.totalMonthly) * 100 : 0
                const colors = CATEGORY_COLORS[cat as MonthlyExpenseCategory] || CATEGORY_COLORS.other
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <div className="w-24 text-sm text-slate-600">
                      {MONTHLY_EXPENSE_CATEGORIES[cat as MonthlyExpenseCategory]?.label || cat}
                    </div>
                    <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                      <div
                        className={`h-full ${colors.bg} rounded-full flex items-center px-2`}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      >
                        {pct > 15 && (
                          <span className={`text-xs font-medium ${colors.text}`}>{pct.toFixed(0)}%</span>
                        )}
                      </div>
                    </div>
                    <div className="w-28 text-right text-sm font-medium text-slate-700">
                      {formatZAR(amount)}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search expenses..."
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value as MonthlyExpenseCategory | 'all')}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">All Categories</option>
          {Object.entries(MONTHLY_EXPENSE_CATEGORIES).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
        <select
          value={filterFrequency}
          onChange={e => setFilterFrequency(e.target.value as MonthlyExpenseFrequency | 'all')}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">All Frequencies</option>
          {FREQUENCY_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {(filterCategory !== 'all' || filterFrequency !== 'all' || filterText) && (
          <button
            onClick={() => { setFilterCategory('all'); setFilterFrequency('all'); setFilterText('') }}
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>

      {/* Expenses Table */}
      {filteredExpenses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Banknote className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 mb-3">
            {expenses.length === 0 ? 'No expenses yet' : 'No expenses match your filters'}
          </p>
          {expenses.length === 0 && (
            <button onClick={openCreateModal} className="text-teal-600 font-medium hover:underline">
              + Add your first expense
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Frequency</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Start</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">End</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map(expense => {
                  const colors = CATEGORY_COLORS[expense.category] || CATEGORY_COLORS.other
                  const isExpired = expense.end_date && new Date(expense.end_date) < new Date()
                  return (
                    <tr key={expense.id} className={`hover:bg-slate-50 transition-colors ${isExpired ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{expense.name}</div>
                        {expense.notes && (
                          <div className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">{expense.notes}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                          {MONTHLY_EXPENSE_CATEGORIES[expense.category]?.label || expense.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatZAR(expense.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600 capitalize">{expense.frequency}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(expense.start_date)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {expense.end_date ? (
                          <span className={isExpired ? 'text-red-500' : ''}>{formatDate(expense.end_date)}</span>
                        ) : (
                          <span className="text-slate-400">Ongoing</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(expense)}
                            className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteModal(expense)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredExpenses.map(expense => {
              const colors = CATEGORY_COLORS[expense.category] || CATEGORY_COLORS.other
              const isExpired = expense.end_date && new Date(expense.end_date) < new Date()
              return (
                <div key={expense.id} className={`p-4 ${isExpired ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-slate-900">{expense.name}</span>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                          {MONTHLY_EXPENSE_CATEGORIES[expense.category]?.label}
                        </span>
                      </div>
                      <div className="text-sm text-slate-500">
                        <span className="capitalize">{expense.frequency}</span>
                        {' · '}
                        Started {formatDate(expense.start_date)}
                        {expense.end_date && (
                          <span className={isExpired ? ' text-red-500' : ''}>
                            {' · '}Ends {formatDate(expense.end_date)}
                          </span>
                        )}
                      </div>
                      {expense.notes && (
                        <div className="text-xs text-slate-400 mt-1">{expense.notes}</div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-slate-900">{formatZAR(expense.amount)}</div>
                      <div className="flex items-center gap-1 mt-1 justify-end">
                        <button
                          onClick={() => openEditModal(expense)}
                          className="p-1 text-slate-400 hover:text-teal-600"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteModal(expense)}
                          className="p-1 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">
                {editingExpense ? 'Edit Expense' : 'Add Expense'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="input w-full"
                  placeholder="e.g., Office Rent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
                  <select
                    required
                    value={form.category}
                    onChange={e => setForm(prev => ({ ...prev, category: e.target.value as MonthlyExpenseCategory }))}
                    className="input w-full"
                  >
                    {Object.entries(MONTHLY_EXPENSE_CATEGORIES).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Frequency *</label>
                  <select
                    required
                    value={form.frequency}
                    onChange={e => setForm(prev => ({ ...prev, frequency: e.target.value as MonthlyExpenseFrequency }))}
                    className="input w-full"
                  >
                    {FREQUENCY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (ZAR) *</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="input w-full"
                  placeholder="0.00"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={form.start_date}
                    onChange={e => setForm(prev => ({ ...prev, start_date: e.target.value }))}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={e => setForm(prev => ({ ...prev, end_date: e.target.value }))}
                    className="input w-full"
                  />
                  <p className="text-xs text-slate-400 mt-1">Leave empty for ongoing</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="input w-full"
                  rows={2}
                  placeholder="Optional notes..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Saving...' : (editingExpense ? 'Update Expense' : 'Add Expense')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Delete Expense</h2>
            </div>
            <p className="text-slate-600 mb-6">
              Delete &ldquo;{deleteModal.name}&rdquo; ({formatZAR(deleteModal.amount)} {deleteModal.frequency})? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal(null)}
                className="btn-secondary flex-1"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
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
