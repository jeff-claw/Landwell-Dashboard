'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'

type Member = { id: string; name: string; email: string; role: string; department: string; is_active: boolean; phone: string | null }

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadTeam() }, [])

  const loadTeam = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('team_members').select('*').order('name')
    setMembers(data || [])
    setLoading(false)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Team</h1>
        <p className="text-sm text-gray-500 mt-1">{members.length} members</p>
      </div>
      {loading ? <div className="text-center py-12 text-gray-500">Loading...</div> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map(m => (
            <div key={m.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">{m.name.split(' ').map(n => n[0]).join('')}</div>
                <div>
                  <h3 className="font-semibold text-gray-900">{m.name}</h3>
                  <p className="text-xs text-gray-500">{m.role} · {m.department}</p>
                </div>
              </div>
              <div className="mt-3 text-sm text-gray-600">{m.email}</div>
              {m.phone && <div className="text-sm text-gray-600">{m.phone}</div>}
              <div className="mt-2"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${m.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{m.is_active ? 'Active' : 'Inactive'}</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
