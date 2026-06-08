'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { Employee, EmployeeDocument, EmploymentType, EmploymentStatus } from '@/lib/types'
import { EMPLOYMENT_TYPE_CONFIG, EMPLOYMENT_STATUS_CONFIG } from '@/lib/types'
import { ArrowLeft, Edit2, Save, X, Plus, Trash2, FileText, Upload } from 'lucide-react'
import { toast } from 'sonner'

export default function EmployeeProfilePage() {
  const params = useParams()
  const router = useRouter()
  const employeeId = params.id as string
  const supabase = createClient()

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [documents, setDocuments] = useState<EmployeeDocument[]>([])
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Employee>>({})

  // Document form
  const [showDocForm, setShowDocForm] = useState(false)
  const [docForm, setDocForm] = useState({ document_type: '', file_name: '', file_url: '', notes: '' })
  const [savingDoc, setSavingDoc] = useState(false)

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

  const fetchEmployee = useCallback(async () => {
    const [empRes, docsRes, allRes] = await Promise.all([
      supabase.from('employees').select('*').eq('id', employeeId).single(),
      supabase.from('employee_documents').select('*').eq('employee_id', employeeId).order('created_at', { ascending: false }),
      supabase.from('employees').select('id, first_name, last_name').order('first_name'),
    ])

    if (empRes.data) {
      // Resolve reports_to name
      const manager = allRes.data?.find(e => e.id === empRes.data.reports_to)
      setEmployee({
        ...empRes.data,
        reports_to_name: manager ? `${manager.first_name} ${manager.last_name}` : undefined,
      })
      setEditForm(empRes.data)
    }
    setDocuments(docsRes.data || [])
    setAllEmployees((allRes.data || []) as Employee[])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId])

  useEffect(() => {
    if (authorized) fetchEmployee()
  }, [authorized, fetchEmployee])

  const startEditing = () => {
    setEditForm({ ...employee })
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
    setEditForm({})
  }

  const saveEmployee = async () => {
    if (!editForm.first_name?.trim() || !editForm.last_name?.trim()) {
      toast.error('Name fields are required')
      return
    }
    setSaving(true)

    const { error } = await supabase.from('employees').update({
      first_name: editForm.first_name?.trim(),
      last_name: editForm.last_name?.trim(),
      email: editForm.email?.trim() || null,
      phone: editForm.phone?.trim() || null,
      id_number: editForm.id_number?.trim() || null,
      department: editForm.department?.trim() || null,
      job_title: editForm.job_title?.trim() || null,
      employment_type: editForm.employment_type,
      employment_status: editForm.employment_status,
      start_date: editForm.start_date || null,
      end_date: editForm.end_date || null,
      reports_to: editForm.reports_to || null,
      notes: editForm.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', employeeId)

    setSaving(false)

    if (error) {
      toast.error('Failed to update employee')
      console.error(error)
      return
    }

    toast.success('Employee updated')
    setEditing(false)
    fetchEmployee()
  }

  const addDocument = async () => {
    if (!docForm.file_name.trim() || !docForm.document_type.trim()) {
      toast.error('Document type and file name are required')
      return
    }
    setSavingDoc(true)

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('employee_documents').insert({
      employee_id: employeeId,
      document_type: docForm.document_type.trim(),
      file_name: docForm.file_name.trim(),
      file_url: docForm.file_url.trim() || null,
      notes: docForm.notes.trim() || null,
      uploaded_by: user?.id || null,
    })

    setSavingDoc(false)

    if (error) {
      toast.error('Failed to add document')
      console.error(error)
      return
    }

    toast.success('Document added')
    setDocForm({ document_type: '', file_name: '', file_url: '', notes: '' })
    setShowDocForm(false)
    fetchEmployee()
  }

  const deleteDocument = async (docId: string, fileName: string) => {
    if (!confirm(`Delete document "${fileName}"?`)) return
    const { error } = await supabase.from('employee_documents').delete().eq('id', docId)
    if (error) {
      toast.error('Failed to delete document')
      return
    }
    toast.success('Document deleted')
    fetchEmployee()
  }

  if (!authorized || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="card text-center py-12">
        <p className="text-slate-500">Employee not found</p>
        <Link href="/hr" className="text-teal-600 hover:text-teal-700 mt-2 inline-block">Back to Directory</Link>
      </div>
    )
  }

  const statusConfig = EMPLOYMENT_STATUS_CONFIG[employee.employment_status]
  const typeConfig = EMPLOYMENT_TYPE_CONFIG[employee.employment_type]

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/hr" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{employee.first_name} {employee.last_name}</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                {statusConfig.label}
              </span>
            </div>
            <p className="text-sm text-slate-500">{employee.job_title}{employee.department ? ` - ${employee.department}` : ''}</p>
          </div>
        </div>
        <div>
          {editing ? (
            <div className="flex gap-2">
              <button onClick={cancelEditing} className="btn-secondary">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button onClick={saveEmployee} disabled={saving} className="btn-primary">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          ) : (
            <button onClick={startEditing} className="btn-secondary">
              <Edit2 className="w-4 h-4" /> Edit
            </button>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="card space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Employee Details</h2>

        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                <input type="text" value={editForm.first_name || ''} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                <input type="text" value={editForm.last_name || ''} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} className="input" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="email" value={editForm.email || ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input type="text" value={editForm.phone || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="input" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ID Number</label>
              <input type="text" value={editForm.id_number || ''} onChange={(e) => setEditForm({ ...editForm, id_number: e.target.value })} className="input" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                <input type="text" value={editForm.department || ''} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Job Title</label>
                <input type="text" value={editForm.job_title || ''} onChange={(e) => setEditForm({ ...editForm, job_title: e.target.value })} className="input" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Employment Type</label>
                <select value={editForm.employment_type || 'full_time'} onChange={(e) => setEditForm({ ...editForm, employment_type: e.target.value as EmploymentType })} className="input">
                  <option value="full_time">Full-Time</option>
                  <option value="part_time">Part-Time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Employment Status</label>
                <select value={editForm.employment_status || 'active'} onChange={(e) => setEditForm({ ...editForm, employment_status: e.target.value as EmploymentStatus })} className="input">
                  <option value="active">Active</option>
                  <option value="probation">Probation</option>
                  <option value="suspended">Suspended</option>
                  <option value="exited">Exited</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                <input type="date" value={editForm.start_date || ''} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                <input type="date" value={editForm.end_date || ''} onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })} className="input" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reports To</label>
              <select value={editForm.reports_to || ''} onChange={(e) => setEditForm({ ...editForm, reports_to: e.target.value })} className="input">
                <option value="">-- None --</option>
                {allEmployees.filter(e => e.id !== employeeId).map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea value={editForm.notes || ''} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="input resize-none" rows={3} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-slate-500 text-xs mb-1">Email</div>
              <div className="font-medium text-slate-900">{employee.email || '---'}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-slate-500 text-xs mb-1">Phone</div>
              <div className="font-medium text-slate-900">{employee.phone || '---'}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-slate-500 text-xs mb-1">ID Number</div>
              <div className="font-medium text-slate-900">{employee.id_number || '---'}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-slate-500 text-xs mb-1">Department</div>
              <div className="font-medium text-slate-900">{employee.department || '---'}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-slate-500 text-xs mb-1">Job Title</div>
              <div className="font-medium text-slate-900">{employee.job_title || '---'}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-slate-500 text-xs mb-1">Employment Type</div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeConfig.bg} ${typeConfig.text}`}>{typeConfig.label}</span>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-slate-500 text-xs mb-1">Start Date</div>
              <div className="font-medium text-slate-900">{employee.start_date ? new Date(employee.start_date).toLocaleDateString() : '---'}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-slate-500 text-xs mb-1">End Date</div>
              <div className="font-medium text-slate-900">{employee.end_date ? new Date(employee.end_date).toLocaleDateString() : '---'}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-slate-500 text-xs mb-1">Reports To</div>
              <div className="font-medium text-slate-900">{employee.reports_to_name || '---'}</div>
            </div>
            {employee.notes && (
              <div className="bg-slate-50 rounded-lg p-3 sm:col-span-2">
                <div className="text-slate-500 text-xs mb-1">Notes</div>
                <div className="font-medium text-slate-900 whitespace-pre-wrap">{employee.notes}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Documents */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
          <button onClick={() => setShowDocForm(!showDocForm)} className="btn-secondary text-sm">
            {showDocForm ? <><X className="w-4 h-4" /> Cancel</> : <><Plus className="w-4 h-4" /> Add Document</>}
          </button>
        </div>

        {showDocForm && (
          <div className="bg-slate-50 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Document Type <span className="text-red-500">*</span></label>
                <select
                  value={docForm.document_type}
                  onChange={(e) => setDocForm({ ...docForm, document_type: e.target.value })}
                  className="input"
                >
                  <option value="">Select type...</option>
                  <option value="contract">Employment Contract</option>
                  <option value="id_copy">ID Copy</option>
                  <option value="cv">CV / Resume</option>
                  <option value="qualification">Qualification</option>
                  <option value="tax">Tax Document</option>
                  <option value="medical">Medical Certificate</option>
                  <option value="disciplinary">Disciplinary Record</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">File Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={docForm.file_name}
                  onChange={(e) => setDocForm({ ...docForm, file_name: e.target.value })}
                  className="input"
                  placeholder="e.g. employment_contract_2026.pdf"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">File URL <span className="text-slate-400">(optional)</span></label>
              <input
                type="url"
                value={docForm.file_url}
                onChange={(e) => setDocForm({ ...docForm, file_url: e.target.value })}
                className="input"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <input
                type="text"
                value={docForm.notes}
                onChange={(e) => setDocForm({ ...docForm, notes: e.target.value })}
                className="input"
                placeholder="Optional notes..."
              />
            </div>
            <button onClick={addDocument} disabled={savingDoc} className="btn-primary">
              <Upload className="w-4 h-4" /> {savingDoc ? 'Adding...' : 'Add Document'}
            </button>
          </div>
        )}

        {documents.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {documents.map(doc => (
              <div key={doc.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-slate-400" />
                  <div>
                    <div className="font-medium text-sm text-slate-900">{doc.file_name}</div>
                    <div className="text-xs text-slate-500">
                      <span className="capitalize">{doc.document_type.replace('_', ' ')}</span>
                      {' '}&middot;{' '}
                      {new Date(doc.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {doc.file_url && (
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:text-teal-700 text-sm font-medium">
                      View
                    </a>
                  )}
                  <button onClick={() => deleteDocument(doc.id, doc.file_name)} className="p-1.5 hover:bg-red-50 rounded text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          !showDocForm && (
            <p className="text-sm text-slate-400 text-center py-6">No documents uploaded yet</p>
          )
        )}
      </div>
    </div>
  )
}
