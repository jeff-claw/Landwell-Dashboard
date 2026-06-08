export type UserRole = 'founder' | 'admin' | 'sales_rep' | 'viewer' | 'hr'
export type UserStatus = 'pending' | 'approved' | 'rejected'
export type ClientType = 'reseller' | 'end_user'
export type PipelineStatus =
  | 'lead_generated'
  | 'qualification'
  | 'meeting_scheduled'
  | 'demo'
  | 'proposal_sent'
  | 'po_received'
  | 'closed_won'
  | 'closed_lost'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  status: UserStatus
  created_at: string
  page_access?: string[] | null
}

export interface Client {
  id: string
  name: string
  type: string
  contact_person: string
  email: string
  phone: string
  vat_number: string
  address: string
  notes: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface PipelineDeal {
  id: string
  client_id: string
  client_name: string
  title: string
  value: number
  status: string
  notes: string
  assigned_to: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface QuoteLineItem {
  product: string
  description: string
  qty: number
  unitPrice: number
  currency: 'USD' | 'ZAR'  // Per-line-item currency
  image?: string | null
}

export interface Quote {
  id: string
  quote_number: string
  client_id: string
  client_name: string
  client_contact: string
  client_email: string
  client_vat: string
  client_type: string
  project_title: string
  date: string
  due_date: string
  status: string
  currency: string
  region: string
  include_installation: boolean
  discount: number
  discount_type: string
  notes: string
  line_items: QuoteLineItem[]
  created_by: string
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  order_number: string
  quote_id: string
  client_id: string
  client_name: string
  status: string
  value_zar: number
  value_usd: number
  notes: string
  china_order_no: string
  invoice_no: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  order_id: string
  client_id: string
  client_name: string
  amount: number
  payment_date: string
  payment_method: string
  reference: string
  notes: string
  created_by: string
  created_at: string
}

export interface Task {
  id: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'todo' | 'in_progress' | 'done'
  due_date: string
  client_id: string
  client_name: string
  completed: boolean
  assigned_to: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface CalendarEvent {
  id: string
  title: string
  description: string
  date: string
  start_time: string
  end_time: string
  event_type: string
  client_id: string
  client_name: string
  created_by: string
  teams_link: string
  created_at: string
  updated_at: string
}

export interface PricelistItem {
  id: string
  product_name: string
  category: string
  usd_price: number
  description: string
  image_url: string
  created_at: string
  updated_at: string
}

export interface Formula {
  id: string
  exchange_rate: number
  exchange_rate_updated_at: string | null
  exchange_rate_source: 'auto' | 'manual' | null
  shipping_multiplier: number
  gp_divisor: number
  delivery_percent: number
  end_user_divisor: number
  region_markups: Record<string, number>
  updated_at: string
  updated_by: string | null
}

// Phase 2 Types

export interface PaymentRecord {
  id: string
  order_id: string
  amount: number
  payment_date: string
  method: string
  reference: string
  notes: string
  created_at: string
  created_by: string
  // Joined fields
  order_number?: string
  client_name?: string
}

export interface StockItem {
  id: string
  sku: string
  name: string
  quantity: number
  reorder_point: number
  last_restocked_at: string | null
  created_at: string
  updated_at: string
  // Pricing fields (merged from pricelist)
  category: string | null
  usd_price: number | null
  description: string | null
  image_url: string | null
  active: boolean
  // Currency: USD or ZAR (default ZAR)
  currency: 'USD' | 'ZAR' | null
}

export interface StockMovement {
  id: string
  stock_item_id: string
  quantity_change: number
  reason: string
  reference: string
  created_at: string
  created_by: string
  // Joined fields
  stock_item_name?: string
}

export interface Reminder {
  id: string
  user_id: string
  type: 'quote_followup' | 'pipeline_stale' | 'task_overdue' | 'custom'
  title: string
  description: string
  due_date: string
  reference_type: 'quote' | 'pipeline' | 'task' | 'client' | null
  reference_id: string | null
  status: 'pending' | 'snoozed' | 'dismissed' | 'completed'
  snoozed_until: string | null
  created_at: string
}

export type ShipmentStatus = 
  | 'pending'
  | 'order_placed' 
  | 'china_confirmed' 
  | 'in_production' 
  | 'shipped' 
  | 'in_transit' 
  | 'customs' 
  | 'delivered'

export interface OrderWithShipping extends Order {
  china_order_number?: string
  shipment_status?: ShipmentStatus
  ship_date?: string
  eta?: string
  tracking_number?: string
  customs_cleared_date?: string
  vessel_flight?: string
}

// Accounts Payable Types
export interface Supplier {
  id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  payment_terms: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SupplierInvoice {
  id: string
  supplier_id: string
  invoice_number: string | null
  invoice_date: string
  due_date: string | null
  amount: number
  currency: string
  status: 'pending' | 'partial' | 'paid' | 'overdue'
  amount_paid: number
  description: string | null
  reference: string | null
  created_at: string
  updated_at: string
  // Joined fields
  supplier_name?: string
}

export interface SupplierPayment {
  id: string
  supplier_invoice_id: string
  amount: number
  payment_date: string
  method: string | null
  reference: string | null
  notes: string | null
  created_at: string
  created_by: string | null
}

// Invoice Types
export interface InvoiceLineItem {
  product: string
  description?: string
  qty: number
  unitPrice: number
}

export interface Invoice {
  id: string
  invoice_number: string
  order_id: string | null
  quote_id: string | null
  client_id: string | null
  client_name: string
  client_email: string | null
  client_address: string | null
  client_vat: string | null
  invoice_date: string
  due_date: string | null
  status: 'unpaid' | 'partial' | 'paid' | 'overdue' | 'cancelled'
  subtotal: number
  discount: number
  vat_amount: number
  total: number
  amount_paid: number
  line_items: InvoiceLineItem[]
  notes: string | null
  payment_terms: string
  created_at: string
  created_by: string | null
  updated_at: string
}

// Project Log Types
export type ProjectLogCategory = 'decision' | 'feature' | 'bug' | 'discussion' | 'context' | 'reference'
export type ProjectLogRelatedTo = 'General' | 'Quotes' | 'Orders' | 'Invoices' | 'Pipeline' | 'Clients' | 'Products' | 'Reports' | 'Technical' | 'Integrations'
export type ProjectLogStatus = 'active' | 'archived' | 'superseded'

export interface ProjectLog {
  id: string
  date: string
  title: string
  category: ProjectLogCategory | null
  content: string
  tags: string[] | null
  related_to: ProjectLogRelatedTo | null
  status: ProjectLogStatus
  created_at: string
  created_by: string | null
  updated_at: string
}


// Monthly Expenses (Founder-only)
export type MonthlyExpenseCategory = 'salaries' | 'rent' | 'utilities' | 'phone' | 'insurance' | 'software' | 'other'
export type MonthlyExpenseFrequency = 'monthly' | 'annual' | 'once-off'

export interface MonthlyExpense {
  id: string
  name: string
  category: MonthlyExpenseCategory
  amount: number
  frequency: MonthlyExpenseFrequency
  start_date: string
  end_date: string | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export const MONTHLY_EXPENSE_CATEGORIES: Record<MonthlyExpenseCategory, { label: string }> = {
  salaries: { label: 'Salaries' },
  rent: { label: 'Rent' },
  utilities: { label: 'Utilities' },
  phone: { label: 'Phone' },
  insurance: { label: 'Insurance' },
  software: { label: 'Software' },
  other: { label: 'Other' },
}

// Invoice Expenses
export type ExpenseCategory = 'travel' | 'materials' | 'labor' | 'accommodation' | 'equipment' | 'other'

export interface InvoiceExpense {
  id: string
  invoice_id: string
  category: ExpenseCategory
  description: string
  amount: number
  receipt_url: string | null
  expense_date: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export const EXPENSE_CATEGORIES: Record<ExpenseCategory, { label: string; icon: string }> = {
  travel: { label: 'Travel & Transport', icon: '🚗' },
  materials: { label: 'Materials & Parts', icon: '🔧' },
  labor: { label: 'Labor / Subcontractor', icon: '👷' },
  accommodation: { label: 'Accommodation & Meals', icon: '🏨' },
  equipment: { label: 'Equipment Rental', icon: '🛠️' },
  other: { label: 'Other', icon: '📄' },
}

// Purchase Order Types
export type PurchaseOrderStatus = 'draft' | 'sent' | 'confirmed' | 'cancelled'

export interface POLineItem {
  description: string
  qty: number
  unit_price: number
  disc_percent: number
  vat_percent: number
}

export interface PurchaseOrder {
  id: string
  po_number: string
  order_id: string | null
  reference: string | null
  date: string
  due_date: string | null
  status: PurchaseOrderStatus
  supplier_name: string
  supplier_address: string | null
  line_items: POLineItem[]
  currency: string
  overall_discount: number
  subtotal: number
  total_discount: number
  total_vat: number
  grand_total: number
  balance_due: number
  amount_paid: number
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined fields
  order_number?: string
}

export const PO_STATUS_CONFIG: Record<PurchaseOrderStatus, { label: string; bg: string; text: string }> = {
  draft: { label: 'Draft', bg: 'bg-slate-100', text: 'text-slate-700' },
  sent: { label: 'Sent', bg: 'bg-blue-100', text: 'text-blue-700' },
  confirmed: { label: 'Confirmed', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  cancelled: { label: 'Cancelled', bg: 'bg-red-100', text: 'text-red-700' },
}

// Tender Management Types
export type TenderStatus = 'new' | 'evaluating' | 'in_progress' | 'submitted' | 'won' | 'lost' | 'cancelled' | 'no_bid'

export interface TenderCompany {
  id: string
  name: string
  short_name: string | null
  cidb_grade: number
  cidb_categories: string[] | null
  bee_level: number | null
  bee_expiry: string | null
  tax_clearance_expiry: string | null
  csd_number: string | null
  registration_number: string | null
  geographic_regions: string[] | null
  min_contract_value: number | null
  max_contract_value: number | null
  specializations: string[] | null
  created_at: string
  updated_at: string
}

export interface Tender {
  id: string
  company_id: string | null
  tender_number: string | null
  title: string
  client: string | null
  source: string | null
  source_url: string | null
  description: string | null
  estimated_value: number | null
  published_date: string | null
  briefing_date: string | null
  briefing_mandatory: boolean
  briefing_location: string | null
  clarification_deadline: string | null
  closing_date: string
  status: TenderStatus
  outcome_date: string | null
  outcome_reason: string | null
  awarded_to: string | null
  awarded_value: number | null
  submission_confidence: number | null
  submitted_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Joined fields
  company?: TenderCompany
}

export interface TenderDocument {
  id: string
  tender_id: string
  name: string
  category: string | null
  is_mandatory: boolean
  is_completed: boolean
  completed_at: string | null
  completed_by: string | null
  file_path: string | null
  notes: string | null
  sort_order: number
  created_at: string
}

export const TENDER_STATUS_CONFIG: Record<TenderStatus, { label: string; color: string; bgColor: string }> = {
  new: { label: 'New', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  evaluating: { label: 'Evaluating', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  in_progress: { label: 'In Progress', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  submitted: { label: 'Submitted', color: 'text-teal-700', bgColor: 'bg-teal-100' },
  won: { label: 'Won', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  lost: { label: 'Lost', color: 'text-red-700', bgColor: 'bg-red-100' },
  cancelled: { label: 'Cancelled', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  no_bid: { label: 'No Bid', color: 'text-gray-500', bgColor: 'bg-gray-50' },
}

// Ticket / Support Types
export type TicketIssueType = 'hardware' | 'software' | 'user_error' | 'key_missing' | 'other'
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical'
export type TicketStatus = 'open' | 'in_progress' | 'awaiting_parts' | 'resolved' | 'closed'

export interface Ticket {
  id: string
  client_id: string | null
  device_serial: string | null
  issue_type: TicketIssueType
  priority: TicketPriority
  status: TicketStatus
  subject: string
  description: string
  resolution_notes: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
  created_by: string | null
  // Joined fields
  client_name?: string
}

export interface TicketComment {
  id: string
  ticket_id: string
  comment: string
  created_at: string
  created_by: string | null
}

export const TICKET_STATUS_CONFIG: Record<TicketStatus, { label: string; bg: string; text: string }> = {
  open: { label: 'Open', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  in_progress: { label: 'In Progress', bg: 'bg-blue-100', text: 'text-blue-700' },
  awaiting_parts: { label: 'Awaiting Parts', bg: 'bg-purple-100', text: 'text-purple-700' },
  resolved: { label: 'Resolved', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  closed: { label: 'Closed', bg: 'bg-slate-100', text: 'text-slate-500' },
}

export const TICKET_PRIORITY_CONFIG: Record<TicketPriority, { label: string; bg: string; text: string }> = {
  low: { label: 'Low', bg: 'bg-slate-100', text: 'text-slate-600' },
  medium: { label: 'Medium', bg: 'bg-blue-100', text: 'text-blue-700' },
  high: { label: 'High', bg: 'bg-orange-100', text: 'text-orange-700' },
  critical: { label: 'Critical', bg: 'bg-red-100', text: 'text-red-700' },
}

export const TICKET_ISSUE_TYPE_CONFIG: Record<TicketIssueType, { label: string }> = {
  hardware: { label: 'Hardware' },
  software: { label: 'Software' },
  user_error: { label: 'User Error' },
  key_missing: { label: 'Key Missing' },
  other: { label: 'Other' },
}

// HR Module Types
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern'
export type EmploymentStatus = 'active' | 'probation' | 'suspended' | 'exited'
export type ComplianceStatus = 'yes' | 'no' | 'partial' | 'not_applicable'

export interface Employee {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  id_number: string | null
  department: string | null
  job_title: string | null
  employment_type: EmploymentType
  employment_status: EmploymentStatus
  start_date: string | null
  end_date: string | null
  reports_to: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined fields
  reports_to_name?: string
}

export interface EmployeeDocument {
  id: string
  employee_id: string
  document_type: string
  file_name: string
  file_url: string | null
  notes: string | null
  uploaded_by: string | null
  created_at: string
}

export interface HRComplianceItem {
  id: string
  category: string
  item_name: string
  status: ComplianceStatus
  evidence_url: string | null
  notes: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export const EMPLOYMENT_TYPE_CONFIG: Record<EmploymentType, { label: string; bg: string; text: string }> = {
  full_time: { label: 'Full-Time', bg: 'bg-blue-100', text: 'text-blue-700' },
  part_time: { label: 'Part-Time', bg: 'bg-purple-100', text: 'text-purple-700' },
  contract: { label: 'Contract', bg: 'bg-amber-100', text: 'text-amber-700' },
  intern: { label: 'Intern', bg: 'bg-cyan-100', text: 'text-cyan-700' },
}

export const EMPLOYMENT_STATUS_CONFIG: Record<EmploymentStatus, { label: string; bg: string; text: string }> = {
  active: { label: 'Active', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  probation: { label: 'Probation', bg: 'bg-amber-100', text: 'text-amber-700' },
  suspended: { label: 'Suspended', bg: 'bg-red-100', text: 'text-red-700' },
  exited: { label: 'Exited', bg: 'bg-slate-100', text: 'text-slate-500' },
}

export const COMPLIANCE_STATUS_CONFIG: Record<ComplianceStatus, { label: string; bg: string; text: string }> = {
  yes: { label: 'Yes', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  no: { label: 'No', bg: 'bg-red-100', text: 'text-red-700' },
  partial: { label: 'Partial', bg: 'bg-amber-100', text: 'text-amber-700' },
  not_applicable: { label: 'N/A', bg: 'bg-slate-100', text: 'text-slate-500' },
}

export const HR_COMPLIANCE_CATEGORIES: { category: string; items: string[] }[] = [
  { category: 'Employment Contracts', items: ['Written employment contracts for all staff', 'Contracts compliant with BCEA', 'Contracts signed and filed'] },
  { category: 'BCEA Compliance', items: ['Working hours within legal limits', 'Overtime policy in place', 'Leave policy (annual, sick, family responsibility)', 'Payslips issued monthly'] },
  { category: 'Health & Safety (OHS Act)', items: ['OHS Act Section 16(1) appointment', 'Health & safety representative appointed', 'Risk assessments conducted', 'First aid kits available', 'Incident register maintained'] },
  { category: 'Skills Development', items: ['Workplace Skills Plan (WSP) submitted', 'Annual Training Report (ATR) submitted', 'SDL payments up to date'] },
  { category: 'Employment Equity', items: ['EE Plan in place (if 50+ employees or designated)', 'EE Report submitted to DoEL', 'EE Committee established'] },
  { category: 'UIF Compliance', items: ['UIF registered with DoEL', 'Monthly UIF contributions paid', 'UI-19 forms available for employees'] },
  { category: 'COIDA (Compensation Fund)', items: ['Registered with Compensation Fund', 'Annual return of earnings submitted', 'Assessment paid'] },
  { category: 'Tax Compliance', items: ['PAYE registered and deducted', 'IRP5/IT3(a) issued to employees', 'EMP201 submitted monthly', 'EMP501 reconciliation submitted'] },
  { category: 'Payroll & Benefits', items: ['Payroll system in place', 'Provident/pension fund registered (if applicable)', 'Medical aid contribution (if applicable)'] },
  { category: 'Leave Management', items: ['Leave records maintained', 'Annual leave minimum 15 days', 'Sick leave cycle tracked (3-year)', 'Maternity/parental leave policy'] },
  { category: 'Disciplinary & Grievance', items: ['Disciplinary code and procedure', 'Grievance procedure in place', 'Records of disciplinary actions maintained'] },
  { category: 'Record Keeping', items: ['Personnel files for all employees', 'Attendance registers maintained', 'Records kept for minimum 3 years after termination'] },
]

// Tender Archive Types
export type TenderDocumentType = 'regret_letter' | 'appointment_letter'
export type TenderRejectionReason = 'price' | 'bee' | 'experience' | 'technical' | 'other'

export interface TenderArchiveDocument {
  id: string
  document_type: TenderDocumentType
  tender_reference: string
  client_name: string
  outcome_date: string
  contract_value: number | null
  rejection_reason: TenderRejectionReason | null
  file_name: string
  file_url: string
  notes: string | null
  created_by: string
  created_at: string
}

export const DEFAULT_TENDER_DOCUMENTS = [
  { name: 'Tax Clearance Certificate', category: 'compliance', is_mandatory: true },
  { name: 'BEE Certificate', category: 'compliance', is_mandatory: true },
  { name: 'CIDB Registration', category: 'compliance', is_mandatory: true },
  { name: 'CSD Registration', category: 'compliance', is_mandatory: true },
  { name: 'Company Registration', category: 'compliance', is_mandatory: true },
  { name: "Directors' IDs", category: 'compliance', is_mandatory: true },
  { name: 'Proof of Banking', category: 'financial', is_mandatory: true },
  { name: 'Latest Financial Statements', category: 'financial', is_mandatory: true },
  { name: 'Organogram', category: 'technical', is_mandatory: false },
  { name: 'CV of Key Personnel', category: 'technical', is_mandatory: false },
  { name: 'Methodology', category: 'technical', is_mandatory: false },
  { name: 'Completed Tender Forms', category: 'other', is_mandatory: true },
]
