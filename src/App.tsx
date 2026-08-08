import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { Routes, Route } from 'react-router-dom'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import AdminPanel from './components/AdminPanel'
import PublicProfile from './components/PublicProfile'
import Settings from './components/Settings'
import { LogOut, Sun, Moon, Settings as SettingsIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved as 'light' | 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    }).catch(err => {
      console.error('Failed to get session', err)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-container">
          <img src="/olomail-logo.svg" alt="Logo" className="logo-image" style={{ borderRadius: '8px' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ lineHeight: '1.2' }}>olomail</span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500', marginTop: '-2px' }}>From zihan</span>
          </div>
        </div>
        <div className="header-actions">
          {session && (
            <Link to="/settings" className="theme-toggle" title="Settings">
              <SettingsIcon size={20} />
            </Link>
          )}

          <button 
            className="theme-toggle" 
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title="Toggle theme"
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          
          {session && (
            <button 
              className="btn btn-outline" 
              style={{ width: 'auto', padding: '0.5rem 1rem', borderRadius: '980px' }}
              onClick={() => supabase.auth.signOut()}
            >
              <LogOut size={16} /> Sign Out
            </button>
          )}
        </div>
      </header>

      <main className="main-content">
        <Routes>
          <Route path="/u/:alias" element={<PublicProfile />} />
          <Route path="/" element={
            !session ? <Auth /> : <Dashboard session={session} />
          } />
          <Route path="/admin" element={
            !session ? <Auth /> : <AdminPanel session={session} />
          } />
          <Route path="/settings" element={
            !session ? <Auth /> : <Settings session={session} />
          } />
        </Routes>
      </main>
    </div>
  )
}

export default App
