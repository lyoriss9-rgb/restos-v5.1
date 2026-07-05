import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

const PLANS = [
  { key:'pilot',      icon:'🟢', name:'Pilot',      sub:"L'IA propose, vous décidez", price:'99 €/mois' },
  { key:'autopilot',  icon:'🔵', name:'Autopilot',  sub:"L'IA exécute dans vos mandats", price:'249 €/mois' },
  { key:'enterprise', icon:'🟣', name:'Enterprise', sub:'Multi-sites, console groupe', price:'Sur devis' },
]

export default function Onboarding({ onDone, userId }) {
  const [step, setStep] = useState(1)
  const [data, setData] = useState({ name:'', city:'La Rochelle', seats:50, plan:'autopilot', phone:'', email:'' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(k, v) { setData(d => ({ ...d, [k]: v })) }

  async function createRestaurant() {
    setLoading(true); setError('')
    const slug = data.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-') + '-' + Date.now()
    const { data: resto, error: e1 } = await supabase.from('restaurants').insert({ ...data, slug }).select().single()
    if (e1) { setError(e1.message); setLoading(false); return }
    const { error: e2 } = await supabase.from('restaurant_members').insert({ restaurant_id: resto.id, user_id: userId, role:'owner' })
    if (e2) { setError(e2.message); setLoading(false); return }
    // Agents par défaut
    await supabase.from('agent_settings').insert([
      { restaurant_id:resto.id, agent_key:'agent_director',   autonomy_level:2 },
      { restaurant_id:resto.id, agent_key:'agent_reviews',    autonomy_level:2 },
      { restaurant_id:resto.id, agent_key:'agent_orders',     autonomy_level:1 },
      { restaurant_id:resto.id, agent_key:'agent_planning',   autonomy_level:1 },
      { restaurant_id:resto.id, agent_key:'agent_haccp',      autonomy_level:2 },
      { restaurant_id:resto.id, agent_key:'agent_marketing',  autonomy_level:2 },
    ])
    onDone({ ...resto, role:'owner' })
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20,
      background:'radial-gradient(900px 500px at 50% -10%, #1A241B, var(--bg))' }}>
      <div style={{ width:'min(480px,100%)' }}>
        <div className="serif" style={{ fontSize:28, marginBottom:4 }}>
          Rest<span style={{ color:'var(--copper)' }}>OS</span>
        </div>
        <div style={{ color:'var(--muted)', fontSize:13, marginBottom:24 }}>
          Configuration de votre restaurant · étape {step}/3
        </div>

        {/* Progress */}
        <div style={{ display:'flex', gap:6, marginBottom:28 }}>
          {[1,2,3].map(n => (
            <div key={n} style={{ flex:1, height:3, borderRadius:99, background: step>=n ? 'var(--copper)' : 'var(--surface3)', transition:'background .3s' }} />
          ))}
        </div>

        {step === 1 && (
          <div className="card animate-pop">
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:650, marginBottom:16 }}>
              Votre restaurant
            </div>
            {[
              { label:'Nom du restaurant', key:'name', placeholder:'La Marée', type:'text' },
              { label:'Ville', key:'city', placeholder:'La Rochelle', type:'text' },
              { label:'Email du restaurant', key:'email', placeholder:'contact@monresto.fr', type:'email' },
              { label:'Téléphone', key:'phone', placeholder:'05 46 00 00 00', type:'tel' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:14 }}>
                <label style={{ fontSize:11, letterSpacing:'.1em', textTransform:'uppercase', color:'var(--muted)', display:'block', marginBottom:5 }}>{f.label}</label>
                <input className="input" type={f.type} value={data[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
              </div>
            ))}
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:11, letterSpacing:'.1em', textTransform:'uppercase', color:'var(--muted)', display:'block', marginBottom:5 }}>Nombre de couverts</label>
              <input className="input" type="number" value={data.seats} onChange={e => set('seats', parseInt(e.target.value))} min={10} max={500} />
            </div>
            <button className="btn btn-copper" style={{ width:'100%' }} onClick={() => data.name && setStep(2)} disabled={!data.name}>
              Continuer →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="card animate-pop">
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:650, marginBottom:6 }}>Votre formule</div>
            <div style={{ color:'var(--muted)', fontSize:13, marginBottom:16 }}>Vous pourrez changer à tout moment.</div>
            {PLANS.map(p => (
              <button key={p.key} onClick={() => set('plan', p.key)} style={{
                width:'100%', textAlign:'left', padding:'14px 16px', borderRadius:12, marginBottom:8,
                background: data.plan===p.key ? 'var(--copper-soft)' : 'var(--surface2)',
                border: `1px solid ${data.plan===p.key ? 'var(--copper)' : 'var(--line)'}`,
                display:'flex', alignItems:'center', gap:12, cursor:'pointer', transition:'all .15s'
              }}>
                <span style={{ fontSize:22 }}>{p.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, color: data.plan===p.key ? 'var(--copper)' : 'var(--ink)', fontSize:15 }}>{p.name}</div>
                  <div style={{ color:'var(--muted)', fontSize:12.5, marginTop:2 }}>{p.sub}</div>
                </div>
                <div style={{ fontWeight:700, color: data.plan===p.key ? 'var(--copper)' : 'var(--muted)', fontSize:13 }}>{p.price}</div>
              </button>
            ))}
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← Retour</button>
              <button className="btn btn-copper" style={{ flex:1 }} onClick={() => setStep(3)}>Continuer →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="card animate-pop">
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:650, marginBottom:16 }}>Tout est prêt ✓</div>
            {[
              { label:'Restaurant', value: data.name },
              { label:'Ville', value: data.city },
              { label:'Couverts', value: data.seats },
              { label:'Formule', value: data.plan.charAt(0).toUpperCase() + data.plan.slice(1) },
            ].map(r => (
              <div key={r.label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px dashed var(--line)', fontSize:14 }}>
                <span style={{ color:'var(--muted)' }}>{r.label}</span>
                <span style={{ fontWeight:600 }}>{r.value}</span>
              </div>
            ))}
            {error && <div style={{ background:'var(--red-soft)', color:'var(--red)', borderRadius:8, padding:'10px 12px', marginTop:12, fontSize:13 }}>{error}</div>}
            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <button className="btn btn-ghost" onClick={() => setStep(2)}>← Retour</button>
              <button className="btn btn-green" style={{ flex:1 }} onClick={createRestaurant} disabled={loading}>
                {loading ? 'Création…' : 'Lancer RestOS →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
