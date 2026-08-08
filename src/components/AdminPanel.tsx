import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Shield, ShieldAlert, CheckCircle, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'

export default function AdminPanel({ session }: { session: Session }) {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  const checkAdmin = useCallback(async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single()

    if (profile?.is_admin) {
      setIsAdmin(true)
      fetchUsers()
    } else {
      navigate('/')
    }
  }, [session.user.id, navigate])

  useEffect(() => {
    checkAdmin()
  }, [checkAdmin])

  const fetchUsers = async () => {
    setLoading(true)
    
    // Fetch profiles
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      
    if (profilesError) {
      console.error(profilesError)
      alert('Profiles fetch error: ' + profilesError.message)
      setUsers([])
      setLoading(false)
      return
    }

    // Fetch all aliases (only admins should be able to do this, wait, if RLS prevents it, we'll see)
    // Wait, let's just fetch them and map. If RLS blocks it, we might need a function or policy.
    const { data: aliasesData, error: aliasesError } = await supabase
      .from('email_aliases')
      .select('user_id, alias')
      
    if (aliasesError) {
      console.error('Alias fetch error:', aliasesError)
    }
    
    const combined = (profilesData || []).map(p => ({
      ...p,
      email_aliases: (aliasesData || []).filter(a => a.user_id === p.id)
    }))
    
    setUsers(combined)
    setLoading(false)
  }

  const grantPremium = async (userId: string, days: number) => {
    const premiumUntil = new Date()
    premiumUntil.setDate(premiumUntil.getDate() + days)

    const { error } = await supabase
      .from('profiles')
      .update({ premium_until: premiumUntil.toISOString() })
      .eq('id', userId)

    if (error) {
      alert('Failed to update premium status')
    } else {
      fetchUsers()
    }
  }

  const removePremium = async (userId: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ premium_until: null })
      .eq('id', userId)

    if (error) {
      alert('Failed to remove premium status')
    } else {
      fetchUsers()
    }
  }

  if (!isAdmin) return null

  return (
    <div className="dashboard-container">
      <div className="card" style={{ maxWidth: '800px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 0 }}>
            <Shield size={24} /> Admin Panel
          </h2>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            Back to Dashboard
          </button>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search users by email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <p>Loading users...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px 8px', fontWeight: '500' }}>Email</th>
                  <th style={{ padding: '12px 8px', fontWeight: '500' }}>olomail</th>
                  <th style={{ padding: '12px 8px', fontWeight: '500' }}>Status</th>
                  <th style={{ padding: '12px 8px', fontWeight: '500' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(u => (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())).map((user) => {
                  const isPremium = user.is_admin || (user.premium_until && new Date(user.premium_until) > new Date())
                  return (
                    <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 8px' }}>{user.email}</td>
                      <td style={{ padding: '12px 8px', color: 'var(--primary-brand)', fontWeight: 'bold' }}>
                        {user.email_aliases && user.email_aliases.length > 0 
                          ? user.email_aliases.map((a: any) => `${a.alias}@olo.pro.bd`).join(', ') 
                          : <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal' }}>None</span>}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        {user.is_admin ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#8b5cf6' }}>
                            <ShieldAlert size={16} /> Admin
                          </span>
                        ) : isPremium ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981' }}>
                            <CheckCircle size={16} /> Premium {user.premium_until && new Date(user.premium_until).getFullYear() > 2090 ? '(Lifetime)' : `until ${new Date(user.premium_until).toLocaleDateString()}`}
                          </span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b' }}>
                            <Clock size={16} /> Free
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        {!user.is_admin && (
                          <select 
                            className="form-select"
                            value=""
                            onChange={(e) => {
                              const val = e.target.value
                              if (val === 'remove') removePremium(user.id)
                              else if (val === 'lifetime') grantPremium(user.id, 36500)
                              else if (val !== '') grantPremium(user.id, parseInt(val))
                            }}
                          >
                            <option value="">Select Plan...</option>
                            <option value="lifetime">Lifetime</option>
                            <option value="7">7 Days</option>
                            <option value="30">30 Days</option>
                            <option value="90">3 Months</option>
                            <option value="180">6 Months</option>
                            <option value="365">12 Months</option>
                            {isPremium && <option value="remove">Remove Premium</option>}
                          </select>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
