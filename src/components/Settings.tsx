import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Crown, User, Copy, ExternalLink, ArrowLeft } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

export default function Settings({ session }: { session: any }) {
  const navigate = useNavigate()
  const DOMAIN = import.meta.env.VITE_EMAIL_DOMAIN || 'olo.pro.bd'
  
  const [profile, setProfile] = useState<any>(null)
  const [aliases, setAliases] = useState<any[]>([])
  
  const [profileForm, setProfileForm] = useState({ display_name: '', bio: '', website: '', twitter: '', facebook: '', instagram: '', whatsapp: '', avatar_id: '' })
  const [profileSubmitting, setProfileSubmitting] = useState(false)
  
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' })
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)
  const [activatingTrial, setActivatingTrial] = useState(false)
  
  const [toast, setToast] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    // Fetch profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      
    if (profileData) {
      setProfile(profileData)
      setProfileForm({
        display_name: profileData.display_name || '',
        bio: profileData.bio || '',
        website: profileData.social_links?.website || '',
        twitter: profileData.social_links?.twitter || '',
        facebook: profileData.social_links?.facebook || '',
        instagram: profileData.social_links?.instagram || '',
        whatsapp: profileData.social_links?.whatsapp || '',
        avatar_id: profileData.social_links?.avatar_id || ''
      })
    }

    // Fetch aliases for the public profile link
    const { data } = await supabase
      .from('email_aliases')
      .select('alias')
      .eq('user_id', session.user.id)
      
    if (data) setAliases(data)
  }, [session.user.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isPremium) {
      setToast('Upgrade to Premium to save and use your public profile!')
      setTimeout(() => setToast(null), 3000)
      return
    }
    
    setProfileSubmitting(true)
    
    try {
      const social_links = {
        ...(profileForm.website ? { website: profileForm.website } : {}),
        ...(profileForm.twitter ? { twitter: profileForm.twitter } : {}),
        ...(profileForm.facebook ? { facebook: profileForm.facebook } : {}),
        ...(profileForm.instagram ? { instagram: profileForm.instagram } : {}),
        ...(profileForm.whatsapp ? { whatsapp: profileForm.whatsapp } : {}),
        ...(profileForm.avatar_id ? { avatar_id: profileForm.avatar_id } : {})
      }
      
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: profileForm.display_name,
          bio: profileForm.bio,
          social_links
        })
        .eq('id', session.user.id)
        
      if (error) throw error
      
      setToast('Public profile updated successfully!')
      setTimeout(() => setToast(null), 3000)
    } catch (err: any) {
      setToast(err.message)
      setTimeout(() => setToast(null), 3000)
    } finally {
      setProfileSubmitting(false)
    }
  }

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
      
      if (!currentSession?.user?.email) {
        throw new Error('User email not found in session.')
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentSession.user.email,
        password: currentPassword,
      })
      if (signInError) throw new Error('Current password is incorrect.')

      const { error } = await supabase.auth.updateUser({ password: newPassword })
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setToast('Copied to clipboard!')
    setTimeout(() => setToast(null), 3000)
  }

  const activateTrial = async () => {
    setActivatingTrial(true)
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'}/functions/v1/activate-trial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession?.access_token}`
        }
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to activate trial')
      
      setToast('3-Day Premium Trial activated successfully!')
      setTimeout(() => setToast(null), 3000)
      fetchData()
    } catch (err: any) {
      setToast(err.message)
      setTimeout(() => setToast(null), 5000)
    } finally {
      setActivatingTrial(false)
    }
  }

  const isPremium = profile?.is_admin || (profile?.premium_until && new Date(profile.premium_until) > new Date())

  return (
    <div className="dashboard-container" style={{ maxWidth: '600px', margin: '0 auto' }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--text-primary)', color: 'var(--bg-color)', padding: '12px 24px', borderRadius: '980px', zIndex: 1000, boxShadow: 'var(--shadow-md)', fontWeight: 500, fontSize: '0.9375rem', animation: 'fadeInOut 3s ease-in-out' }}>
          {toast}
        </div>
      )}

      <button className="btn btn-outline" style={{ width: 'auto', marginBottom: '24px' }} onClick={() => navigate('/')}>
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <h2 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '24px' }}>Settings</h2>

      {!isPremium && (
        <div className="card premium-banner fade-in-up" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Crown size={32} color="#fbbf24" style={{ flexShrink: 0 }} />
            <div>
              <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.25rem' }}>Upgrade to Premium</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '4px 0 16px 0' }}>
                Get a lifetime olomail and unlock custom public profiles!
              </p>
              <div className="premium-banner-buttons" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {profile && !profile.has_used_trial && (
                  <button 
                    className="btn" 
                    style={{ padding: '8px 16px', fontSize: '14px', background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', color: 'white', border: 'none', cursor: activatingTrial ? 'not-allowed' : 'pointer', opacity: activatingTrial ? 0.7 : 1 }}
                    onClick={activateTrial}
                    disabled={activatingTrial}
                  >
                    {activatingTrial ? 'Activating...' : 'Start 3-Day Free Trial'}
                  </button>
                )}
                <a href="https://wa.me/zihanfakir" target="_blank" rel="noreferrer" className="btn" style={{ padding: '8px 16px', fontSize: '14px', background: '#25D366', color: 'white', border: 'none', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>WhatsApp</a>
                <a href="https://t.me/zihanfakir" target="_blank" rel="noreferrer" className="btn" style={{ padding: '8px 16px', fontSize: '14px', background: '#0088cc', color: 'white', border: 'none', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>Telegram</a>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card fade-in-up" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <User size={24} color="var(--primary-brand)" />
            <h3 className="card-title" style={{ textAlign: 'left', fontSize: '1.5rem', margin: 0 }}>
              Public Profile {!isPremium && <span style={{ fontSize: '12px', background: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24', padding: '2px 8px', borderRadius: '12px', verticalAlign: 'middle', marginLeft: '8px' }}>PREMIUM</span>}
            </h3>
          </div>
          {aliases.length > 0 && isPremium && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                type="button"
                className="btn btn-outline" 
                style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}
                onClick={() => copyToClipboard(`https://${DOMAIN}/u/${aliases[0].alias}`)}
                title="Copy Profile Link"
              >
                <Copy size={14} /> Copy Link
              </button>
              <Link to={`/u/${aliases[0].alias}`} target="_blank" className="btn btn-primary" style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}>
                <ExternalLink size={14} /> Visit
              </Link>
            </div>
          )}
        </div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
          Customize your public presence at <strong>{DOMAIN}/u/your-olomail</strong>.
        </p>
        
        <form onSubmit={handleUpdateProfile}>
          <div className="form-group">
            <label className="form-label">Display Name</label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. John Doe"
              value={profileForm.display_name}
              onChange={(e) => setProfileForm({ ...profileForm, display_name: e.target.value })}
              maxLength={50}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label" style={{ marginBottom: '16px' }}>Select Avatar</label>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {[1, 2, 3, 4].map((num) => (
                <div 
                  key={num}
                  onClick={() => setProfileForm({...profileForm, avatar_id: num.toString()})}
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    border: profileForm.avatar_id === num.toString() ? '3px solid var(--primary-brand)' : '3px solid transparent',
                    backgroundImage: `url(/avatars/avatar${num}.jpg)`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    transition: 'all 0.2s',
                    boxShadow: profileForm.avatar_id === num.toString() ? '0 0 15px rgba(0, 113, 227, 0.4)' : 'none'
                  }}
                />
              ))}
              <div 
                onClick={() => setProfileForm({...profileForm, avatar_id: ''})}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  border: profileForm.avatar_id === '' ? '3px solid var(--primary-brand)' : '3px solid transparent',
                  backgroundColor: 'var(--bg-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  transition: 'all 0.2s'
                }}
              >
                None
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Bio</label>
            <textarea
              className="form-input"
              placeholder="A short description about yourself"
              value={profileForm.bio}
              onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
              rows={3}
              maxLength={200}
              style={{ resize: 'vertical' }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Website (Optional)</label>
            <input
              className="form-input"
              type="url"
              placeholder="https://yourwebsite.com"
              value={profileForm.website}
              onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Twitter / X (Optional)</label>
            <input
              className="form-input"
              type="text"
              placeholder="@yourhandle or URL"
              value={profileForm.twitter}
              onChange={(e) => setProfileForm({ ...profileForm, twitter: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Facebook (Optional)</label>
              <input
                className="form-input"
                type="text"
                placeholder="@username or URL"
                value={profileForm.facebook}
                onChange={(e) => setProfileForm({...profileForm, facebook: e.target.value})}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Instagram (Optional)</label>
              <input
                className="form-input"
                type="text"
                placeholder="@username or URL"
                value={profileForm.instagram}
                onChange={(e) => setProfileForm({...profileForm, instagram: e.target.value})}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">WhatsApp Number (Optional)</label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. +8801XXXXXXXXX"
              value={profileForm.whatsapp}
              onChange={(e) => setProfileForm({...profileForm, whatsapp: e.target.value})}
            />
          </div>
          <button 
            className={isPremium ? "btn btn-primary" : "btn"} 
            style={!isPremium ? { background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', color: '#fff', border: 'none' } : {}}
            type="submit" 
            disabled={profileSubmitting}
          >
            {profileSubmitting ? 'Saving...' : (isPremium ? 'Save Profile' : 'Upgrade to Premium to Save')}
          </button>
        </form>
      </div>

      <div className="card fade-in-up">
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
