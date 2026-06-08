'use client'

import { useEffect, useMemo, useState } from 'react'
import { Calculator as CalcIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Formula } from '@/lib/types'

// Single Seller = Reseller + 15%. Not (yet) a column on the formula table,
// so it lives here as a constant. To make it editable from the Formula tab,
// add a `single_seller_markup` numeric column to the `formula` table.
const SINGLE_SELLER_MARKUP = 0.15
const VAT = 0.15

type ClientType = 'reseller' | 'single' | 'enduser'

function formatZAR(val: number) {
  return 'R' + val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function CalculatorPage() {
  const [formula, setFormula] = useState<Formula | null>(null)
  const [loading, setLoading] = useState(true)
  const [usd, setUsd] = useState('')
  const [clientType, setClientType] = useState<ClientType>('reseller')
  const [installation, setInstallation] = useState<'no' | 'yes'>('no')
  const [region, setRegion] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('formula')
      .select('*')
      .limit(1)
      .single()
      .then(({ data }) => {
        setFormula(data as Formula | null)
        const regions = (data?.region_markups as Record<string, number>) || {}
        const first = Object.keys(regions)[0]
        if (first) setRegion(first)
        setLoading(false)
      })
  }, [])

  const regions = useMemo(
    () => (formula?.region_markups as Record<string, number>) || {},
    [formula]
  )

  // Region is relevant when installation applies (reseller/single + install) or for End User.
  const showRegion = clientType === 'enduser' || installation === 'yes'

  const result = useMemo(() => {
    const n = parseFloat(usd) || 0
    if (!formula || n <= 0) return null

    const rate = Number(formula.exchange_rate) || 0
    const shipping = Number(formula.shipping_multiplier) || 0
    const delivery = Number(formula.delivery_percent) || 0
    const gp = Number(formula.gp_divisor) || 1
    const euDiv = Number(formula.end_user_divisor) || 1
    const regionPct = Number(regions[region]) || 0

    const deliveryMult = 1 + delivery / 100
    const regionMult = 1 + regionPct / 100

    const resellerNoInstall = (n * rate * shipping * deliveryMult) / gp
    const resellerWithInstall = resellerNoInstall * regionMult
    const endUserPrice = resellerWithInstall / euDiv

    let finalPrice: number
    let label: string
    let showRRP = false

    if (clientType === 'enduser') {
      finalPrice = endUserPrice
      label = 'End User'
    } else {
      const base = installation === 'yes' ? resellerWithInstall : resellerNoInstall
      const isSingle = clientType === 'single'
      finalPrice = isSingle ? base * (1 + SINGLE_SELLER_MARKUP) : base
      const who = isSingle ? 'Single Seller' : 'Reseller'
      label = who + (installation === 'yes' ? ' (with installation)' : ' (no installation)')
      showRRP = true
    }

    return {
      excl: finalPrice,
      incl: finalPrice * (1 + VAT),
      label,
      showRRP,
      rrpExcl: endUserPrice,
      rrpIncl: endUserPrice * (1 + VAT),
    }
  }, [usd, formula, clientType, installation, region, regions])

  const toggle = (active: boolean) =>
    `flex-1 px-4 py-3 text-sm font-semibold rounded-lg transition-colors ${
      active ? 'bg-teal-600 text-white' : 'bg-muted text-body hover:bg-base'
    }`

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <CalcIcon className="w-6 h-6 text-teal-600" />
        <h1 className="text-2xl font-bold text-strong">Price Calculator</h1>
      </div>

      <div className="bg-surface rounded-2xl border border-line p-6 shadow-sm">
        {loading ? (
          <p className="text-soft text-sm">Loading formula…</p>
        ) : !formula ? (
          <p className="text-red-600 text-sm">No formula configured. Set it in Admin → Formula.</p>
        ) : (
          <>
            <label className="block text-xs font-semibold text-soft uppercase tracking-wide mb-2">
              USD Price
            </label>
            <div className="relative mb-5">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-soft text-lg font-semibold">$</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={usd}
                onChange={(e) => setUsd(e.target.value)}
                placeholder="0.00"
                className="w-full pl-9 pr-4 py-3 text-xl font-bold border-2 border-line rounded-xl bg-surface text-strong focus:outline-none focus:border-teal-500"
              />
            </div>

            <label className="block text-xs font-semibold text-soft uppercase tracking-wide mb-2">
              Client Type
            </label>
            <div className="flex gap-2 mb-5">
              <button className={toggle(clientType === 'reseller')} onClick={() => setClientType('reseller')}>Reseller</button>
              <button className={toggle(clientType === 'single')} onClick={() => setClientType('single')}>Single Seller</button>
              <button className={toggle(clientType === 'enduser')} onClick={() => setClientType('enduser')}>End User</button>
            </div>

            {clientType !== 'enduser' && (
              <>
                <label className="block text-xs font-semibold text-soft uppercase tracking-wide mb-2">
                  Installation
                </label>
                <div className="flex gap-2 mb-5">
                  <button className={toggle(installation === 'no')} onClick={() => setInstallation('no')}>No</button>
                  <button className={toggle(installation === 'yes')} onClick={() => setInstallation('yes')}>Yes</button>
                </div>
              </>
            )}

            {showRegion && (
              <>
                <label className="block text-xs font-semibold text-soft uppercase tracking-wide mb-2">
                  Region
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full px-4 py-3 text-base font-semibold border-2 border-line rounded-xl bg-surface text-strong focus:outline-none focus:border-teal-500 mb-5"
                >
                  {Object.entries(regions).map(([key, pct]) => (
                    <option key={key} value={key}>{key} ({pct}%)</option>
                  ))}
                </select>
              </>
            )}

            {result && (
              <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-2xl p-6 mt-2">
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-white/20">
                  <div className="text-center">
                    <div className="text-[11px] uppercase tracking-wider text-white/70 mb-1">Excl. VAT</div>
                    <div className="text-2xl font-bold text-white">{formatZAR(result.excl)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[11px] uppercase tracking-wider text-white/70 mb-1">Incl. VAT</div>
                    <div className="text-2xl font-bold text-white">{formatZAR(result.incl)}</div>
                  </div>
                </div>
                <div className="text-center text-white/70 text-xs mt-3">{result.label}</div>
              </div>
            )}

            {result?.showRRP && (
              <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 mt-4">
                <div className="text-[11px] font-semibold text-amber-800 uppercase tracking-wide">
                  Recommended Retail (End User)
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2 text-center">
                  <div>
                    <div className="text-[11px] text-amber-700">Excl. VAT</div>
                    <div className="text-lg font-bold text-amber-800">{formatZAR(result.rrpExcl)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-amber-700">Incl. VAT</div>
                    <div className="text-lg font-bold text-amber-800">{formatZAR(result.rrpIncl)}</div>
                  </div>
                </div>
              </div>
            )}

            <p className="text-[11px] text-soft mt-4 text-center">
              Uses the live formula from Admin → Formula. VAT {VAT * 100}% · Single Seller = Reseller +{SINGLE_SELLER_MARKUP * 100}%
            </p>
          </>
        )}
      </div>
    </div>
  )
}
