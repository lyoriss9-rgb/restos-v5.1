import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [session, setSession] = useState(null)
  const [restaurant, setRestaurant] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadRestaurant(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadRestaurant(session.user.id)
      else { setRestaurant(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadRestaurant(userId) {
    const { data } = await supabase
      .from('restaurant_members')
      .select('restaurant_id, role, restaurants(*)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()
    if (data?.restaurants) setRestaurant({ ...data.restaurants, role: data.role })
    setLoading(false)
  }

  if (loading) return <Splash />

  return (
    <Routes>
      <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
      <Route path="/onboarding" element={session && !restaurant ? <Onboarding onDone={r => setRestaurant(r)} userId={session.user.id} /> : <Navigate to="/" />} />
      <Route path="/*" element={
        !session ? <Navigate to="/login" /> :
        !restaurant ? <Navigate to="/onboarding" /> :
        <Dashboard restaurant={restaurant} session={session} onLogout={() => supabase.auth.signOut()} />
      } />
    </Routes>
  )
}

function Splash() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:16 }}>
      <div className="serif" style={{ fontSize:32, color:'var(--ink)' }}>
        Rest<span style={{ color:'var(--copper)' }}>OS</span>
      </div>
      <div style={{ width:160, height:3, background:'var(--surface3)', borderRadius:99, overflow:'hidden' }}>
        <div style={{ height:'100%', width:'100%', background:'var(--copper)', borderRadius:99, animation:'slideup 1.2s ease forwards' }} />
      </div>
      <div style={{ color:'var(--muted)', fontSize:13 }}>Chargement…</div>
    </div>
  )
}
