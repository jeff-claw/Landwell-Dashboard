import type { PipelineDeal, Quote, Formula } from '@/lib/types'

// One shared way to work out what a pipeline deal is worth and which stage it
// belongs in. Every page used to read deal.value, which is not a column on the
// pipeline table — the column is value_estimate, and it is null on every row —
// so each of them quietly showed R0. The real figures live in the client's
// quotes, so they are rebuilt from there.

export function calculateZarPrice(
  usdPrice: number,
  clientType: string,
  formula: Formula | null,
  region: string | null = null,
  includeInstallation: boolean = false
): number {
  if (!formula) return usdPrice * 17.5
  const exchangeRate = Number(formula.exchange_rate) || 17.5
  const shipping = Number(formula.shipping_multiplier) || 1.4
  const gp = Number(formula.gp_divisor) || 0.7
  const endUserDivisor = Number(formula.end_user_divisor) || 0.75
  const deliveryMult = 1 + (Number(formula.delivery_percent) || 10) / 100
  const regionMult = (region && formula.region_markups?.[region]) ? 1 + formula.region_markups[region] / 100 : 1

  const resellerNoInstall = (usdPrice * exchangeRate * shipping * deliveryMult) / gp
  const resellerWithInstall = (usdPrice * exchangeRate * shipping * deliveryMult * regionMult) / gp

  if (clientType === 'end_user' || clientType === 'End User') {
    return resellerWithInstall / endUserDivisor
  }
  return includeInstallation ? resellerWithInstall : resellerNoInstall
}

export function getStageProbability(status: string): number {
  const probabilities: Record<string, number> = {
    'lead_generated': 0.1,
    'qualification': 0.2,
    'meeting_scheduled': 0.3,
    'demo': 0.5,
    'proposal_sent': 0.6,
    'po_received': 0.9,
    'closed_won': 1.0,
    'closed_lost': 0,
  }
  return probabilities[status] ?? 0.2
}

// Quote statuses as the quotes table actually stores them. Code used to test
// for 'approved'/'Accepted', which never matched 'accepted', so an accepted
// quote never registered and its deal stayed sitting in New Lead.
const ACCEPTED_QUOTE = ['accepted', 'approved', 'won']
const LOST_QUOTE = ['declined', 'rejected', 'lost']
const SENT_QUOTE = ['sent', 'quoted']

export type QuoteState = 'accepted' | 'lost' | 'sent' | 'draft'

export function quoteState(status: string | null | undefined): QuoteState {
  const s = (status || '').trim().toLowerCase()
  if (ACCEPTED_QUOTE.includes(s)) return 'accepted'
  if (LOST_QUOTE.includes(s)) return 'lost'
  if (SENT_QUOTE.includes(s)) return 'sent'
  return 'draft'
}

// Quote totals are not stored — `total` is 0 on every row — so the value has
// to be rebuilt from the line items.
export function quoteValueZar(quote: Quote, formula: Formula | null): number {
  return quote.line_items?.reduce((sum, item) => {
    // Each line carries its own currency. A USD quote routinely holds ZAR
    // lines (software, seals); running those through the USD formula
    // multiplied them by about fifty and blew the pipeline total up to
    // hundreds of millions.
    const itemCurrency = (item as { currency?: string }).currency || quote.currency
    const price = itemCurrency === 'USD'
      ? calculateZarPrice(item.unitPrice, quote.client_type || 'end_user', formula, quote.region, quote.include_installation)
      : item.unitPrice
    return sum + (item.qty * price)
  }, 0) || 0
}

export type DerivedDeal = PipelineDeal & {
  /** Stage after taking the client's quotes into account. */
  status: string
  /** True when the quotes moved it, rather than someone setting it by hand. */
  derivedFromQuotes: boolean
  quoteCount: number
  /** What the deal is worth, in rand. */
  dealValue: number
}

/**
 * Works each deal's stage and value out from its client's quotes.
 *
 * A stage set by hand wins: only deals left at the default New Lead are moved,
 * so dragging a card somewhere is not undone on the next load. Likewise a
 * value_estimate that someone actually filled in beats the computed figure.
 */
export function deriveDeals(
  deals: PipelineDeal[],
  quotes: Quote[],
  formula: Formula | null
): DerivedDeal[] {
  const byClient = new Map<string, Quote[]>()
  quotes.forEach(q => {
    const key = (q.client_name || '').trim().toLowerCase()
    if (!key) return
    byClient.set(key, [...(byClient.get(key) || []), q])
  })

  // The first deal listed for each client carries that client's quote value;
  // the rest count as zero. A client can hold several pipeline rows (Eskom has
  // four), and without this its quotes are counted once per row.
  const firstDealPerClient = new Map<string, string>()
  deals.forEach(d => {
    const key = (d.client_name || '').trim().toLowerCase()
    if (key && !firstDealPerClient.has(key)) firstDealPerClient.set(key, d.id)
  })

  return deals.map(deal => {
    const clientKey = (deal.client_name || '').trim().toLowerCase()
    const clientQuotes = byClient.get(clientKey) || []
    const states = clientQuotes.map(q => quoteState(q.status))

    let derivedStatus = deal.status
    if (deal.status === 'lead_generated' && clientQuotes.length > 0) {
      if (states.includes('accepted')) derivedStatus = 'po_received'
      else if (states.includes('sent')) derivedStatus = 'proposal_sent'
      else if (states.length > 0 && states.every(s => s === 'lost')) derivedStatus = 'closed_lost'
    }

    // Value follows the live quotes: the accepted ones once there are any,
    // otherwise everything still in play.
    const relevant = states.includes('accepted')
      ? clientQuotes.filter(q => quoteState(q.status) === 'accepted')
      : clientQuotes.filter(q => {
          const s = quoteState(q.status)
          return s !== 'lost' && s !== 'draft'
        })

    const ownsValue = !clientKey || firstDealPerClient.get(clientKey) === deal.id
    const quoteValue = ownsValue
      ? relevant.reduce((sum, q) => sum + quoteValueZar(q, formula), 0)
      : 0

    return {
      ...deal,
      status: derivedStatus,
      derivedFromQuotes: derivedStatus !== deal.status,
      quoteCount: clientQuotes.length,
      dealValue: Number(deal.value_estimate) || quoteValue,
    }
  })
}
