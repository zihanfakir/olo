import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (!email.toLowerCase().endsWith('@gmail.com')) {
      setError('Only Gmail accounts (@gmail.com) are allowed.')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      setLoading(false)
      return
    }

    let hasError = false;
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('Account created successfully! You can now sign in.')
      }
    } catch (error: any) {
      hasError = true;
      setError(error.message)
    } finally {
      // The component unmounts on successful login because App.tsx renders Dashboard.
      // We only want to set loading false if we are still on the auth screen.
      if (!isLogin || hasError) {
        setLoading(false)
      }
    }
  }

  return (
    <div className="card fade-in-up">
      <h2 className="card-title">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
      <p className="card-subtitle">
        {isLogin ? 'Sign in to manage your olomails' : 'Sign up to claim your custom email'}
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <form onSubmit={handleAuth}>
        <div className="form-group">
          <label className="form-label" htmlFor="email">Email</label>
          <input
            id="email"
            className="form-input"
            type="email"
            placeholder="Your primary email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="password">Password</label>
          <input
            id="password"
            className="form-input"
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            maxLength={20}
            required
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button 
          className="btn btn-outline" 
          onClick={() => {
            setIsLogin(!isLogin)
            setError(null)
            setMessage(null)
          }}
        >
          {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
        </button>
      </div>
    </div>
  )
}
