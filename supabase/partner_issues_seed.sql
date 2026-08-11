-- Seed: the ten issues LANDWELL Beijing raised in the 2026-08-07 meeting.
-- Run AFTER supabase/partner_issues.sql. Safe to re-run: matches on ref.
--
-- Descriptions are transcribed from their workbook. Target dates are
-- deliberately left NULL for the items they own — their sheet had none, and the
-- blanks are the point: every one of these should get a date agreed at the
-- first monthly review, after which any change is counted as a deferral.

INSERT INTO public.partner_issues
  (ref, raised_on, category, site, product_module,
   description_cn, description_en, business_impact, priority,
   landwell_owner, distributor_owner, next_action_cn, next_action_en, status)
VALUES
  ('ZA-001', '2026-08-07', 'Hardware', 'Scania (site to confirm)', 'Android terminal / screen',
   '安卓屏/终端不可用，影响钥匙领取和现场运营。',
   'Android screen/terminal becomes unavailable, affecting key release and site operations.',
   'Critical operational interruption', 'high',
   'Hardware / Supply Chain', 'Distributor technical team',
   '返件检测；比较替代屏、CPU/Android 版本与模块化方案。',
   'Return unit for inspection; compare alternative screen, CPU/Android version and modular design.',
   'awaiting_landwell'),

  ('ZA-002', '2026-08-07', 'Network', 'Approx. 7-8 customers (list to confirm)', 'Android terminal / network',
   'Wi-Fi 或有线连接反复中断，部分现场需重启安卓系统。',
   'Recurring Wi-Fi or wired interruptions; some sites require Android-system resets.',
   'System downtime and field-service cost', 'high',
   'Software / Technical Support', 'Distributor technical team',
   '优先采用 TCP/IP；增加连接状态、快速报错、日志导出和远程诊断。',
   'Prioritize TCP/IP; add connection status, rapid error reporting, log export and remote diagnostics.',
   'open'),

  ('ZA-003', '2026-08-07', 'Software', 'South Africa market', 'Customized software',
   '需区分缺陷、定制需求和培训问题，并逐项给出可行性、负责人和周期。',
   'Separate defects, customization requests and training questions, with feasibility, owner and timeline for each item.',
   'Impacts acceptance and scalable rollout', 'high',
   'Software Project Owner', 'Distributor project owner',
   '统一清单并由工程师逐项回复。',
   'Consolidate one list and provide item-by-item engineering responses.',
   'awaiting_landwell'),

  ('ZA-004', '2026-08-07', 'Product Design', 'Mining - above ground', 'Mining key cabinet',
   '地上矿区存在干扰、高湿、粉尘、腐蚀等环境风险。',
   'Above-ground mining sites may involve interference, humidity, dust and corrosion.',
   'Reliability and maintenance risk', 'medium',
   'Product / R&D', 'Distributor / pilot customer',
   '定义试点并评估抗干扰、防腐涂层和模块化。',
   'Define pilot and assess interference resistance, protective coating and modularity.',
   'open'),

  ('ZA-005', '2026-08-07', 'Compliance', 'Mining - underground', 'Mining key cabinet',
   '地下矿区可能需要防爆认证；当前方案不能直接适用。',
   'Underground mines may require explosion-proof certification; the current solution is not directly applicable.',
   'Safety and compliance risk', 'high',
   'Compliance / Product', 'Distributor / end user',
   '先确认适用法规及认证边界，再决定是否立项。',
   'Confirm regulations and certification boundary before project approval.',
   'open'),

  ('ZA-006', '2026-08-07', 'Network', 'Mining sites', '4G module',
   '评估 4G 作为 TCP/IP 的备选或冗余连接，但尚无标准配置。',
   'Evaluate 4G as an alternative or redundant connection to TCP/IP; no standard configuration exists yet.',
   'May reduce site visits; still exposed to carrier coverage', 'medium',
   'Hardware + Software', 'Distributor technical team',
   '比较 4G、TCP/IP 和组合方案的稳定性、成本及远程维护。',
   'Compare 4G, TCP/IP and hybrid solutions for stability, cost and remote support.',
   'open'),

  ('ZA-007', '2026-08-07', 'After-sales', 'South Africa installed base', 'Support process',
   '现场问题缺少统一的远程诊断和快速维修流程。',
   'No standardized remote-diagnostic and rapid-repair workflow for field issues.',
   'Long downtime and avoidable travel cost', 'high',
   'Technical Support', 'Distributor technical team',
   '建立分级排查、远程访问、备件与升级机制。',
   'Establish tiered troubleshooting, remote access, spares and escalation.',
   'open'),

  ('ZA-008', '2026-08-07', 'Commercial', 'Priority accounts', 'Rollout plan',
   '重点客户拓展需以稳定版本、试点验收和可重复交付为前提。',
   'Priority-account expansion should depend on a stable version, pilot acceptance and repeatable delivery.',
   'Revenue opportunity and reputational risk', 'medium',
   'Sales + Project', 'Distributor sales',
   '双方确定试点、验收、扩展的阶段门槛。',
   'Agree stage gates for pilot, acceptance and expansion.',
   'open'),

  ('ZA-009', '2026-08-07', 'Delivery', 'South Africa market', 'Forecast / stock / lead time',
   '在确认库存、产能和软件周期前，避免对客户过度承诺。',
   'Avoid customer overcommitment before stock, capacity and software lead times are confirmed.',
   'Delivery credibility and customer trust', 'medium',
   'Operations / Sales', 'Distributor sales',
   '南非方提前滚动预测；LANDWELL 及时确认可交付性。',
   'Distributor provides rolling forecast; LANDWELL confirms feasibility promptly.',
   'open'),

  ('ZA-010', '2026-08-07', 'Governance', 'Both teams', 'Monthly review',
   '邮件和即时消息易造成信息遗漏，需要统一问题台账和月度会议。',
   'Emails and instant messages may lead to lost information; one tracker and monthly review are required.',
   'Slow decisions and repeated discussion', 'high',
   'Project Owner', 'Distributor project owner',
   '每月会前更新；会议中记录决策；验证后关闭。',
   'Update before meeting, record decisions, close after verification.',
   'in_progress')
ON CONFLICT (ref) DO NOTHING;

-- Record where these came from, so the history starts clean and the missing
-- target dates are on the file from day one rather than argued about later.
INSERT INTO public.partner_issue_updates (issue_id, author_side, author_name, body, source)
SELECT id, 'internal', 'Landwell Africa',
       'Logged from the 2026-08-07 meeting minutes (v1.0, 2026-08-10). No target date was set by LANDWELL for this item; a date is to be agreed at the first monthly review.',
       'meeting'
FROM public.partner_issues p
WHERE p.ref IN ('ZA-001','ZA-002','ZA-003','ZA-004','ZA-005','ZA-006','ZA-007','ZA-008','ZA-009','ZA-010')
  AND NOT EXISTS (
    SELECT 1 FROM public.partner_issue_updates u WHERE u.issue_id = p.id
  );
