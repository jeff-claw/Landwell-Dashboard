import { NextResponse } from 'next/server'

let cachedRate: number | null = null
let cachedAt: number = 0
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export async function GET() {
  try {
    const now = Date.now()
    if (cachedRate && now - cachedAt < CACHE_TTL) {
      return NextResponse.json({ rate: cachedRate, source: 'cache' })
    }

    // Try primary source: Frankfurter API (free, no key required)
    const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=ZAR', {
      next: { revalidate: 3600 },
    })
    if (res.ok) {
      const data = await res.json()
      if (data.rates?.ZAR) {
        cachedRate = data.rates.ZAR
        cachedAt = now
        return NextResponse.json({ rate: data.rates.ZAR, source: 'frankfurter' })
      }
    }

    // Fallback: Open Exchange Rates
    const fallback = await fetch(
      `https://open.er-api.com/v6/latest/USD`,
      { next: { revalidate: 3600 } }
    )
    if (fallback.ok) {
      const data = await fallback.json()
      if (data.rates?.ZAR) {
        cachedRate = data.rates.ZAR
        cachedAt = now
        return NextResponse.json({ rate: data.rates.ZAR, source: 'er-api' })
      }
    }

    // Last resort fallback
    return NextResponse.json({ rate: 18.5, source: 'fallback' })
  } catch {
    return NextResponse.json({ rate: 18.5, source: 'fallback' }, { status: 200 })
  }
}
