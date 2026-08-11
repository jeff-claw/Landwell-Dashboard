import { notFound } from 'next/navigation'
import { getServiceClient } from '@/lib/supabase'
import {
  PARTNER_ISSUE_STATUS_CONFIG,
  PARTNER_ISSUE_PRIORITY_CONFIG,
  isPartnerIssueOverdue,
  partnerIssueDaysOpen,
} from '@/lib/types'
import type { PartnerIssue, PartnerIssueUpdate } from '@/lib/types'

// Read-only bilingual view of the joint tracker for LANDWELL Beijing.
// No login: the token in the URL is the credential, and it can be revoked from
// the dashboard. Nothing on this page can write to the record.

export const dynamic = 'force-dynamic'

const SIDE_LABEL: Record<string, string> = {
  distributor: 'Landwell Africa 南非方',
  landwell: 'LANDWELL 北京',
  internal: 'Internal',
}

function formatDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function PartnerViewPage({
  params,
}: {
  params: { token: string }
}) {
  const admin = getServiceClient()

  const { data: link } = await admin
    .from('partner_links')
    .select('*')
    .eq('token', params.token)
    .maybeSingle()

  if (!link || !link.active) notFound()
  if (link.expires_at && new Date(link.expires_at) < new Date()) notFound()

  // Count the view so we know whether Beijing is actually reading the tracker.
  await admin
    .from('partner_links')
    .update({ view_count: (link.view_count || 0) + 1, last_viewed_at: new Date().toISOString() })
    .eq('id', link.id)

  const [issuesRes, clientsRes, updatesRes] = await Promise.all([
    admin.from('partner_issues').select('*').order('ref', { ascending: true }),
    admin.from('clients').select('id, name'),
    admin.from('partner_issue_updates').select('*').order('created_at', { ascending: true }),
  ])

  const issues = (issuesRes.data || []) as PartnerIssue[]
  const clientMap = new Map((clientsRes.data || []).map(c => [c.id, c.name]))
  const updatesByIssue = new Map<string, PartnerIssueUpdate[]>()
  for (const u of (updatesRes.data || []) as PartnerIssueUpdate[]) {
    const list = updatesByIssue.get(u.issue_id) || []
    list.push(u)
    updatesByIssue.set(u.issue_id, list)
  }

  const live = issues.filter(i => i.status !== 'verified_closed')
  const stats = {
    open: live.length,
    high: live.filter(i => i.priority === 'critical' || i.priority === 'high').length,
    overdue: issues.filter(isPartnerIssueOverdue).length,
    closed: issues.filter(i => i.status === 'verified_closed').length,
  }

  const sorted = [...issues].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
    const p = (order[a.priority] ?? 2) - (order[b.priority] ?? 2)
    return p !== 0 ? p : (a.ref || '').localeCompare(b.ref || '')
  })

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-wider text-teal-700 uppercase">
                LANDWELL · South Africa Partner
              </p>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">
                南非市场联合问题汇总
              </h1>
              <p className="text-lg text-slate-600">South Africa Joint Issue Tracker</p>
            </div>
            <div className="text-sm text-slate-500 md:text-right">
              <div>只读视图 / Read-only view</div>
              <div>
                更新于 / Updated{' '}
                {new Date().toLocaleString('en-ZA', {
                  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-4 border-t border-slate-100 pt-3">
            本记录由 Landwell Africa 维护，为双方共同底稿。如需补充或提出异议，请通过月度会议或邮件提交，我们会原文记入问题的更新记录。
            <br />
            This record is maintained by Landwell Africa as the shared working copy. To add information or register a
            disagreement, submit it at the monthly review or by email and it will be recorded verbatim in the issue&apos;s
            update log.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-sm text-slate-500">开放项 / Open</div>
            <div className="text-3xl font-bold text-slate-900 mt-1">{stats.open}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-sm text-slate-500">高优先级 / High</div>
            <div className="text-3xl font-bold text-orange-600 mt-1">{stats.high}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-sm text-slate-500">逾期 / Overdue</div>
            <div className="text-3xl font-bold text-red-600 mt-1">{stats.overdue}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-sm text-slate-500">已关闭 / Closed</div>
            <div className="text-3xl font-bold text-emerald-600 mt-1">{stats.closed}</div>
          </div>
        </div>

        {/* Issues */}
        <div className="space-y-4">
          {sorted.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
              暂无记录 / No issues logged
            </div>
          )}

          {sorted.map(issue => {
            const statusCfg = PARTNER_ISSUE_STATUS_CONFIG[issue.status]
            const priorityCfg = PARTNER_ISSUE_PRIORITY_CONFIG[issue.priority]
            const overdue = isPartnerIssueOverdue(issue)
            const updates = updatesByIssue.get(issue.id) || []

            return (
              <div
                key={issue.id}
                className={`bg-white rounded-xl border p-5 ${overdue ? 'border-red-300' : 'border-slate-200'}`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-slate-500">{issue.ref}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}>
                        {statusCfg.labelCn} / {statusCfg.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityCfg.bg} ${priorityCfg.text}`}>
                        {priorityCfg.labelCn} / {priorityCfg.label}
                      </span>
                      {overdue && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          逾期 / Overdue
                        </span>
                      )}
                      {issue.times_deferred > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          延期 / Deferred ×{issue.times_deferred}
                        </span>
                      )}
                    </div>

                    {issue.description_cn && (
                      <p className="text-base font-semibold text-slate-900 mt-2">{issue.description_cn}</p>
                    )}
                    <p className="text-sm text-slate-700 mt-1">{issue.description_en}</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100 text-sm">
                  <div>
                    <div className="text-xs text-slate-400">客户/站点 / Account</div>
                    <div className="text-slate-800">{clientMap.get(issue.client_id || '') || issue.site || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">产品/模块 / Module</div>
                    <div className="text-slate-800">{issue.product_module || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">目标日期 / Target</div>
                    <div className={overdue ? 'text-red-600 font-medium' : 'text-slate-800'}>
                      {formatDate(issue.target_date)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">开放天数 / Days Open</div>
                    <div className="text-slate-800">{partnerIssueDaysOpen(issue)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">LANDWELL 责任人 / Owner</div>
                    <div className="text-slate-800">{issue.landwell_owner || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">南非方责任人 / Distributor Owner</div>
                    <div className="text-slate-800">{issue.distributor_owner || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">停机 / Downtime</div>
                    <div className="text-slate-800">{Number(issue.downtime_hours).toFixed(1)} h</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">现场出勤 / Site Visits</div>
                    <div className="text-slate-800">{issue.site_visits}</div>
                  </div>
                </div>

                {(issue.next_action_cn || issue.next_action_en) && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="text-xs text-slate-400 mb-1">下一步行动 / Next Action</div>
                    {issue.next_action_cn && <p className="text-sm text-slate-800">{issue.next_action_cn}</p>}
                    {issue.next_action_en && <p className="text-sm text-slate-600">{issue.next_action_en}</p>}
                  </div>
                )}

                {(issue.root_cause || issue.solution || issue.closure_evidence) && (
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-sm">
                    {issue.root_cause && (
                      <div>
                        <span className="text-xs text-slate-400">根因 / Root cause: </span>
                        <span className="text-slate-800">{issue.root_cause}</span>
                      </div>
                    )}
                    {issue.solution && (
                      <div>
                        <span className="text-xs text-slate-400">解决方案 / Solution: </span>
                        <span className="text-slate-800">{issue.solution}</span>
                      </div>
                    )}
                    {issue.closure_evidence && (
                      <div>
                        <span className="text-xs text-slate-400">验证/关闭证据 / Closure evidence: </span>
                        <span className="text-slate-800">{issue.closure_evidence}</span>
                      </div>
                    )}
                  </div>
                )}

                {updates.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                    <div className="text-xs text-slate-400">更新记录 / Update log</div>
                    {updates.map(u => (
                      <div key={u.id} className="text-sm bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <span className="text-xs font-semibold text-slate-600">
                            {SIDE_LABEL[u.author_side] || u.author_side}
                            {u.author_name && ` · ${u.author_name}`}
                          </span>
                          <span className="text-xs text-slate-400">{formatDate(u.created_at)}</span>
                        </div>
                        <p className="text-slate-800 whitespace-pre-wrap">{u.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-center text-xs text-slate-400 py-6">
          CONFIDENTIAL · Landwell Africa · {link.label}
        </p>
      </div>
    </div>
  )
}
