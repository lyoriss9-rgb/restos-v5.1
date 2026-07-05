import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState('login') // login | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess('')
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setSuccess('Compte créé ! Vérifiez votre email pour confirmer.')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20,
      background:'radial-gradient(900px 500px at 50% -10%, #1A241B, var(--bg))' }}>
      <div style={{ width:'min(400px,100%)', textAlign:'center' }}>

        {/* Logo */}
        <div className="serif" style={{ fontSize:48, marginBottom:6 }}>
          Rest<span style={{ color:'var(--copper)' }}>OS</span>
        </div>
        <div style={{ color:'var(--muted)', fontSize:14, marginBottom:30 }}>
          Le directeur d'exploitation virtuel de votre restaurant
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', background:'var(--surface)', border:'1px solid var(--line)', borderRadius:12, marginBottom:20, padding:4 }}>
          {['login','signup'].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex:1, padding:'9px 0', borderRadius:9, fontSize:13.5, fontWeight:600,
              background: mode===m ? 'var(--copper)' : 'transparent',
              color: mode===m ? '#14100A' : 'var(--muted)',
              transition:'all .15s'
            }}>
              {m === 'login' ? 'Se connecter' : 'Créer un compte'}
            </button>
          ))}
        </div>

        {/* Form */}
        <div className="card" style={{ textAlign:'left' }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:11, letterSpacing:'.1em', textTransform:'uppercase', color:'var(--muted)', display:'block', marginBottom:6 }}>
                Email
              </label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="direction@monrestaurant.fr" required />
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:11, letterSpacing:'.1em', textTransform:'uppercase', color:'var(--muted)', display:'block', marginBottom:6 }}>
                Mot de passe
              </label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required minLength={6} />
            </div>
            {error && <div style={{ background:'var(--red-soft)', color:'var(--red)', borderRadius:8, padding:'10px 12px', marginBottom:14, fontSize:13 }}>{error}</div>}
            {success && <div style={{ background:'var(--green-soft)', color:'var(--green)', borderRadius:8, padding:'10px 12px', marginBottom:14, fontSize:13 }}>{success}</div>}
            <button className="btn btn-copper" type="submit" disabled={loading} style={{ width:'100%', padding:'12px 0', fontSize:15 }}>
              {loading ? 'Chargement…' : mode === 'login' ? 'Se connecter →' : 'Créer mon compte →'}
            </button>
          </form>
        </div>

        <div style={{ color:'var(--muted)', fontSize:11.5, marginTop:14 }}>
          Démonstration V5 · Vos données sont sécurisées
        </div>
      </div>
    </div>
  )
}
