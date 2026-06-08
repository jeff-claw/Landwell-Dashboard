'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { Ticket, TicketComment, Client } from '@/lib/types'
import { TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG, TICKET_ISSUE_TYPE_CONFIG } from '@/lib/types'
import type { TicketStatus, TicketPriority } from '@/lib/types'
import {
  ArrowLeft,
  User,
  Calendar,
  MessageSquare,
  Send,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return '1d ago'
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDateTime(dateStr)
}

export default function TicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const ticketId = params.id as string

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [comments, setComments] = useState<TicketComment[]>([])
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [profileName, setProfileName] = useState('')

  const fetchTicket = useCallback(async () => {
    const supabase = createClient()

    const [ticketRes, commentsRes, userRes] = await Promise.all([
      supabase.from('tickets').select('*').eq('id', ticketId).single(),
      supabase.from('ticket_comments').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true }),
      supabase.auth.getUser(),
    ])

    if (ticketRes.error || !ticketRes.data) {
      router.push('/tickets')
      return
    }

    const ticketData = ticketRes.data as Ticket

    // Fetch client if linked
    if (ticketData.client_id) {
      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('id', ticketData.client_id)
        .single()
      if (clientData) {
        setClient(clientData)
        ticketData.client_name = clientData.name
      }
    }

    setTicket(ticketData)
    setComments(commentsRes.data || [])
    setResolutionNotes(ticketData.resolution_notes || '')

    if (userRes.data?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userRes.data.user.id)
        .single()
      setProfileName(profile?.full_name || userRes.data.user.email?.split('@')[0] || '')
    }

    setLoading(false)
  }, [ticketId, router])

  useEffect(() => {
    if (ticketId) fetchTicket()
  }, [ticketId, fetchTicket])

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!ticket) return
    const supabase = createClient()

    const updates: Record<string, unknown> = { status: newStatus }
    if ((newStatus === 'resolved' || newStatus === 'closed') && !ticket.resolved_at) {
      updates.resolved_at = new Date().toISOString()
    }
    if (newStatus !== 'resolved' && newStatus !== 'closed') {
      updates.resolved_at = null
    }

    const { error } = await supabase.from('tickets').update(updates).eq('id', ticket.id)
    if (error) {
      toast.error('Failed to update status')
      return
    }

    // Add a system comment
    await supabase.from('ticket_comments').insert({
      ticket_id: ticket.id,
      comment: `Status changed to ${TICKET_STATUS_CONFIG[newStatus].label}`,
      created_by: profileName || null,
    })

    toast.success(`Status updated to ${TICKET_STATUS_CONFIG[newStatus].label}`)
    fetchTicket()
  }

  const handlePriorityChange = async (newPriority: TicketPriority) => {
    if (!ticket) return
    const supabase = createClient()

    const { error } = await supabase.from('tickets').update({ priority: newPriority }).eq('id', ticket.id)
    if (error) {
      toast.error('Failed to update priority')
      return
    }

    await supabase.from('ticket_comments').insert({
      ticket_id: ticket.id,
      comment: `Priority changed to ${TICKET_PRIORITY_CONFIG[newPriority].label}`,
      created_by: profileName || null,
    })

    toast.success(`Priority updated to ${TICKET_PRIORITY_CONFIG[newPriority].label}`)
    fetchTicket()
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || !ticket) return
    setSubmittingComment(true)
    const supabase = createClient()

    const { error } = await supabase.from('ticket_comments').insert({
      ticket_id: ticket.id,
      comment: newComment.trim(),
      created_by: profileName || null,
    })

    if (error) {
      toast.error('Failed to add comment')
      setSubmittingComment(false)
      return
    }

    setNewComment('')
    setSubmittingComment(false)
    toast.success('Comment added')
    fetchTicket()
  }

  const handleSaveResolution = async () => {
    if (!ticket) return
    const supabase = createClient()

    const { error } = await supabase
      .from('tickets')
      .update({ resolution_notes: resolutionNotes || null })
      .eq('id', ticket.id)

    if (error) {
      toast.error('Failed to save resolution notes')
      return
    }
    toast.success('Resolution notes saved')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!ticket) return null

  const statusCfg = TICKET_STATUS_CONFIG[ticket.status as TicketStatus] || TICKET_STATUS_CONFIG.open
  const priorityCfg = TICKET_PRIORITY_CONFIG[ticket.priority as TicketPriority] || TICKET_PRIORITY_CONFIG.medium
  const issueTypeCfg = TICKET_ISSUE_TYPE_CONFIG[ticket.issue_type as keyof typeof TICKET_ISSUE_TYPE_CONFIG]
  const isResolved = ticket.status === 'resolved' || ticket.status === 'closed'

  return (
    <div className="animate-fade-in pb-24 lg:pb-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/tickets')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm mb-4 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tickets
        </button>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900">{ticket.subject}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusCfg.bg} ${statusCfg.text}`}>
                {statusCfg.label}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${priorityCfg.bg} ${priorityCfg.text}`}>
                {priorityCfg.label}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-500 flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDateTime(ticket.created_at)}
              </span>
              {ticket.created_by && (
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {ticket.created_by}
                </span>
              )}
              {issueTypeCfg && (
                <span className="flex items-center gap-1">
                  <Wrench className="w-4 h-4" />
                  {issueTypeCfg.label}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Description</h3>
            <p className="text-slate-700 whitespace-pre-wrap">{ticket.description}</p>
          </div>

          {/* Resolution Notes */}
          {(isResolved || resolutionNotes) && (
            <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-6">
              <h3 className="text-sm font-semibold text-emerald-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Resolution Notes
              </h3>
              <textarea
                value={resolutionNotes}
                onChange={e => setResolutionNotes(e.target.value)}
                placeholder="Describe how this issue was resolved..."
                className="w-full border border-emerald-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white min-h-[100px] resize-y"
              />
              <button
                onClick={handleSaveResolution}
                className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition"
              >
                Save Notes
              </button>
            </div>
          )}

          {/* Activity Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-teal-600" />
              Activity
            </h3>

            {comments.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-6">No comments yet</p>
            ) : (
              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200" />
                <div className="space-y-4">
                  {comments.map(comment => {
                    const isSystem = comment.comment.startsWith('Status changed') || comment.comment.startsWith('Priority changed')
                    return (
                      <div key={comment.id} className="relative flex gap-4">
                        <div className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isSystem ? 'bg-slate-100 text-slate-500' : 'bg-teal-100 text-teal-600'
                        }`}>
                          {isSystem ? <Clock className="w-4 h-4" /> : <User className="w-4 h-4" />}
                        </div>
                        <div className={`flex-1 rounded-xl p-4 ${isSystem ? 'bg-slate-50' : 'bg-slate-50'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold text-slate-700">
                              {comment.created_by || 'System'}
                            </span>
                            <span className="text-xs text-slate-400">{formatRelativeTime(comment.created_at)}</span>
                          </div>
                          <p className={`text-sm ${isSystem ? 'text-slate-500 italic' : 'text-slate-700'} whitespace-pre-wrap`}>
                            {comment.comment}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Add Comment */}
            <div className="mt-6 border-t border-slate-100 pt-4">
              <div className="flex gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-teal-600" />
                </div>
                <div className="flex-1">
                  <textarea
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[80px] resize-y"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        handleAddComment()
                      }
                    }}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-slate-400">Cmd+Enter to submit</span>
                    <button
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || submittingComment}
                      className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                      {submittingComment ? 'Sending...' : 'Comment'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status & Priority Controls */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Manage</h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Status</label>
                <select
                  value={ticket.status}
                  onChange={e => handleStatusChange(e.target.value as TicketStatus)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {Object.entries(TICKET_STATUS_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Priority</label>
                <select
                  value={ticket.priority}
                  onChange={e => handlePriorityChange(e.target.value as TicketPriority)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {Object.entries(TICKET_PRIORITY_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Ticket Details */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Details</h3>
            <div className="space-y-3">
              {client && (
                <div>
                  <span className="text-xs text-slate-400">Client</span>
                  <Link
                    href={`/clients/${client.id}`}
                    className="block text-sm font-medium text-teal-600 hover:underline"
                  >
                    {client.name}
                  </Link>
                </div>
              )}
              {ticket.device_serial && (
                <div>
                  <span className="text-xs text-slate-400">Device Serial</span>
                  <p className="text-sm font-mono text-slate-700">{ticket.device_serial}</p>
                </div>
              )}
              <div>
                <span className="text-xs text-slate-400">Issue Type</span>
                <p className="text-sm text-slate-700">{issueTypeCfg?.label || ticket.issue_type}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">Created</span>
                <p className="text-sm text-slate-700">{formatDateTime(ticket.created_at)}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">Last Updated</span>
                <p className="text-sm text-slate-700">{formatDateTime(ticket.updated_at)}</p>
              </div>
              {ticket.resolved_at && (
                <div>
                  <span className="text-xs text-slate-400">Resolved</span>
                  <p className="text-sm text-emerald-700">{formatDateTime(ticket.resolved_at)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Quick Actions</h3>
            <div className="space-y-2">
              {!isResolved && (
                <button
                  onClick={() => handleStatusChange('resolved')}
                  className="w-full flex items-center gap-2 px-3 py-2.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Mark as Resolved
                </button>
              )}
              {ticket.status !== 'in_progress' && !isResolved && (
                <button
                  onClick={() => handleStatusChange('in_progress')}
                  className="w-full flex items-center gap-2 px-3 py-2.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition"
                >
                  <Wrench className="w-4 h-4" />
                  Start Working
                </button>
              )}
              {ticket.priority !== 'critical' && !isResolved && (
                <button
                  onClick={() => handlePriorityChange('critical')}
                  className="w-full flex items-center gap-2 px-3 py-2.5 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Escalate to Critical
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
