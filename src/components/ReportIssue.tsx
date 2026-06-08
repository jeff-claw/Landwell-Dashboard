'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bug, X, Send, Camera, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

// Context for controlling the modal from anywhere
const ReportIssueContext = createContext<{
  open: () => void
  close: () => void
  isOpen: boolean
}>({
  open: () => {},
  close: () => {},
  isOpen: false,
})

export const useReportIssue = () => useContext(ReportIssueContext)

// Trigger button component (can be placed anywhere)
export function ReportIssueTrigger({ className = '' }: { className?: string }) {
  const { open } = useReportIssue()
  
  return (
    <button
      onClick={open}
      className={`flex items-center gap-2 text-amber-400 hover:text-amber-300 transition ${className}`}
      title="Report an Issue"
    >
      <Bug className="w-4 h-4" />
    </button>
  )
}

// Main provider component with modal
export default function ReportIssue({ children }: { children?: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [user, setUser] = useState<{ id: string; email: string; name?: string } | null>(null)

  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', authUser.id)
          .single()
        
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          name: profile?.full_name || undefined
        })
      }
    }
    getUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const captureScreenshot = async () => {
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(document.body, {
        scale: 0.5,
        logging: false,
        useCORS: true,
      })
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
      setScreenshot(dataUrl)
      toast.success('Screenshot captured')
    } catch (err) {
      console.error('Screenshot failed:', err)
      toast.error('Could not capture screenshot')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) {
      toast.error('Please describe the issue')
      return
    }

    setSubmitting(true)

    const browserInfo = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      timestamp: new Date().toISOString(),
    }

    const { error } = await supabase.from('issue_reports').insert({
      user_id: user?.id || null,
      user_email: user?.email || 'anonymous',
      user_name: user?.name || null,
      page_url: window.location.href,
      description: description.trim(),
      screenshot: screenshot,
      browser_info: browserInfo,
      status: 'pending',
    })

    setSubmitting(false)

    if (error) {
      console.error('Error submitting report:', error)
      toast.error('Failed to submit report')
      return
    }

    setSubmitted(true)
    setTimeout(() => {
      setIsOpen(false)
      setSubmitted(false)
      setDescription('')
      setScreenshot(null)
    }, 2000)
  }

  return (
    <ReportIssueContext.Provider value={{ 
      open: () => setIsOpen(true), 
      close: () => setIsOpen(false),
      isOpen 
    }}>
      {children}

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setIsOpen(false)}>
          <div 
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-amber-50">
              <div className="flex items-center gap-2">
                <Bug className="w-5 h-5 text-amber-600" />
                <h2 className="text-lg font-semibold text-slate-900">Report an Issue</h2>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-amber-100 rounded-lg transition">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              {submitted ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Thank you!</h3>
                  <p className="text-slate-600">Your report has been submitted. We&apos;ll look into it shortly.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Auto-captured info */}
                  <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">
                    <p><strong>Page:</strong> {typeof window !== 'undefined' ? window.location.pathname : ''}</p>
                    <p><strong>User:</strong> {user?.email || 'Not logged in'}</p>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      What went wrong?
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe the issue you're experiencing..."
                      rows={4}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                      autoFocus
                    />
                  </div>

                  {/* Screenshot */}
                  <div>
                    {screenshot ? (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={screenshot} alt="Screenshot" className="w-full rounded-lg border border-slate-200" />
                        <button
                          type="button"
                          onClick={() => setScreenshot(null)}
                          className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={captureScreenshot}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-amber-500 hover:text-amber-600 transition"
                      >
                        <Camera className="w-4 h-4" />
                        Capture Screenshot (optional)
                      </button>
                    )}
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={submitting || !description.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white font-medium py-2.5 rounded-lg transition"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Submit Report
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </ReportIssueContext.Provider>
  )
}
