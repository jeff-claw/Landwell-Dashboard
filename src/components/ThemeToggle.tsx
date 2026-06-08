'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

/**
 * Theme slider for the (always-dark) sidebar footer.
 * Toggles the `.dark` class on <html> and persists the choice to localStorage.
 * Initial state is read from the class the no-flash script already applied.
 */
export default function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {}
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Toggle dark mode"
      onClick={toggle}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex items-center justify-between w-full gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
    >
      <span className="flex items-center gap-3">
        {dark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        {dark ? 'Dark' : 'Light'}
      </span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          dark ? 'bg-teal-500' : 'bg-slate-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            dark ? 'translate-x-4' : 'translate-x-1'
          }`}
        />
      </span>
    </button>
  )
}
