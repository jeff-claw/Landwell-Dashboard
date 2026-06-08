'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bug, Trash2, RefreshCw, CheckCircle, Clock, XCircle, AlertCircle, ExternalLink, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'

interface IssueReport {
  id: string
  created_at: string
  user_email: string
  user_name: string | null
  page_url: string
  description: string
  screenshot: string | null
  browser_info: {
    userAgent?: string
    screenWidth?: number
    screenHeight?: number
    timestamp?: string
  } | null
  status: 'pending' | 'in_progress' | 'resolved' | 'wont_fix'
  resolution_notes: string | null
  resolved_at: string | null
}

interface CleanupPreview {
  preview: boolean
  wouldDelete: {
    resolved: number
    old: number
    total: number
  }
  currentTotal: number
  config: {
    resolvedMaxAgeDays: number
    allReportsMaxAgeDays: number
  }
}

const statusConfig = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-800', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-800', icon: RefreshCw },
  resolved: { label: 'Resolved', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
  wont_fix: { label: "Won't Fix", color: 'bg-slate-100 text-slate-800', icon: XCircle },
}

export default function IssueReportsPage() {
  const [issues, setIssues] = useState<IssueReport[]>([])
  const [loading, setLoading] = useState(true)
  const [cleanupPreview, setCleanupPreview] = useState<CleanupPreview | null>(null)
  const [cleaningUp, setCleaningUp] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState<IssueReport | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  
  const supabase = createClient()

  const fetchIssues = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('issue_reports')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }
    
    const { data, error } = await query

    if (error) {
      console.error('Error fetching issues:', error)
      toast.error('Failed to load issues')
    } else {
      setIssues(data || [])
    }
    setLoading(false)
  }, [supabase, statusFilter])

  const fetchCleanupPreview = async () => {
    try {
      const response = await fetch('/api/issue-reports/cleanup')
      const data = await response.json()
      setCleanupPreview(data)
    } catch (error) {
      console.error('Error fetching cleanup preview:', error)
    }
  }

  useEffect(() => {
    fetchIssues()
    fetchCleanupPreview()
  }, [fetchIssues])

  const handleCleanup = async () => {
    if (!cleanupPreview || cleanupPreview.wouldDelete.total === 0) {
      toast.info('Nothing to clean up')
      return
    }

    setCleaningUp(true)
    try {
      const response = await fetch('/api/issue-reports/cleanup', { method: 'POST' })
      const result = await response.json()
      
      if (response.ok) {
        toast.success(`Cleaned up ${result.deleted.total} issue reports`)
        fetchIssues()
        fetchCleanupPreview()
      } else {
        toast.error(result.error || 'Cleanup failed')
      }
    } catch (error) {
      console.error('Cleanup error:', error)
      toast.error('Failed to run cleanup')
    }
    setCleaningUp(false)
  }

  const updateStatus = async (id: string, newStatus: IssueReport['status']) => {
    const updates: Partial<IssueReport> & { resolved_at?: string | null } = { status: newStatus }
    if (newStatus === 'resolved' || newStatus === 'wont_fix') {
      updates.resolved_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('issue_reports')
      .update(updates)
      .eq('id', id)

    if (error) {
      toast.error('Failed to update status')
    } else {
      toast.success('Status updated')
      fetchIssues()
      fetchCleanupPreview()
    }
  }

  const deleteIssue = async (id: string) => {
    if (!confirm('Delete this issue report?')) return

    const { error } = await supabase
      .from('issue_reports')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error('Failed to delete')
    } else {
      toast.success('Issue deleted')
      setSelectedIssue(null)
      fetchIssues()
      fetchCleanupPreview()
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getRelativePath = (url: string) => {
    try {
      return new URL(url).pathname
    } catch {
      return url
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Bug className="w-8 h-8 text-amber-500" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Issue Reports</h1>
            <p className="text-sm text-slate-500">{issues.length} reports</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { fetchIssues(); fetchCleanupPreview() }}
            className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Cleanup Card */}
      {cleanupPreview && cleanupPreview.wouldDelete.total > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-amber-900">Cleanup Available</h3>
                <p className="text-sm text-amber-700 mt-1">
                  {cleanupPreview.wouldDelete.resolved > 0 && (
                    <span>{cleanupPreview.wouldDelete.resolved} resolved reports older than {cleanupPreview.config.resolvedMaxAgeDays} days. </span>
                  )}
                  {cleanupPreview.wouldDelete.old > 0 && (
                    <span>{cleanupPreview.wouldDelete.old} reports older than {cleanupPreview.config.allReportsMaxAgeDays} days.</span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={handleCleanup}
              disabled={cleaningUp}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-medium rounded-lg transition"
            >
              {cleaningUp ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Cleaning...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Clean Up {cleanupPreview.wouldDelete.total}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
        {['all', 'pending', 'in_progress', 'resolved', 'wont_fix'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
              statusFilter === status
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {status === 'all' ? 'All' : statusConfig[status as keyof typeof statusConfig].label}
          </button>
        ))}
      </div>

      {/* Issues Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      ) : issues.length === 0 ? (
        <div className="text-center py-12">
          <Bug className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No issue reports found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {issues.map((issue) => {
            const StatusIcon = statusConfig[issue.status].icon
            return (
              <div
                key={issue.id}
                className={`bg-white rounded-xl border border-slate-200 p-4 cursor-pointer hover:shadow-md transition ${
                  selectedIssue?.id === issue.id ? 'ring-2 ring-amber-500' : ''
                }`}
                onClick={() => setSelectedIssue(selectedIssue?.id === issue.id ? null : issue)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[issue.status].color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig[issue.status].label}
                      </span>
                      {issue.screenshot && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          <ImageIcon className="w-3 h-3" />
                          Screenshot
                        </span>
                      )}
                    </div>
                    <p className="text-slate-900 line-clamp-2">{issue.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                      <span>{issue.user_name || issue.user_email}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        {getRelativePath(issue.page_url)}
                      </span>
                      <span>•</span>
                      <span>{formatDate(issue.created_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Expanded View */}
                {selectedIssue?.id === issue.id && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    {/* Screenshot */}
                    {issue.screenshot && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-slate-700 mb-2">Screenshot</p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={issue.screenshot} 
                          alt="Issue screenshot" 
                          className="max-w-full rounded-lg border border-slate-200"
                        />
                      </div>
                    )}

                    {/* Browser Info */}
                    {issue.browser_info && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-slate-700 mb-1">Browser Info</p>
                        <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg font-mono">
                          {issue.browser_info.userAgent?.slice(0, 100)}...
                          <br />
                          Screen: {issue.browser_info.screenWidth}×{issue.browser_info.screenHeight}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={issue.status}
                        onChange={(e) => updateStatus(issue.id, e.target.value as IssueReport['status'])}
                        onClick={(e) => e.stopPropagation()}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="wont_fix">Won&apos;t Fix</option>
                      </select>
                      <a
                        href={issue.page_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Visit Page
                      </a>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteIssue(issue.id) }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
