import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Copy, Trash2, Mail, Plus, ShieldCheck, Clock, Crown, Shield } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const RESERVED_NAMES = [
  "admin", "support", "postmaster", "abuse", "root",
  "webmaster", "info", "contact", "noreply", "security",
  "apple", "google", "microsoft", "facebook", "meta", "amazon",
  "netflix", "zihan", "zihanfakir", "owner", "ceo", "founder"
]

export default function Dashboard({ session }: { session: any }) {
  const [olomailes, setolomailes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [username, setUsername] = useState('')
  const [gmail, setGmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [isValid, setIsValid] = useState(true)

  const [olomailToDelete, setolomailToDelete] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' })
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)

  const [toast, setToast] = useState<string | null>(null)

  // To trigger re-renders for countdowns
  
  const [howItWorksLang, setHowItWorksLang] = useState<'en'|'bn'>('en')

  const navigate = useNavigate()
  const DOMAIN = import.meta.env.VITE_EMAIL_DOMAIN || 'olo.pro.bd'

  const fetchProfileAndolomailes = useCallback(async () => {
    setLoading(true)

    // Fetch profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (profileData) setProfile(profileData)

    // Fetch olomailes
    const { data, error } = await supabase
      .from('email_olomailes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching olomailes:', error)
    } else {
      setolomailes(data || [])
    }
    setLoading(false)
  }, [session.user.id])

  useEffect(() => {
    fetchProfileAndolomailes()
  }, [fetchProfileAndolomailes])

  const handleUsernameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase()
    setUsername(val)
    const regex = /^[a-z0-9._-]{3,30}$/
    const isFormatValid = val === '' || regex.test(val)
    const isReserved = RESERVED_NAMES.includes(val)
    setIsValid(isFormatValid && !isReserved)
  }, [])

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSubmitting(true)

    if (!isValid || username.length < 3) {
      setError('Invalid username format.')
      setSubmitting(false)
      return
    }

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'}/functions/v1/create-olomail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession?.access_token}`
        },
        body: JSON.stringify({ username, gmail })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create olomail')
      }

      setSuccess(`Successfully created ${username}@${DOMAIN}!`)
      setUsername('')
      setGmail('')
      fetchProfileAndolomailes()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }, [isValid, username, gmail, DOMAIN, fetchProfileAndolomailes])

  const handleDeleteClick = (olomail: string) => {
    setolomailToDelete(olomail)
  }

  const confirmDelete = async () => {
    if (!olomailToDelete) return
    const olomail = olomailToDelete
    setolomailToDelete(null)

    const previousolomailes = [...olomailes]
    setolomailes(olomailes.filter(a => a.olomail !== olomail))

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'}/functions/v1/delete-olomail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession?.access_token}`
        },
        body: JSON.stringify({ olomail })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete olomail')
      }
    } catch (err: any) {
      setolomailes(previousolomailes)
      setToast(err.message)
      setTimeout(() => setToast(null), 3000)
    }
  }

  const handleExtend = useCallback(async (olomail: string) => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'}/functions/v1/extend-olomail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession?.access_token}`
        },
        body: JSON.stringify({ olomail })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to extend time')

      setToast(data.message)
      setTimeout(() => setToast(null), 3000)
      fetchProfileAndolomailes()
    } catch (err: any) {
      setToast(err.message)
      setTimeout(() => setToast(null), 3000)
    }
  }, [fetchProfileAndolomailes])

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
    setToast('Copied to clipboard!')
    setTimeout(() => setToast(null), 3000)
  }, [])

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'New password must be at least 6 characters' })
      return
    }

    setPasswordSubmitting(true)
    setPasswordMessage({ type: '', text: '' })

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()

      // Verify current password first by trying to sign in
      if (currentSession?.user?.email) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: currentSession.user.email,
          password: currentPassword,
        })

        if (signInError) {
          throw new Error('Current password is incorrect.')
        }
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      setPasswordMessage({ type: 'success', text: 'Password updated successfully!' })
      setCurrentPassword('')
      setNewPassword('')
    } catch (err: any) {
      setPasswordMessage({ type: 'error', text: err.message })
    } finally {
      setPasswordSubmitting(false)
    }
  }

  const isPremium = profile?.premium_until && new Date(profile.premium_until) > new Date()

  const getRemainingTime = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - new Date().getTime()
    if (diff <= 0) return 'Expired'
    const h = Math.floor(diff / (1000 * 60 * 60))
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const s = Math.floor((diff % (1000 * 60)) / 1000)
    return `${h}h ${m}m ${s}s`
  }

  const getPremiumRemainingTime = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - new Date().getTime()
    if (diff <= 0) return 'Expired'
    const d = Math.floor(diff / (1000 * 60 * 60 * 24))
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const s = Math.floor((diff % (1000 * 60)) / 1000)
    return `${d}d ${h}h ${m}m ${s}s`
  }

  const canExtend = (lastExtendedAt: string | null) => {
    if (!lastExtendedAt) return true
    const now = new Date()
    let mostRecent10AM = new Date()
    mostRecent10AM.setUTCHours(4, 0, 0, 0) // 10 AM BD is 4 AM UTC
    if (now.getTime() < mostRecent10AM.getTime()) {
      mostRecent10AM.setUTCDate(mostRecent10AM.getUTCDate() - 1)
    }
    return new Date(lastExtendedAt).getTime() <= mostRecent10AM.getTime()
  }

  return (
    <div className="dashboard-container">
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--text-primary)', color: 'var(--bg-color)', padding: '12px 24px', borderRadius: '980px', zIndex: 1000, boxShadow: 'var(--shadow-md)', fontWeight: 500, fontSize: '0.9375rem', animation: 'fadeInOut 3s ease-in-out' }}>
          {toast}
          <style>{`
            @keyframes fadeInOut {
              0% { opacity: 0; transform: translate(-50%, 20px); }
              10% { opacity: 1; transform: translate(-50%, 0); }
              90% { opacity: 1; transform: translate(-50%, 0); }
              100% { opacity: 0; transform: translate(-50%, -20px); }
            }
          `}</style>
        </div>
      )}

      {olomailToDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ maxWidth: '400px', margin: '20px', padding: '24px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '12px' }}>Delete olomail</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Are you sure you want to delete <strong>{olomailToDelete}@{DOMAIN}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" style={{ width: 'auto' }} onClick={() => setolomailToDelete(null)}>Cancel</button>
              <button className="btn btn-danger" style={{ width: 'auto' }} onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {profile?.is_admin && (
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/admin')}>
            <Shield size={16} /> Admin Panel
          </button>
        </div>
      )}

      {!isPremium && (
        <div className="card premium-banner" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Crown size={32} color="#fbbf24" style={{ flexShrink: 0 }} />
            <div>
              <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.25rem' }}>Upgrade to Premium</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '4px 0 16px 0' }}>
                Keep your olomail forever without the 24-hour expiration limit.
              </p>
              <div className="premium-banner-buttons" style={{ display: 'flex', gap: '12px' }}>
                <a href="https://wa.me/zihanfakir" target="_blank" rel="noreferrer" className="btn" style={{ padding: '8px 16px', fontSize: '14px', background: '#25D366', color: 'white', border: 'none', textDecoration: 'none' }}>WhatsApp</a>
                <a href="https://t.me/zihanfakir" target="_blank" rel="noreferrer" className="btn" style={{ padding: '8px 16px', fontSize: '14px', background: '#0088cc', color: 'white', border: 'none', textDecoration: 'none' }}>Telegram</a>
              </div>
            </div>
          </div>
        </div>
      )}

      {isPremium && (
        <div className="card" style={{ marginBottom: '24px', border: '1px solid #fbbf24', background: 'rgba(251, 191, 36, 0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Crown size={24} color="#fbbf24" />
            <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>
              Premium Active until {new Date(profile.premium_until).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="card-title">Create New olomail</h2>
        <p className="card-subtitle">Claim your custom {DOMAIN} address</p>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {olomailes.length >= 1 ? (
          <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={20} />
            You can only create 1 olomail per account. Delete your existing olomail to create a new one.
          </div>
        ) : (
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label className="form-label" htmlFor="username">Desired Username</label>
              <div className="input-group">
                <input
                  id="username"
                  className="form-input"
                  style={{ borderColor: !isValid ? 'var(--danger-color)' : '' }}
                  type="text"
                  placeholder="e.g. rahim"
                  value={username}
                  onChange={handleUsernameChange}
                  required
                />
                <div className="input-group-addon">@{DOMAIN}</div>
              </div>
              {!isValid && username.length > 0 && (
                <p className="text-sm mt-4" style={{ color: 'var(--danger-color)' }}>
                  {RESERVED_NAMES.includes(username)
                    ? 'This username is reserved and cannot be used.'
                    : 'Use only lowercase letters, numbers, dots, underscores, or dashes (3-30 chars).'}
                </p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="gmail">Forward To (Gmail)</label>
              <input
                id="gmail"
                className="form-input"
                type="email"
                placeholder="your.name@gmail.com"
                value={gmail}
                onChange={(e) => setGmail(e.target.value)}
                required
                pattern=".*@gmail\.com$"
                title="Must be a valid @gmail.com address"
              />
            </div>

            <button className="btn btn-primary" type="submit" disabled={submitting || !isValid || username.length < 3}>
              <Plus size={20} />
              {submitting ? 'Creating...' : 'Create olomail'}
            </button>
          </form>
        )}
      </div>

      <div className="olomail-list" style={{ marginTop: '24px' }}>
        <h3 className="card-title" style={{ textAlign: 'left' }}>Your olomailes</h3>
        {loading ? (
          <p>Loading...</p>
        ) : olomailes.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>You don't have any olomailes yet.</p>
        ) : (
          olomailes.map((a) => (
            <div key={a.id} className="olomail-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="olomail-info">
                  <h3>{a.olomail}@{DOMAIN}</h3>
                  <p><Mail size={14} /> Forwards to: {a.forward_to}</p>

                  {!isPremium ? (
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger-color)' }}>
                      <Clock size={16} />
                      <span style={{ fontWeight: 'bold' }}>
                        {getRemainingTime(a.expires_at) === 'Expired'
                          ? 'Expired'
                          : `${getRemainingTime(a.expires_at)} left`}
                      </span>
                    </div>
                  ) : (
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981' }}>
                      <Crown size={16} />
                      <span style={{ fontWeight: 'bold' }}>Premium: {getPremiumRemainingTime(profile.premium_until)} left</span>
                    </div>
                  )}
                </div>
                <div className="olomail-actions">
                  <button
                    className="btn-icon btn-outline cursor-pointer"
                    onClick={() => copyToClipboard(`${a.olomail}@${DOMAIN}`)}
                    title="Copy to clipboard"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    className="btn-icon btn-danger cursor-pointer"
                    onClick={() => handleDeleteClick(a.olomail)}
                    title="Delete olomail"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {!isPremium && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {canExtend(a.last_extended_at) ? 'Extend time by 24h' : 'Limit reached. Resets at 10 AM.'}
                  </span>
                  <button
                    className="btn btn-outline"
                    style={{ padding: '6px 12px', fontSize: '13px', width: 'auto' }}
                    onClick={() => handleExtend(a.olomail)}
                    disabled={!canExtend(a.last_extended_at)}
                  >
                    <Clock size={14} /> Extend Time
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="card" style={{ marginTop: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="card-title" style={{ textAlign: 'left', fontSize: '1.5rem', margin: 0 }}>How it works ðŸš€</h3>
          <button
            className="btn btn-secondary"
            style={{ width: 'auto', padding: '4px 12px', fontSize: '12px', borderRadius: '8px' }}
            onClick={() => setHowItWorksLang(lang => lang === 'en' ? 'bn' : 'en')}
          >
            {howItWorksLang === 'en' ? 'à¦¬à¦¾à¦‚à¦²à¦¾' : 'English'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ backgroundColor: 'var(--primary-brand)', color: 'white', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>1</div>
            <div>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                {howItWorksLang === 'en' ? 'Create an olomail' : 'à¦…à§à¦¯à¦¾à¦²à¦¿à§Ÿà¦¾à¦¸ à¦¤à§ˆà¦°à¦¿ à¦•à¦°à§à¦¨'}
              </strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
                {howItWorksLang === 'en'
                  ? <>Choose a custom username (e.g., <code style={{ backgroundColor: 'var(--input-bg)', padding: '2px 6px', borderRadius: '4px' }}>yourusername</code>).</>
                  : <>à¦†à¦ªà¦¨à¦¾à¦° à¦ªà¦›à¦¨à§à¦¦à¦®à¦¤à§‹ à¦à¦•à¦Ÿà¦¿ à¦‡à¦‰à¦œà¦¾à¦°à¦¨à§‡à¦® à¦¦à¦¿à¦¨ (à¦¯à§‡à¦®à¦¨: <code style={{ backgroundColor: 'var(--input-bg)', padding: '2px 6px', borderRadius: '4px' }}>yourusername</code>)à¥¤</>}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ backgroundColor: 'var(--primary-brand)', color: 'white', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>2</div>
            <div>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                {howItWorksLang === 'en' ? 'Set your Gmail' : 'à¦œà¦¿à¦®à§‡à¦‡à¦² à¦¸à§‡à¦Ÿ à¦•à¦°à§à¦¨'}
              </strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
                {howItWorksLang === 'en'
                  ? 'Enter your real Gmail address where you want to receive emails.'
                  : 'à¦†à¦ªà¦¨à¦¾à¦° à¦†à¦¸à¦² à¦œà¦¿à¦®à§‡à¦‡à¦² à¦…à§à¦¯à¦¾à¦¡à§à¦°à§‡à¦¸à¦Ÿà¦¿ à¦¦à¦¿à¦¨, à¦¯à§‡à¦–à¦¾à¦¨à§‡ à¦†à¦ªà¦¨à¦¿ à¦®à§‡à¦‡à¦² à¦°à¦¿à¦¸à¦¿à¦­ à¦•à¦°à¦¤à§‡ à¦šà¦¾à¦¨à¥¤'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ backgroundColor: 'var(--primary-brand)', color: 'white', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>3</div>
            <div>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                {howItWorksLang === 'en' ? "You're all set!" : 'à¦¸à¦¬ à¦ªà§à¦°à¦¸à§à¦¤à§à¦¤!'}
              </strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
                {howItWorksLang === 'en'
                  ? <>Any email sent to <strong style={{ color: 'var(--text-primary)' }}>yourusername@{DOMAIN}</strong> will instantly forward to your hidden Gmail inbox.</>
                  : <>à¦à¦–à¦¨ à¦¥à§‡à¦•à§‡ <strong style={{ color: 'var(--text-primary)' }}>yourusername@{DOMAIN}</strong> à¦ à¦¿à¦•à¦¾à¦¨à¦¾à§Ÿ à¦†à¦¸à¦¾ à¦¸à¦¬ à¦®à§‡à¦‡à¦² à¦†à¦ªà¦¨à¦¾à¦° à¦—à§‹à¦ªà¦¨ à¦œà¦¿à¦®à§‡à¦‡à¦²à§‡ à¦šà¦²à§‡ à¦¯à¦¾à¦¬à§‡à¥¤</>}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <h3 className="card-title" style={{ textAlign: 'left' }}>Change Password</h3>

        {passwordMessage.text && (
          <div className={`alert alert-${passwordMessage.type === 'error' ? 'error' : 'success'}`}>
            {passwordMessage.text}
          </div>
        )}

        <form onSubmit={handleChangePassword}>
          <div className="form-group">
            <input
              className="form-input"
              type="password"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <input
              className="form-input"
              type="password"
              placeholder="Enter new password (min 6 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={passwordSubmitting || newPassword.length < 6 || !currentPassword}>
            {passwordSubmitting ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
