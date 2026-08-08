import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ExternalLink, ArrowLeft, Shield } from 'lucide-react'

export default function PublicProfile() {
  const { alias } = useParams<{ alias: string }>()
  const [profileData, setProfileData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const DOMAIN = import.meta.env.VITE_EMAIL_DOMAIN || 'olo.pro.bd'

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // Find the user_id for this alias
        const { data: aliasData, error: aliasError } = await supabase
          .from('email_aliases')
          .select('user_id')
          .eq('alias', alias)
          .single()

        if (aliasError || !aliasData) {
          throw new Error('Profile not found')
        }

        // Fetch their profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('display_name, bio, social_links, premium_until, is_admin')
          .eq('id', aliasData.user_id)
          .single()

        if (profileError || !profile) {
          throw new Error('Profile not found')
        }

        // Check if premium or admin
        const isPremium = profile.is_admin || (profile.premium_until && new Date(profile.premium_until) > new Date())
        if (!isPremium && !profile.is_admin) {
          throw new Error('This public profile is not available or the user is not Premium.')
        }

        setProfileData(profile)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (alias) fetchProfile()
  }, [alias])

  if (loading) {
    return (
      <div className="card" style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
        <p>Loading profile...</p>
      </div>
    )
  }

  if (error || !profileData) {
    return (
      <div className="card" style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
        <h2 className="card-title" style={{ fontSize: '1.5rem', marginBottom: '16px' }}>Profile Not Found</h2>
        <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
        <Link to="/" className="btn btn-primary" style={{ marginTop: '24px', width: 'auto' }}>
          <ArrowLeft size={16} /> Go Home
        </Link>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', maxWidth: '600px', margin: '0 auto', paddingTop: '40px' }}>
      <div className="card" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        textAlign: 'center',
        padding: '3rem 2rem'
      }}>
        <div style={{
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          background: profileData.social_links?.avatar_id ? 'transparent' : 'var(--primary-brand)',
          backgroundImage: profileData.social_links?.avatar_id ? `url(/avatars/avatar${profileData.social_links.avatar_id}.jpg)` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          color: 'white',
          fontSize: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
          boxShadow: 'var(--glass-shadow)'
        }}>
          {!profileData.social_links?.avatar_id && (
            profileData.display_name ? profileData.display_name.charAt(0).toUpperCase() : alias?.charAt(0).toUpperCase()
          )}
        </div>

        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-primary)' }}>
          {profileData.display_name || alias}
        </h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary-brand)', backgroundColor: 'rgba(0, 113, 227, 0.1)', padding: '4px 12px', borderRadius: '980px', fontSize: '0.875rem', marginBottom: '24px' }}>
          <Shield size={14} /> Verified olomail user
        </div>

        <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '32px', maxWidth: '80%' }}>
          {profileData.bio || 'This user prefers to keep an air of mystery.'}
        </p>

        {profileData.social_links && Object.keys(profileData.social_links).length > 0 && (
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
            {Object.entries(profileData.social_links)
              .filter(([platform]) => platform !== 'avatar_id')
              .map(([platform, url]) => {
              let href = url as string;
              
              if (platform === 'whatsapp') {
                const cleanNumber = href.replace(/[^0-9]/g, '');
                href = `https://wa.me/${cleanNumber}`;
              } else {
                // If it doesn't look like a URL (no dot, no http), treat it as a username
                if (!href.includes('.') && !href.startsWith('http')) {
                  const cleanUsername = href.replace('@', '');
                  if (platform === 'twitter' || platform === 'x') href = `https://twitter.com/${cleanUsername}`;
                  else if (platform === 'instagram') href = `https://instagram.com/${cleanUsername}`;
                  else if (platform === 'facebook') href = `https://facebook.com/${cleanUsername}`;
                  else href = `https://${href}`;
                } else if (!href.startsWith('http://') && !href.startsWith('https://')) {
                  href = `https://${href}`;
                }
                
                try {
                  const parsed = new URL(href);
                  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                    href = '#';
                  }
                } catch (e) {
                  href = '#';
                }
              }
              
              if (href === '#') return null; // Skip invalid links

              return (
                <a 
                  key={platform} 
                  href={href as string} 
                  target="_blank" 
                  rel="noreferrer"
                  className="btn btn-outline"
                  style={{ width: 'auto', padding: '8px 16px', borderRadius: '12px' }}
                >
                  <ExternalLink size={16} /> {platform.charAt(0).toUpperCase() + platform.slice(1)}
                </a>
              )
            })}
          </div>
        )}

        <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid var(--border-color)', width: '100%' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Contact me at: <br/>
            <strong style={{ color: 'var(--text-primary)', fontSize: '1.1rem', display: 'block', marginTop: '8px' }}>
              {alias}@{DOMAIN}
            </strong>
          </p>
        </div>
      </div>
    </div>
  )
}
