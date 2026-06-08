'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PAGES } from '@/lib/pages'

export default function AccessDeniedPage() {
  const params = useSearchParams()
  const pageKey = params.get('page') || ''
  const pageLabel = PAGES.find(p => p.key === pageKey)?.label || pageKey || 'this page'

  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const [email, setEmail] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setEmail(data.user?.email || '')
      setUserId(data.user?.id || '')
    })
  }, [])

  const requestAccess = async () => {
    setState('sending')
    try {
      const res = await fetch('/api/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, email, page: pageKey }),
      })
      setState(res.ok ? 'sent' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="bg-surface border border-line rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
          <Lock className="w-6 h-6 text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-strong mb-2">Access Denied</h1>
        <p className="text-sm text-body mb-1">
          You don&apos;t have access to <span className="font-semibold">{pageLabel}</span>.
        </p>
        <p className="text-sm text-soft mb-6">Please ask Morne for approval.</p>

        {state === 'sent' ? (
          <div className="text-sm font-medium text-emerald-600">
            Request sent to Morne. You&apos;ll get access once approved.
          </div>
        ) : (
          <button
            onClick={requestAccess}
            disabled={state === 'sending'}
            className="btn-primary justify-center w-full"
          >
            {state === 'sending' ? 'Sending…' : 'Request access from Morne'}
          </button>
        )}
        {state === 'error' && (
          <p className="text-xs text-red-600 mt-3">Could not send the request — please tell Morne directly.</p>
        )}
      </div>
    </div>
  )
}
