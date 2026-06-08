'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Employee, EmploymentType, EmploymentStatus } from '@/lib/types'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

export default function NewEmployeePage() {
  const [authorized, setAuthorized] = useState(false)
  const [saving, setSaving] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const router = useRouter()
  const supabase = createClient()

  // Form state
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    id_number: '',
    department: '',
    job_title: '',
    employment_type: 'full_time' as EmploymentType,
    employment_status: 'active' as EmploymentStatus,
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    reports_to: '',
    notes: '',
  })

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!profile || !['founder', 'admin', 'hr'].includes(profile.role)) {
        router.push('/')
        return
      }
      setAuthorized(true)

      // Fetch employees for reports_to dropdown
      const { data: emps } = await supabase.from('employees').select('id, first_name, last_name').order('first_name')
      if (emps) setEmployees(emps as Employee[])
    }
    checkAccess()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!form.first_name.trim()) newErrors.first_name = 'First name is required'
    if (!form.last_name.trim()) newErrors.last_name = 'Last name is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase.from('employees').insert({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      id_number: form.id_number.trim() || null,
      department: form.department.trim() || null,
      job_title: form.job_title.trim() || null,
      employment_type: form.employment_type,
      employment_status: form.employment_status,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      reports_to: form.reports_to || null,
      notes: form.notes.trim() || null,
      created_by: user?.id || null,
    }).select().single()

    setSaving(false)

    if (error) {
      toast.error('Failed to create employee')
      console.error(error)
      return
    }

    toast.success('Employee added successfully')
    router.push(`/hr/${data.id}`)
  }

  if (!authorized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/hr" className="p-2 hover:bg-slate-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Add Employee</h1>
      </div>

      <div className="card space-y-4">
        {/* Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.first_name}
              onChange={(e) => updateField('first_name', e.target.value)}
              className={`input ${errors.first_name ? 'border-red-500' : ''}`}
              placeholder="John"
            />
            {errors.first_name && <p className="text-red-500 text-xs mt-1">{errors.first_name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.last_name}
              onChange={(e) => updateField('last_name', e.target.value)}
              className={`input ${errors.last_name ? 'border-red-500' : ''}`}
              placeholder="Doe"
            />
            {errors.last_name && <p className="text-red-500 text-xs mt-1">{errors.last_name}</p>}
          </div>
        </div>

        {/* Contact */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              className="input"
              placeholder="john@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              className="input"
              placeholder="+27 ..."
            />
          </div>
        </div>

        {/* ID Number */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">ID Number</label>
          <input
            type="text"
            value={form.id_number}
            onChange={(e) => updateField('id_number', e.target.value)}
            className="input"
            placeholder="SA ID or passport number"
          />
        </div>

        {/* Department & Job Title */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
            <input
              type="text"
              value={form.department}
              onChange={(e) => updateField('department', e.target.value)}
              className="input"
              placeholder="e.g. Sales, Operations"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Job Title</label>
            <input
              type="text"
              value={form.job_title}
              onChange={(e) => updateField('job_title', e.target.value)}
              className="input"
              placeholder="e.g. Sales Manager"
            />
          </div>
        </div>

        {/* Employment Type & Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employment Type</label>
            <select
              value={form.employment_type}
              onChange={(e) => updateField('employment_type', e.target.value)}
              className="input"
            >
              <option value="full_time">Full-Time</option>
              <option value="part_time">Part-Time</option>
              <option value="contract">Contract</option>
              <option value="intern">Intern</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employment Status</label>
            <select
              value={form.employment_status}
              onChange={(e) => updateField('employment_status', e.target.value)}
              className="input"
            >
              <option value="active">Active</option>
              <option value="probation">Probation</option>
              <option value="suspended">Suspended</option>
              <option value="exited">Exited</option>
            </select>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => updateField('start_date', e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              End Date <span className="text-slate-400">(if applicable)</span>
            </label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => updateField('end_date', e.target.value)}
              className="input"
            />
          </div>
        </div>

        {/* Reports To */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Reports To</label>
          <select
            value={form.reports_to}
            onChange={(e) => updateField('reports_to', e.target.value)}
            className="input"
          >
            <option value="">-- None --</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            className="input resize-none"
            rows={3}
            placeholder="Any additional notes..."
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Link href="/hr" className="btn-secondary flex-1 text-center">Cancel</Link>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="btn-primary flex-1"
        >
          {saving ? 'Saving...' : 'Save Employee'}
        </button>
      </div>
    </div>
  )
}
