import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [session, setSession] = useState(null)
  const [restaurants, setRestaurants] = useState(null) // null = chargement
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadRestaurants(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
      if (session) loadRestaurants(session.user.id)
      else { setRestaurants(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadRestaurants(userId) {
    setLoading(true)
    const { data } = await supabase
      .from('restaurant_members')
      .select('restaurant_id, role, restaurants(*)')
      .eq('user_id', userId)
      .eq('is_active', true)
    
    const list = (data || [])
      .filter(d => d.restaurants)
      .map(d => ({ ...d.restaurants, role: d.role }))
    
    setRestaurants(list)
    setLoading(false)
  }

  if (loading) return <Splash />

  const hasRestaurants = restaurants && restaurants.length > 0

  return (
    <Routes>
      <Route path="/login" element={
        !session ? <Login /> : <Navigate to="/" />
      } />
      <Route path="/onboarding" element={
        session && !hasRestaurants
          ? <Onboarding onDone={r => setRestaurants([r])} userId={session.user.id} />
          : <Navigate to="/" />
      } />
      <Route path="/*" element={
        !session
          ? <Navigate to="/login" />
          : !hasRestaurants
            ? <Navigate to="/onboarding" />
            : <Dashboard
                restaurant={restaurants[0]}
                restaurants={restaurants}
                session={session}
                onLogout={() => supabase.auth.signOut()}
              />
      } />
    </Routes>
  )
}

function Splash() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:20, background:'var(--bg)' }}>
      <div style={{ fontSize:32, fontWeight:800, letterSpacing:'-0.04em' }}>
        Rest<span style={{ color:'var(--gold)' }}>OS</span>
      </div>
      <div style={{ width:120, height:2, background:'var(--s3)', borderRadius:99, overflow:'hidden' }}>
        <div style={{ height:'100%', background:'var(--gold)', borderRadius:99, animation:'loading 1.4s ease infinite' }} />
      </div>
      <style>{`@keyframes loading { 0%{width:0%} 50%{width:100%} 100%{width:0%;margin-left:100%} }`}</style>
    </div>
  )
}
