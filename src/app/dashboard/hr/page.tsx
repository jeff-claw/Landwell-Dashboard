'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Employee } from '@/lib/types'
import { EMPLOYMENT_TYPE_CONFIG, EMPLOYMENT_STATUS_CONFIG } from '@/lib/types'
import { Search, Plus, Users, UserCheck, Clock, UserX } from 'lucide-react'

export default function HRDirectoryPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [filterDept, setFilterDept] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const router = useRouter()
  const supabase = createClient()

  // Auth check
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
    }
    checkAccess()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const fetchEmployees = useCallback(async () => {
    const { data } = await supabase
      .from('employees')
      .select('*')
      .order('first_name')

    // Resolve reports_to names
    if (data) {
      const withNames = data.map(emp => {
        if (emp.reports_to) {
          const manager = data.find(e => e.id === emp.reports_to)
          return { ...emp, reports_to_name: manager ? `${manager.first_name} ${manager.last_name}` : undefined }
        }
        return emp
      })
      setEmployees(withNames)
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (authorized) fetchEmployees()
  }, [authorized, fetchEmployees])

  // Stats
  const stats = useMemo(() => ({
    total: employees.length,
    active: employees.filter(e => e.employment_status === 'active').length,
    probation: employees.filter(e => e.employment_status === 'probation').length,
    exited: employees.filter(e => e.employment_status === 'exited').length,
  }), [employees])

  // Departments list
  const departments = useMemo(() => {
    const depts = new Set(employees.map(e => e.department).filter(Boolean))
    return Array.from(depts).sort()
  }, [employees])

  // Filtered list
  const filtered = useMemo(() => {
    return employees.filter(emp => {
      if (filterStatus !== 'all' && emp.employment_status !== filterStatus) return false
      if (filterDept !== 'all' && emp.department !== filterDept) return false
      if (searchText) {
        const s = searchText.toLowerCase()
        return (
          `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(s) ||
          emp.email?.toLowerCase().includes(s) ||
          emp.department?.toLowerCase().includes(s) ||
          emp.job_title?.toLowerCase().includes(s)
        )
      }
      return true
    })
  }, [employees, filterStatus, filterDept, searchText])

  if (!authorized || loading) {
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
        <h1 className="text-2xl font-bold text-slate-900">Employee Directory</h1>
        <Link href="/hr/new" className="btn-primary">
          <Plus className="w-4 h-4" />
          Add Employee
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            <div className="text-xs text-slate-500">Total</div>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
            <UserCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{stats.active}</div>
            <div className="text-xs text-slate-500">Active</div>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{stats.probation}</div>
            <div className="text-xs text-slate-500">Probation</div>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
            <UserX className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{stats.exited}</div>
            <div className="text-xs text-slate-500">Exited</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search employees..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 w-56"
          />
        </div>
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="input w-auto"
        >
          <option value="all">All Departments</option>
          {departments.map(d => (
            <option key={d} value={d!}>{d}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="input w-auto"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="probation">Probation</option>
          <option value="suspended">Suspended</option>
          <option value="exited">Exited</option>
        </select>
      </div>

      {/* Employee List */}
      <div className="space-y-3">
        {filtered.map(emp => {
          const typeConfig = EMPLOYMENT_TYPE_CONFIG[emp.employment_type]
          const statusConfig = EMPLOYMENT_STATUS_CONFIG[emp.employment_status]
          return (
            <Link
              key={emp.id}
              href={`/hr/${emp.id}`}
              className="card hover:shadow-md transition-shadow block"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center text-teal-700 font-bold text-sm">
                    {emp.first_name[0]}{emp.last_name[0]}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{emp.first_name} {emp.last_name}</div>
                    <div className="text-sm text-slate-500">
                      {emp.job_title}{emp.department ? ` - ${emp.department}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeConfig.bg} ${typeConfig.text}`}>
                    {typeConfig.label}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                    {statusConfig.label}
                  </span>
                  {emp.reports_to_name && (
                    <span className="text-xs text-slate-400">Reports to: {emp.reports_to_name}</span>
                  )}
                </div>
              </div>
            </Link>
          )
        })}

        {filtered.length === 0 && (
          <div className="card text-center py-12">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No employees found</p>
            <Link
              href="/hr/new"
              className="mt-4 text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1 mx-auto justify-center"
            >
              <Plus className="w-4 h-4" /> Add your first employee
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
