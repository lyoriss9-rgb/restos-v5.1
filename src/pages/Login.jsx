import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Email ou mot de passe incorrect.')
    setLoading(false)
  }

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      padding:20, background:'var(--bg)',
      backgroundImage:'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(232,184,109,.08), transparent)'
    }}>
      <div style={{ width:'min(380px,100%)' }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:40 }}>
          <div style={{ fontSize:38, fontWeight:800, letterSpacing:'-0.04em', color:'var(--t1)' }}>
            Rest<span style={{ color:'var(--gold)' }}>OS</span>
          </div>
          <div style={{ fontSize:14, color:'var(--t3)', marginTop:8 }}>
            Système d'exploitation de la restauration
          </div>
        </div>

        {/* Card */}
        <div style={{
          background:'var(--s1)', border:'1px solid var(--b1)',
          borderRadius:20, padding:'32px 28px',
          boxShadow:'0 24px 60px rgba(0,0,0,.4)'
        }}>
          <div style={{ fontSize:18, fontWeight:700, marginBottom:6 }}>Connexion</div>
          <div style={{ fontSize:13, color:'var(--t3)', marginBottom:24 }}>
            Accédez à votre espace de pilotage
          </div>

          <form onSubmit={submit}>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:600, letterSpacing:'.08em', textTransform:'uppercase', color:'var(--t3)', marginBottom:7 }}>Email</div>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="direction@mongroupe.fr" required autoComplete="email" />
            </div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:600, letterSpacing:'.08em', textTransform:'uppercase', color:'var(--t3)', marginBottom:7 }}>Mot de passe</div>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required autoComplete="current-password" />
            </div>

            {error && (
              <div style={{ background:'var(--red-bg)', border:'1px solid var(--red-bd)', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:13, color:'var(--red)' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width:'100%', padding:'13px 0', borderRadius:12,
              background:'var(--gold)', color:'#0A0800',
              fontWeight:800, fontSize:15, cursor:'pointer', border:'none',
              opacity: loading ? .7 : 1, transition:'opacity .15s'
            }}>
              {loading ? 'Connexion…' : 'Se connecter →'}
            </button>
          </form>
        </div>

        <div style={{ textAlign:'center', marginTop:20, fontSize:12, color:'var(--t3)' }}>
          RestOS · Données sécurisées · Chiffrement end-to-end
        </div>
      </div>
    </div>
  )
}
