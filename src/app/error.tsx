'use client'

import { useEffect, useState } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Log to console
    console.error('[DASHBOARD ERROR]', error.message, error.stack, error.digest)
    
    // Store in localStorage so we can read it
    try {
      localStorage.setItem('dashboard_error', JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        time: new Date().toISOString()
      }))
    } catch (e) {}
  }, [error])

  const copyError = () => {
    const text = `${error.message}\n\n${error.stack || ''}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      // Fallback
      prompt('Copy this error text:', `${error.message}\n\n${error.stack || ''}`)
    })
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      background: '#f8fafc',
      padding: '1rem'
    }}>
      <div style={{ 
        background: 'white', 
        borderRadius: '12px', 
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)', 
        padding: '2rem', 
        maxWidth: '480px', 
        width: '100%',
        textAlign: 'center'
      }}>
        <div style={{ 
          width: 64, 
          height: 64, 
          background: '#fee2e2', 
          borderRadius: '50%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          margin: '0 auto 1rem'
        }}>
          <span style={{ fontSize: 32 }}>⚠️</span>
        </div>
        
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
          Dashboard Error
        </h2>
        
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 12 }}>
          The dashboard crashed. Please copy the error below and send it to Jeff.
        </p>
        
        <div style={{ 
          background: '#f1f5f9', 
          borderRadius: 8, 
          padding: 12, 
          marginBottom: 16,
          textAlign: 'left'
        }}>
          <p style={{ fontFamily: 'monospace', fontSize: 13, color: '#e11d48', wordBreak: 'break-all', margin: 0 }}>
            {error.message}
          </p>
        </div>
        
        {error.stack && (
          <details style={{ 
            background: '#f8fafc', 
            border: '1px solid #e2e8f0', 
            borderRadius: 8, 
            padding: 12, 
            marginBottom: 16,
            textAlign: 'left',
            fontSize: 11,
            fontFamily: 'monospace'
          }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: 8, color: '#475569' }}>
              Full stack trace
            </summary>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#334155', margin: 0 }}>
              {error.stack}
            </pre>
          </details>
        )}
        
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={copyError}
            style={{
              flex: 1,
              background: '#e2e8f0',
              color: '#334155',
              border: 'none',
              padding: '10px 16px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {copied ? '✅ Copied!' : '📋 Copy Error'}
          </button>
          
          <button
            onClick={reset}
            style={{
              flex: 1,
              background: '#0d9488',
              color: 'white',
              border: 'none',
              padding: '10px 16px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🔄 Try Again
          </button>
        </div>
      </div>
    </div>
  )
}
