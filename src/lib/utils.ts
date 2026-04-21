export const formatZAR = (amount: number) =>
  new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount)

export const formatUSD = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)

export const REGIONS = [
  'Gauteng',
  'Western Cape',
  'KwaZulu-Natal',
  'Eastern Cape',
  'Free State',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
] as const

export const PIPELINE_STATUSES = [
  'Lead',
  'Contacted',
  'Quote Sent',
  'Negotiation',
  'Won',
  'Lost',
] as const

export const ORDER_STATUSES = [
  'Pending',
  'Deposit Paid',
  'In Production',
  'Shipped',
  'Customs Cleared',
  'Delivered',
  'Installed',
] as const

export const TENDER_STATUSES = [
  'Open',
  'Closing Soon',
  'Submitted',
  'Won',
  'Lost',
  'Closed',
] as const

export type Region = (typeof REGIONS)[number]
export type PipelineStatus = (typeof PIPELINE_STATUSES)[number]
export type OrderStatus = (typeof ORDER_STATUSES)[number]
export type TenderStatus = (typeof TENDER_STATUSES)[number]