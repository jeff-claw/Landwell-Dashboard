'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the full error to console so we can capture it
    console.error('[GLOBAL ERROR]', JSON.stringify({
      message: error.message,
      stack: error.stack,
      digest: error.digest,
    }))
  }, [error])

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', textAlign: 'center', background: '#f5f5f5' }}>
        <div style={{ maxWidth: 500, margin: '4rem auto', background: 'white', borderRadius: 12, padding: '2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#1a1a1a' }}>Something went wrong</h1>
          <p style={{ color: '#666', fontSize: 14, marginBottom: 16 }}>{error.message}</p>
          {error.stack && (
            <details style={{ textAlign: 'left', background: '#f9f9f9', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: 8 }}>Error details</summary>
              <pre style={{ whiteSpace: 'pre-wrap', color: '#333' }}>{error.stack}</pre>
            </details>
          )}
          <button
            onClick={reset}
            style={{
              background: '#0d9488',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
