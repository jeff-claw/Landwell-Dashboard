'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ProjectLog, ProjectLogCategory, ProjectLogRelatedTo, ProjectLogStatus } from '@/lib/types'
import { 
  Plus, X, Search, Edit2, Trash2, Download, Archive,
  BookOpen, Tag, Calendar, ChevronDown, ChevronUp,
  Lightbulb, Wrench, Bug, MessageSquare, FileText, Link2
} from 'lucide-react'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'

// Category configuration
const CATEGORIES: { value: ProjectLogCategory; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'decision', label: 'Decision', icon: Lightbulb, color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 'feature', label: 'Feature', icon: Wrench, color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { value: 'bug', label: 'Bug', icon: Bug, color: 'bg-red-100 text-red-700 border-red-300' },
  { value: 'discussion', label: 'Discussion', icon: MessageSquare, color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'context', label: 'Context', icon: FileText, color: 'bg-purple-100 text-purple-700 border-purple-300' },
  { value: 'reference', label: 'Reference', icon: Link2, color: 'bg-slate-100 text-slate-700 border-slate-300' },
]

const RELATED_TO_OPTIONS: ProjectLogRelatedTo[] = [
  'General', 'Quotes', 'Orders', 'Invoices', 'Pipeline', 
  'Clients', 'Products', 'Reports', 'Technical', 'Integrations'
]

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

// Category Badge component
function CategoryBadge({ category }: { category: ProjectLogCategory | null }) {
  const cat = CATEGORIES.find(c => c.value === category)
  if (!cat) return null
  const Icon = cat.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cat.color}`}>
      <Icon className="w-3 h-3" />
      {cat.label}
    </span>
  )
}

// Tag component
function TagPill({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
      <Tag className="w-2.5 h-2.5" />
      {tag}
    </span>
  )
}

// Modal component
function Modal({ 
  open, 
  onClose, 
  title, 
  wide = false,
  children 
}: { 
  open: boolean
  onClose: () => void
  title: string
  wide?: boolean
  children: React.ReactNode 
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div 
        className={`bg-white rounded-2xl shadow-xl ${wide ? 'max-w-3xl' : 'max-w-lg'} w-full max-h-[90vh] overflow-hidden`} 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-60px)]">{children}</div>
      </div>
    </div>
  )
}

// Form state type
interface LogForm {
  title: string
  category: ProjectLogCategory | ''
  content: string
  tags: string
  related_to: ProjectLogRelatedTo | ''
  date: string
}

const getEmptyForm = (): LogForm => ({
  title: '',
  category: '',
  content: '',
  tags: '',
  related_to: '',
  date: new Date().toISOString().split('T')[0],
})

export default function ProjectLogPage() {
  const [logs, setLogs] = useState<ProjectLog[]>([])
  const [loading, setLoading] = useState(true)
  
  // Create/Edit modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingLog, setEditingLog] = useState<ProjectLog | null>(null)
  const [form, setForm] = useState<LogForm>(getEmptyForm())
  const [saving, setSaving] = useState(false)
  
  // Detail view
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  
  // Filters
  const [filterText, setFilterText] = useState('')
  const [filterCategory, setFilterCategory] = useState<ProjectLogCategory | 'all'>('all')
  const [filterRelatedTo, setFilterRelatedTo] = useState<ProjectLogRelatedTo | 'all'>('all')
  const [showArchived, setShowArchived] = useState(false)
  
  const supabase = createClient()
  
  const fetchLogs = useCallback(async () => {
    const { data, error } = await supabase
      .from('project_logs')
      .select('*')
      .order('date', { ascending: false })
    
    if (error) {
      console.error('Error fetching logs:', error)
      toast.error('Failed to fetch project logs')
    } else {
      setLogs(data || [])
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  useEffect(() => { fetchLogs() }, [fetchLogs])
  
  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Archived filter
      if (!showArchived && log.status === 'archived') return false
      if (showArchived && log.status !== 'archived') return false
      
      // Category filter
      if (filterCategory !== 'all' && log.category !== filterCategory) return false
      
      // Related to filter
      if (filterRelatedTo !== 'all' && log.related_to !== filterRelatedTo) return false
      
      // Text search
      if (filterText) {
        const search = filterText.toLowerCase()
        const matchesTitle = log.title?.toLowerCase().includes(search)
        const matchesContent = log.content?.toLowerCase().includes(search)
        const matchesTags = log.tags?.some(t => t.toLowerCase().includes(search))
        return matchesTitle || matchesContent || matchesTags
      }
      
      return true
    })
  }, [logs, filterCategory, filterRelatedTo, filterText, showArchived])
  
  // Toggle expanded
  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }
  
  // Open create modal
  const openCreateModal = () => {
    setEditingLog(null)
    setForm(getEmptyForm())
    setModalOpen(true)
  }
  
  // Open edit modal
  const openEditModal = (log: ProjectLog) => {
    setEditingLog(log)
    setForm({
      title: log.title,
      category: log.category || '',
      content: log.content,
      tags: log.tags?.join(', ') || '',
      related_to: log.related_to || '',
      date: log.date,
    })
    setModalOpen(true)
  }
  
  // Save log
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      toast.error('Title is required')
      return
    }
    if (!form.content.trim()) {
      toast.error('Content is required')
      return
    }
    
    setSaving(true)
    
    const tagsArray = form.tags
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0)
    
    const payload = {
      title: form.title.trim(),
      category: form.category || null,
      content: form.content.trim(),
      tags: tagsArray.length > 0 ? tagsArray : null,
      related_to: form.related_to || null,
      date: form.date,
      updated_at: new Date().toISOString(),
    }
    
    let error
    if (editingLog) {
      const result = await supabase
        .from('project_logs')
        .update(payload)
        .eq('id', editingLog.id)
      error = result.error
    } else {
      const result = await supabase
        .from('project_logs')
        .insert({ ...payload, status: 'active' })
      error = result.error
    }
    
    setSaving(false)
    
    if (error) {
      console.error('Error saving log:', error)
      toast.error('Failed to save entry')
      return
    }
    
    toast.success(editingLog ? 'Entry updated' : 'Entry created')
    setModalOpen(false)
    setEditingLog(null)
    setForm(getEmptyForm())
    fetchLogs()
  }
  
  // Archive log
  const archiveLog = async (log: ProjectLog) => {
    const newStatus: ProjectLogStatus = log.status === 'archived' ? 'active' : 'archived'
    const { error } = await supabase
      .from('project_logs')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', log.id)
    
    if (error) {
      console.error('Error archiving log:', error)
      toast.error('Failed to update status')
      return
    }
    
    toast.success(newStatus === 'archived' ? 'Entry archived' : 'Entry restored')
    fetchLogs()
  }
  
  // Delete log
  const deleteLog = async (log: ProjectLog) => {
    if (!confirm(`Delete "${log.title}"? This cannot be undone.`)) return
    
    const { error } = await supabase
      .from('project_logs')
      .delete()
      .eq('id', log.id)
    
    if (error) {
      console.error('Error deleting log:', error)
      toast.error('Failed to delete entry')
      return
    }
    
    toast.success('Entry deleted')
    fetchLogs()
  }
  
  // Export logs
  const exportLogs = () => {
    const exportData = filteredLogs.map(log => ({
      date: log.date,
      title: log.title,
      category: log.category,
      related_to: log.related_to,
      tags: log.tags?.join(', '),
      content: log.content,
      status: log.status,
    }))
    
    const json = JSON.stringify(exportData, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `project-log-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    
    toast.success(`Exported ${exportData.length} entries`)
  }
  
  // Export as markdown
  const exportMarkdown = () => {
    const md = filteredLogs.map(log => {
      const tags = log.tags?.length ? `Tags: ${log.tags.join(', ')}` : ''
      return `# ${log.title}\n\n**Date:** ${log.date} | **Category:** ${log.category || 'N/A'} | **Related to:** ${log.related_to || 'N/A'}\n${tags}\n\n${log.content}\n\n---\n`
    }).join('\n')
    
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `project-log-${new Date().toISOString().split('T')[0]}.md`
    a.click()
    URL.revokeObjectURL(url)
    
    toast.success(`Exported ${filteredLogs.length} entries as Markdown`)
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
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-teal-600" />
            Project Log
          </h1>
          <p className="text-slate-500 text-sm mt-1">Decisions, discussions, and context</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="w-4 h-4" />
              Export
              <ChevronDown className="w-3 h-3" />
            </button>
            <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-10 hidden group-hover:block">
              <button onClick={exportLogs} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50">
                Export JSON
              </button>
              <button onClick={exportMarkdown} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50">
                Export Markdown
              </button>
            </div>
          </div>
          <button onClick={exportLogs} className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Download className="w-4 h-4" /> JSON
          </button>
          <button onClick={exportMarkdown} className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Download className="w-4 h-4" /> MD
          </button>
          <button onClick={openCreateModal} className="btn-primary">
            <Plus className="w-4 h-4" />
            Add Entry
          </button>
        </div>
      </div>
      
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search logs..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as ProjectLogCategory | 'all')}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select
          value={filterRelatedTo}
          onChange={(e) => setFilterRelatedTo(e.target.value as ProjectLogRelatedTo | 'all')}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">All Areas</option>
          {RELATED_TO_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <label className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm cursor-pointer hover:bg-slate-50">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
          />
          <Archive className="w-4 h-4 text-slate-400" />
          Archived
        </label>
        {(filterCategory !== 'all' || filterRelatedTo !== 'all' || filterText) && (
          <button
            onClick={() => { setFilterCategory('all'); setFilterRelatedTo('all'); setFilterText('') }}
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>
      
      {/* Stats */}
      <div className="flex flex-wrap gap-3">
        {CATEGORIES.map(cat => {
          const count = logs.filter(l => l.category === cat.value && l.status !== 'archived').length
          if (count === 0) return null
          return (
            <button
              key={cat.value}
              onClick={() => setFilterCategory(filterCategory === cat.value ? 'all' : cat.value)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                filterCategory === cat.value 
                  ? cat.color + ' ring-2 ring-offset-1 ring-slate-400' 
                  : cat.color + ' opacity-70 hover:opacity-100'
              }`}
            >
              <cat.icon className="w-3.5 h-3.5" />
              {cat.label}
              <span className="bg-white/50 px-1.5 rounded-full">{count}</span>
            </button>
          )
        })}
      </div>
      
      {/* Log List */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 mb-3">
            {showArchived ? 'No archived entries' : 'No log entries found'}
          </p>
          {!showArchived && (
            <button onClick={openCreateModal} className="text-teal-600 font-medium hover:underline">
              + Add your first entry
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map(log => {
            const isExpanded = expandedIds.has(log.id)
            const preview = log.content.slice(0, 200)
            const hasMore = log.content.length > 200
            
            return (
              <div 
                key={log.id}
                className={`bg-white rounded-xl border transition-all ${
                  log.status === 'archived' 
                    ? 'border-slate-200 bg-slate-50 opacity-75' 
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                {/* Card Header */}
                <div className="p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <CategoryBadge category={log.category} />
                      {log.related_to && (
                        <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-100 rounded">
                          {log.related_to}
                        </span>
                      )}
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(log.date)}
                      </span>
                      {log.status === 'archived' && (
                        <span className="text-xs text-slate-400 px-2 py-0.5 bg-slate-200 rounded">
                          Archived
                        </span>
                      )}
                    </div>
                    <h3 
                      className="font-semibold text-slate-800 cursor-pointer hover:text-teal-600"
                      onClick={() => toggleExpanded(log.id)}
                    >
                      {log.title}
                    </h3>
                    {log.tags && log.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {log.tags.map((tag, i) => <TagPill key={i} tag={tag} />)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleExpanded(log.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                      title={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => openEditModal(log)}
                      className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => archiveLog(log)}
                      className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                      title={log.status === 'archived' ? 'Restore' : 'Archive'}
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteLog(log)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Content Preview / Full */}
                <div 
                  className={`px-4 pb-4 text-sm text-slate-600 ${isExpanded ? '' : 'line-clamp-3'}`}
                  onClick={() => !isExpanded && toggleExpanded(log.id)}
                >
                  {isExpanded ? (
                    <div className="prose prose-sm prose-slate max-w-none">
                      <ReactMarkdown>{log.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="cursor-pointer">
                      {preview}{hasMore && '...'}
                      {hasMore && <span className="text-teal-600 ml-1 font-medium">Read more</span>}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      
      {/* Create/Edit Modal */}
      <Modal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        title={editingLog ? 'Edit Entry' : 'Add Entry'} 
        wide
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Dashboard Rebuild Decision"
              value={form.title}
              onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          
          {/* Category & Related To */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm(f => ({ ...f, category: e.target.value as ProjectLogCategory | '' }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select category...</option>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Related To</label>
              <select
                value={form.related_to}
                onChange={(e) => setForm(f => ({ ...f, related_to: e.target.value as ProjectLogRelatedTo | '' }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select area...</option>
                {RELATED_TO_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          
          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Content <span className="text-red-500">*</span>
              <span className="text-slate-400 font-normal ml-2">(Markdown supported)</span>
            </label>
            <textarea
              required
              rows={10}
              placeholder="## Summary&#10;Write your notes here...&#10;&#10;## Details&#10;- Point 1&#10;- Point 2"
              value={form.content}
              onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
            />
          </div>
          
          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tags
              <span className="text-slate-400 font-normal ml-2">(comma-separated)</span>
            </label>
            <input
              type="text"
              placeholder="e.g., technical, architecture, decision"
              value={form.tags}
              onChange={(e) => setForm(f => ({ ...f, tags: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          
          {/* Preview */}
          {form.content && (
            <div className="bg-slate-50 rounded-xl p-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Preview
              </label>
              <div className="prose prose-sm prose-slate max-w-none bg-white rounded-lg p-3 border border-slate-200">
                <ReactMarkdown>{form.content}</ReactMarkdown>
              </div>
            </div>
          )}
          
          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button 
              type="button" 
              onClick={() => setModalOpen(false)} 
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : (editingLog ? 'Update Entry' : 'Create Entry')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
