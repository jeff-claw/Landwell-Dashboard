import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { getServiceClient } from '@/lib/supabase'
import {
  PARTNER_ISSUE_STATUS_CONFIG,
  PARTNER_ISSUE_PRIORITY_CONFIG,
  isPartnerIssueOverdue,
  partnerIssueDaysOpen,
} from '@/lib/types'
import type { PartnerIssue } from '@/lib/types'

// Regenerates LANDWELL Beijing's own workbook from our database, column for
// column, so they can keep their process (and later their Lark Base) without us
// giving up the source record. Columns A-S match their layout exactly; our
// added evidence columns (T-X) are appended after theirs so nothing shifts.

const HEADERS = [
  '编号\nID',
  '提出日期\nDate Raised',
  '类别\nCategory',
  '客户/站点\nAccount/Site',
  '产品/模块\nProduct/Module',
  '问题描述（中文）\nIssue Description (CN)',
  'Issue Description (English)\n问题描述（英文）',
  '业务影响\nBusiness Impact',
  '证据/附件\nEvidence',
  '优先级\nPriority',
  'LANDWELL 责任人\nLANDWELL Owner',
  '南非方责任人\nDistributor Owner',
  '下一步行动（双语）\nNext Action (Bilingual)',
  '目标日期\nTarget Date',
  '状态\nStatus',
  '根因\nRoot Cause',
  '解决方案\nSolution',
  '验证/关闭证据\nVerification / Closure Evidence',
  '最近更新\nLast Update',
  // Ours, appended so their sheet is unchanged up to column S.
  '开放天数\nDays Open',
  '延期次数\nTimes Deferred',
  '停机小时\nDowntime (h)',
  '现场出勤\nSite Visits',
  '成本 ZAR\nCost (ZAR)',
]

const COL_WIDTHS = [10, 13, 14, 22, 20, 34, 34, 22, 24, 10, 18, 18, 34, 13, 16, 22, 22, 26, 13, 11, 11, 11, 11, 13]

const HEADER_FILL = 'FF1F6F5C'
const TITLE_COLOR = 'FF1F6F5C'

function ymd(d: Date) {
  return d.toISOString().slice(0, 10)
}

export async function GET() {
  try {
    const admin = getServiceClient()

    const [issuesRes, clientsRes, evidenceRes] = await Promise.all([
      admin.from('partner_issues').select('*').order('ref', { ascending: true }),
      admin.from('clients').select('id, name'),
      admin.from('partner_issue_evidence').select('issue_id, file_name'),
    ])

    if (issuesRes.error) {
      return NextResponse.json({ error: issuesRes.error.message }, { status: 500 })
    }

    const issues = (issuesRes.data || []) as PartnerIssue[]
    const clientMap = new Map((clientsRes.data || []).map(c => [c.id, c.name]))

    // Their "Evidence" column is free text; list the attachment filenames so the
    // exported sheet points at what we hold.
    const evidenceMap = new Map<string, string[]>()
    for (const e of evidenceRes.data || []) {
      const list = evidenceMap.get(e.issue_id) || []
      list.push(e.file_name)
      evidenceMap.set(e.issue_id, list)
    }

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Landwell Africa'
    wb.created = new Date()

    // ------------------------------------------------- Sheet 1: Issue Log
    const ws = wb.addWorksheet('问题跟进 Issue Log', {
      views: [{ state: 'frozen', ySplit: 7 }],
    })

    ws.mergeCells('A1:S1')
    ws.getCell('A1').value = 'LANDWELL · 南非市场联合问题汇总 / South Africa Joint Issue Tracker'
    ws.getCell('A1').font = { bold: true, size: 14, color: { argb: TITLE_COLOR } }

    ws.mergeCells('A2:S2')
    ws.getCell('A2').value =
      '用途 / Purpose: 双方实时记录、月度复盘、验证关闭 | Joint logging, monthly review and verified closure'
    ws.getCell('A2').font = { size: 10, color: { argb: 'FF666666' } }

    // Counters. Beijing's original workbook pointed these at columns O and P,
    // which are Target Date and Root Cause — so their Closed count was always 0.
    // Repointed at N (target date) and O (status), which is where the data is.
    const lastRow = 7 + Math.max(issues.length, 1) + 200
    ws.getCell('A3').value = '开放项 / Open'
    ws.getCell('B3').value = { formula: `COUNTIFS($O$8:$O$${lastRow},"<>",$O$8:$O$${lastRow},"<>Verified Closed")` }
    ws.getCell('D3').value = '高优先级 / High'
    ws.getCell('E3').value = { formula: `COUNTIF($J$8:$J$${lastRow},"High")` }
    ws.getCell('G3').value = '逾期 / Overdue'
    ws.getCell('H3').value = {
      formula: `COUNTIFS($N$8:$N$${lastRow},"<"&TODAY(),$N$8:$N$${lastRow},"<>",$O$8:$O$${lastRow},"<>Verified Closed")`,
    }
    ws.getCell('J3').value = '已关闭 / Closed'
    ws.getCell('K3').value = { formula: `COUNTIF($O$8:$O$${lastRow},"Verified Closed")` }
    for (const c of ['A3', 'D3', 'G3', 'J3']) ws.getCell(c).font = { bold: true, size: 10 }

    ws.mergeCells('A4:S4')
    ws.getCell('A4').value =
      '请在每月会议前至少 2 个工作日更新。关闭前必须填写"验证/关闭证据"。 / Update at least 2 business days before each monthly meeting. Verification evidence is required before closure.'
    ws.getCell('A4').font = { size: 9, italic: true, color: { argb: 'FF888888' } }

    ws.mergeCells('A5:S5')
    ws.getCell('A5').value =
      `生成时间 / Generated: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · 数据源 / Source of record: Landwell Africa dashboard`
    ws.getCell('A5').font = { size: 9, color: { argb: 'FF888888' } }

    const headerRow = ws.getRow(7)
    headerRow.values = HEADERS
    headerRow.height = 34
    headerRow.eachCell(cell => {
      cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' },
      }
    })

    COL_WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w })

    issues.forEach(issue => {
      const nextAction = [issue.next_action_cn, issue.next_action_en].filter(Boolean).join(' / ')
      const statusCfg = PARTNER_ISSUE_STATUS_CONFIG[issue.status]
      const priorityCfg = PARTNER_ISSUE_PRIORITY_CONFIG[issue.priority]
      const evidenceNames = evidenceMap.get(issue.id) || []

      const row = ws.addRow([
        issue.ref,
        issue.raised_on,
        issue.category,
        clientMap.get(issue.client_id || '') || issue.site,
        issue.product_module,
        issue.description_cn,
        issue.description_en,
        issue.business_impact,
        evidenceNames.length ? evidenceNames.join('; ') : '',
        priorityCfg?.label || issue.priority,
        issue.landwell_owner,
        issue.distributor_owner,
        nextAction,
        issue.target_date || '',
        statusCfg?.label || issue.status,
        issue.root_cause,
        issue.solution,
        issue.closure_evidence,
        ymd(new Date(issue.updated_at)),
        partnerIssueDaysOpen(issue),
        issue.times_deferred,
        Number(issue.downtime_hours),
        issue.site_visits,
        Number(issue.cost_zar),
      ])

      row.alignment = { vertical: 'top', wrapText: true }
      row.font = { size: 9 }

      // Overdue rows are shaded so the meeting starts on the right items.
      if (isPartnerIssueOverdue(issue)) {
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE8E8' } }
        })
      }
    })

    ws.autoFilter = { from: { row: 7, column: 1 }, to: { row: 7, column: HEADERS.length } }

    // -------------------------------------------- Sheet 2: Monthly Review
    const mr = wb.addWorksheet('月度会议 Monthly Review')
    mr.mergeCells('A1:K1')
    mr.getCell('A1').value = 'LANDWELL · 月度问题复盘 / Monthly Issue Review'
    mr.getCell('A1').font = { bold: true, size: 14, color: { argb: TITLE_COLOR } }
    mr.mergeCells('A2:K2')
    mr.getCell('A2').value =
      '每月一行；会前完成数据更新，会中记录结论，会后确认下一次会议。 / One row per month: update before, record decisions during, confirm next meeting after.'
    mr.getCell('A2').font = { size: 10, color: { argb: 'FF666666' } }

    const mrHeaders = [
      '月份\nMonth', '会议日期\nMeeting Date', '时区\nTimezone', '参会人\nAttendees',
      '开放项\nOpen', '新增\nNew', '已关闭\nClosed', '逾期\nOverdue',
      '重点决策与行动（双语）\nKey Decisions & Actions', '下次会议\nNext Meeting', '纪要/链接\nMinutes / Link',
    ]
    const mrHead = mr.getRow(4)
    mrHead.values = mrHeaders
    mrHead.height = 32
    mrHead.eachCell(cell => {
      cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    })
    ;[12, 14, 22, 24, 10, 10, 10, 10, 40, 16, 22].forEach((w, i) => { mr.getColumn(i + 1).width = w })

    const now = new Date()
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const openCount = issues.filter(i => i.status !== 'verified_closed').length
    const closedCount = issues.filter(i => i.status === 'verified_closed').length
    const overdueCount = issues.filter(isPartnerIssueOverdue).length
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const newCount = issues.filter(i => new Date(i.raised_on) >= monthStart).length

    mr.addRow([
      monthKey, '', 'SAST (UTC+2) / CST (UTC+8)', '',
      openCount, newCount, closedCount, overdueCount, '', '', '',
    ])

    // ------------------------------------------------ Sheet 3: Instructions
    const ins = wb.addWorksheet('填写说明 Instructions')
    ins.mergeCells('A1:D1')
    ins.getCell('A1').value = 'LANDWELL · 填写说明 / Instructions'
    ins.getCell('A1').font = { bold: true, size: 14, color: { argb: TITLE_COLOR } }
    ;[26, 46, 46, 20].forEach((w, i) => { ins.getColumn(i + 1).width = w })

    const rules: [string, string, string][] = [
      ['1. 责任 / Ownership', '记录由 Landwell Africa 维护；双方均可提出新增与更新。', 'The record is maintained by Landwell Africa; either party may raise or update items.'],
      ['2. 会前 / Before meeting', '至少提前 2 个工作日更新状态、证据、下一步和日期。', 'Update status, evidence, next action and dates at least 2 business days in advance.'],
      ['3. 会中 / During meeting', '优先讨论 Critical/High、逾期、阻塞运营和需双方决策的事项。', 'Prioritize Critical/High, overdue, operationally blocking and joint-decision items.'],
      ['4. 关闭 / Closure', '必须完成实施、现场/客户验证并填写关闭证据，才可关闭。', 'Closure requires implementation, site/customer verification and recorded evidence.'],
      ['5. 表述 / Wording', '一个问题一行；描述事实和影响，不把假设写成根因。', 'One issue per row; record facts and impact, and do not state assumptions as root cause.'],
      ['6. 附件 / Evidence', '照片、视频、序列号和日志保存在 Landwell Africa 系统中，本表列出文件名。', 'Photos, video, serial numbers and logs are held in the Landwell Africa system; this sheet lists the filenames.'],
      ['7. 月会 / Monthly review', '原则上每月一次；日期和时区由双方确认。', 'In principle monthly; date and timezone are mutually confirmed.'],
      ['8. 升级 / Escalation', '连续两次月会未关闭的问题，升级至双方指定负责人。', 'Items open after two consecutive monthly reviews escalate to named executives on both sides.'],
      ['9. 版本 / Version', '本表由 Landwell Africa 系统按月生成，为当期只读快照。', 'This workbook is generated monthly from the Landwell Africa system and is a read-only snapshot of that date.'],
    ]

    ins.addRow([])
    const insHead = ins.addRow(['项目 / Item', '说明（中文）', 'Description (English)'])
    insHead.eachCell(cell => {
      cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
      cell.alignment = { vertical: 'middle', wrapText: true }
    })
    rules.forEach(r => {
      const row = ins.addRow(r)
      row.alignment = { vertical: 'top', wrapText: true }
      row.font = { size: 9 }
    })

    const buffer = await wb.xlsx.writeBuffer()
    const filename = `LANDWELL_南非市场月度问题汇总表_中英文_${ymd(new Date())}.xlsx`

    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
