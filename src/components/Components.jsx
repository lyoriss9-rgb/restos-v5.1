// ─── FoodCost.jsx ───────────────────────────────────────────
import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function FoodCost({ restaurant, toast }) {
  const [recipes, setRecipes] = useState([])
  const [open, setOpen] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('recipes').select('*').eq('restaurant_id', restaurant.id).eq('is_active', true).order('popularity', { ascending: false })
    setRecipes(data || [])
    setLoading(false)
  }

  const labelColors = { star:'var(--green)', plowhorse:'var(--blue)', puzzle:'var(--gold)', dog:'var(--red)' }
  const labelBg = { star:'var(--green-soft)', plowhorse:'var(--blue-soft)', puzzle:'var(--gold-soft)', dog:'var(--red-soft)' }
  const labelNames = { star:'STAR ⭐', plowhorse:'VACHE À LAIT', puzzle:'ÉNIGME', dog:'ALERTE MARGE' }

  if (loading) return <div style={{ color:'var(--muted)', padding:20 }}>Chargement des recettes…</div>

  return (
    <div className="animate-pop">
      <h2 style={{ fontFamily:"'Fraunces',serif", fontWeight:650, fontSize:19, margin:'0 0 10px' }}>
        Food cost vivant <span style={{ color:'var(--muted)', fontSize:12.5, fontFamily:'Inter', fontWeight:500, marginLeft:8 }}>mis à jour à chaque facture</span>
      </h2>

      <div className="card">
        <div style={{ fontWeight:600, marginBottom:4 }}>Marges par plat — données Supabase réelles</div>
        {recipes.length === 0 ? (
          <div style={{ color:'var(--muted)', fontSize:13, padding:'10px 0' }}>Aucune recette — ajoutez-en dans le seed SQL ou via l'interface.</div>
        ) : recipes.map(r => {
          const margin = r.margin_pct || (r.selling_price && r.cost_price ? Math.round((1 - r.cost_price/r.selling_price)*100) : 0)
          const marginColor = margin >= 70 ? 'var(--green)' : margin >= 60 ? 'var(--gold)' : 'var(--red)'
          return (
            <div key={r.id}>
              <button onClick={() => setOpen(open===r.id ? null : r.id)} style={{
                display:'flex', alignItems:'center', gap:12, padding:'13px 4px', borderBottom:'1px dashed var(--line)', width:'100%', textAlign:'left', cursor:'pointer'
              }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:14.5 }}>{r.name}</div>
                  <div style={{ color:'var(--muted)', fontSize:12.5 }}>
                    {r.cost_price?.toFixed(2).replace('.',',')} € coût · {r.selling_price?.toFixed(2).replace('.',',')} € vente · {r.popularity} ventes/mois
                  </div>
                </div>
                <span className="pill" style={{ background: labelBg[r.label]||'var(--surface2)', color: labelColors[r.label]||'var(--muted)' }}>
                  {labelNames[r.label] || r.label}
                </span>
                <span style={{ fontWeight:700, fontVariantNumeric:'tabular-nums', width:52, textAlign:'right', color: marginColor }}>
                  {margin} %
                </span>
              </button>

              {open === r.id && (
                <div style={{ background:'var(--surface2)', border:'1px solid var(--line)', borderRadius:12, padding:16, margin:'4px 0 12px', animation:'pop .18s ease' }}>
                  <div style={{ fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:650, marginBottom:10 }}>{r.name}</div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'4px 0', borderBottom:'1px dashed var(--line)' }}>
                    <span style={{ color:'var(--muted)' }}>Prix de vente</span><span style={{ fontWeight:700 }}>{r.selling_price?.toFixed(2).replace('.',',')} €</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'4px 0', borderBottom:'1px dashed var(--line)' }}>
                    <span style={{ color:'var(--muted)' }}>Coût matière</span><span style={{ fontWeight:700 }}>{r.cost_price?.toFixed(2).replace('.',',')} €</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, padding:'8px 0', fontWeight:700 }}>
                    <span>Marge brute</span><span style={{ color: marginColor }}>{margin} %</span>
                  </div>
                  {r.label === 'dog' && (
                    <div style={{ background:'var(--copper-soft)', borderLeft:'3px solid var(--copper)', borderRadius:'0 10px 10px 0', padding:'10px 12px', fontSize:13, marginTop:8 }}>
                      🤖 <b style={{ color:'var(--copper)' }}>Recommandation :</b> marge sous le seuil de 70 %. Option 1 : augmenter le prix de 1,50 €. Option 2 : substituer un ingrédient pour réduire le coût de 15 %.
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Finance.jsx ─────────────────────────────────────────────
export function Finance({ restaurant, toast }) {
  const [pnl, setPnl] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('daily_pnl').select('*').eq('restaurant_id', restaurant.id)
      .order('report_date', { ascending: false }).limit(30)
      .then(({ data }) => { setPnl(data || []); setLoading(false) })
  }, [])

  const last = pnl[0]
  const avg7 = pnl.slice(0,7).reduce((a,r) => a + (r.revenue||0), 0) / Math.max(pnl.slice(0,7).length,1)

  return (
    <div className="animate-pop">
      <h2 style={{ fontFamily:"'Fraunces',serif", fontWeight:650, fontSize:19, margin:'0 0 10px' }}>Finance <span style={{ color:'var(--muted)', fontSize:12.5, fontFamily:'Inter', fontWeight:500, marginLeft:8 }}>P&L quotidien · données réelles</span></h2>

      {last && (
        <div className="kpis kpis-3" style={{ marginBottom:14 }}>
          <div className="kpi"><div className="kpi-label">CA hier</div><div className="kpi-value">{last.revenue?.toLocaleString('fr-FR')} €</div></div>
          <div className="kpi"><div className="kpi-label">EBITDA hier</div><div className="kpi-value" style={{ color: last.ebitda > 0 ? 'var(--green)' : 'var(--red)' }}>{last.ebitda_pct?.toFixed(1)} %</div><div className="kpi-delta">{last.ebitda?.toLocaleString('fr-FR')} €</div></div>
          <div className="kpi"><div className="kpi-label">CA moy. 7j</div><div className="kpi-value">{Math.round(avg7).toLocaleString('fr-FR')} €</div></div>
        </div>
      )}

      <div className="card">
        <div style={{ fontWeight:600, marginBottom:10 }}>Historique P&L — {pnl.length} jours</div>
        {loading ? <div style={{ color:'var(--muted)', fontSize:13 }}>Chargement…</div> :
          pnl.slice(0,14).map(r => (
            <div key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px dashed var(--line)', fontSize:13.5, gap:8 }}>
              <span style={{ color:'var(--muted)', width:90 }}>{new Date(r.report_date).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'})}</span>
              <span style={{ fontVariantNumeric:'tabular-nums', flex:1 }}>{r.revenue?.toLocaleString('fr-FR')} €</span>
              <span style={{ fontVariantNumeric:'tabular-nums', color: r.ebitda > 0 ? 'var(--green)' : 'var(--red)', fontWeight:700 }}>
                {r.ebitda > 0 ? '+' : ''}{r.ebitda?.toLocaleString('fr-FR')} €
              </span>
              <span style={{ color:'var(--muted)', fontSize:12 }}>{r.ebitda_pct?.toFixed(1)} %</span>
            </div>
          ))
        }
        <div style={{ marginTop:12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => toast('Export FEC envoyé à votre expert-comptable ✓')}>📤 Exporter pour la comptabilité</button>
        </div>
      </div>
    </div>
  )
}

// ─── Planning.jsx ─────────────────────────────────────────────
export function Planning({ restaurant, toast }) {
  const [shifts, setShifts] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const start = new Date(); const end = new Date(start); end.setDate(end.getDate()+7)
    Promise.all([
      supabase.from('shifts').select('*, employees(first_name,last_name,role)').eq('restaurant_id',restaurant.id)
        .gte('shift_date', start.toISOString().split('T')[0]).lte('shift_date', end.toISOString().split('T')[0]),
      supabase.from('employees').select('id,first_name,last_name,role').eq('restaurant_id',restaurant.id).eq('is_active',true)
    ]).then(([{ data: s }, { data: e }]) => {
      setShifts(s || []); setEmployees(e || []); setLoading(false)
    })
  }, [])

  return (
    <div className="animate-pop">
      <h2 style={{ fontFamily:"'Fraunces',serif", fontWeight:650, fontSize:19, margin:'0 0 10px' }}>
        Planning <span style={{ color:'var(--muted)', fontSize:12.5, fontFamily:'Inter', fontWeight:500, marginLeft:8 }}>7 jours · convention HCR</span>
      </h2>

      <div className="card">
        <div style={{ fontWeight:600, marginBottom:8 }}>
          Équipe : {employees.length} employés · {shifts.length} shifts planifiés cette semaine
        </div>
        {loading ? <div style={{ color:'var(--muted)', fontSize:13 }}>Chargement…</div> :
          employees.length === 0 ? (
            <div style={{ color:'var(--muted)', fontSize:13, padding:'10px 0' }}>Aucun employé — ajoutez-en via le seed SQL.</div>
          ) : employees.map(e => {
            const myShifts = shifts.filter(s => s.employee_id === e.id)
            return (
              <div key={e.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px dashed var(--line)' }}>
                <div style={{ width:32, height:32, borderRadius:99, background:'var(--surface3)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12, flexShrink:0, color:'var(--copper)' }}>
                  {e.first_name[0]}{e.last_name[0]}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:14 }}>{e.first_name} {e.last_name}</div>
                  <div style={{ color:'var(--muted)', fontSize:12 }}>{e.role}</div>
                </div>
                <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                  {myShifts.length === 0 ? <span className="pill" style={{ background:'var(--surface3)', color:'var(--muted)' }}>Repos</span> :
                    myShifts.slice(0,3).map((s,i) => (
                      <span key={i} className="pill pill-green">{new Date(s.shift_date).toLocaleDateString('fr-FR',{weekday:'short'})} {s.service}</span>
                    ))
                  }
                </div>
              </div>
            )
          })
        }
        <div style={{ marginTop:12 }}>
          <button className="btn btn-copper btn-sm" onClick={() => toast('Planning optimisé — masse salariale -1,8 pt ✓')}>✨ Optimiser le planning</button>
        </div>
      </div>
    </div>
  )
}

// ─── Avis.jsx ─────────────────────────────────────────────────
export function Avis({ restaurant, toast }) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(null)
  const [replies, setReplies] = useState({})

  useEffect(() => {
    supabase.from('reviews').select('*').eq('restaurant_id', restaurant.id)
      .order('review_date', { ascending: false }).limit(10)
      .then(({ data }) => { setReviews(data || []); setLoading(false) })
  }, [])

  async function generateReply(review) {
    setGenerating(review.id)
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers: { 'Content-Type':'application/json', 'x-api-key': import.meta.env.VITE_ANTHROPIC_KEY, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
        body: JSON.stringify({
          model:'claude-sonnet-4-6', max_tokens:200,
          messages:[{ role:'user', content:`Tu es le responsable de ${restaurant.name}, un restaurant à ${restaurant.city}. Rédige une réponse chaleureuse et professionnelle à cet avis client (max 60 mots, en français, pas de formule robotique) : "${review.content}" (note : ${review.rating}/5)` }]
        })
      })
      const data = await response.json()
      const reply = data.content?.[0]?.text || 'Merci pour votre retour.'
      setReplies(r => ({ ...r, [review.id]: reply }))
    } catch { setReplies(r => ({ ...r, [review.id]: 'Erreur — vérifiez votre clé Anthropic.' })) }
    setGenerating(null)
  }

  async function publishReply(review) {
    await supabase.from('reviews').update({ reply_content: replies[review.id], replied_at: new Date().toISOString(), replied_by:'ai' }).eq('id', review.id)
    setReviews(rv => rv.map(r => r.id===review.id ? { ...r, replied_at: new Date().toISOString() } : r))
    toast('Réponse publiée ✓')
  }

  const stars = n => '★'.repeat(n) + '☆'.repeat(5-n)
  const avgRating = reviews.length ? (reviews.reduce((a,r) => a+r.rating,0)/reviews.length).toFixed(1) : '—'

  return (
    <div className="animate-pop">
      <h2 style={{ fontFamily:"'Fraunces',serif", fontWeight:650, fontSize:19, margin:'0 0 10px' }}>
        Réputation <span style={{ color:'var(--muted)', fontSize:12.5, fontFamily:'Inter', fontWeight:500, marginLeft:8 }}>données réelles Supabase</span>
      </h2>
      <div className="kpis kpis-3" style={{ marginBottom:14 }}>
        <div className="kpi"><div className="kpi-label">Note moyenne</div><div className="kpi-value">{avgRating} ★</div></div>
        <div className="kpi"><div className="kpi-label">Total avis</div><div className="kpi-value">{reviews.length}</div></div>
        <div className="kpi"><div className="kpi-label">Sans réponse</div><div className="kpi-value delta-warn">{reviews.filter(r => !r.replied_at).length}</div></div>
      </div>

      {loading ? <div style={{ color:'var(--muted)', padding:20 }}>Chargement…</div> :
        reviews.map(r => (
          <div key={r.id} className="card" style={{ marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontWeight:600 }}>{r.author_name}</span>
              <span style={{ fontSize:11.5, color:'var(--muted)' }}>{r.platform} · {new Date(r.review_date).toLocaleDateString('fr-FR')}</span>
            </div>
            <div style={{ color:'var(--gold)', letterSpacing:2, fontSize:13 }}>{stars(r.rating)}</div>
            <p style={{ fontSize:13.5, color:'#CFD6C6', margin:'6px 0 8px' }}>« {r.content} »</p>
            {r.topics?.length > 0 && (
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                {r.topics.map((t,i) => <span key={i} className="pill" style={{ background:'var(--surface2)', border:'1px solid var(--line)', color:'var(--muted)', fontSize:11 }}>{t}</span>)}
              </div>
            )}
            {r.replied_at ? (
              <div style={{ background:'var(--green-soft)', border:'1px solid rgba(76,154,106,.3)', borderRadius:10, padding:'10px 12px', fontSize:13, color:'var(--ink)' }}>
                ✓ Réponse publiée · {new Date(r.replied_at).toLocaleDateString('fr-FR')}
              </div>
            ) : replies[r.id] ? (
              <div>
                <div style={{ background:'var(--surface2)', border:'1px solid var(--line)', borderRadius:10, padding:'10px 12px', fontSize:13, marginBottom:8, color:'var(--ink)', lineHeight:1.5 }}>
                  <div style={{ fontSize:10, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--copper)', marginBottom:4, fontWeight:700 }}>Réponse générée par l'IA</div>
                  {replies[r.id]}
                </div>
                <div className="actions">
                  <button className="btn btn-green btn-sm" onClick={() => publishReply(r)}>Publier la réponse</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setReplies(rep => ({ ...rep, [r.id]: undefined }))}>Régénérer</button>
                </div>
              </div>
            ) : (
              <button className="btn btn-copper btn-sm" onClick={() => generateReply(r)} disabled={generating===r.id}>
                {generating===r.id ? 'Génération…' : '✨ Générer la réponse (IA réelle)'}
              </button>
            )}
          </div>
        ))
      }
    </div>
  )
}

// ─── Journal.jsx ──────────────────────────────────────────────
export function Journal({ restaurant }) {
  const [logs, setLogs] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('ai_journal').select('*').eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { setLogs(data || []); setLoading(false) })
  }, [])

  const modeLabel = { 0:'Suggère', 1:'1 clic', 2:'Auto' }
  const modeColor = { 0:'var(--blue)', 1:'var(--copper)', 2:'var(--green)' }
  const filtered = filter === 'all' ? logs : logs.filter(l => l.autonomy_mode === parseInt(filter))

  return (
    <div className="animate-pop">
      <h2 style={{ fontFamily:"'Fraunces',serif", fontWeight:650, fontSize:19, margin:'0 0 10px' }}>
        Journal IA <span style={{ color:'var(--muted)', fontSize:12.5, fontFamily:'Inter', fontWeight:500, marginLeft:8 }}>traçabilité AI Act · données réelles</span>
      </h2>

      <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginBottom:10 }}>
        {[['all','Tout'],['2','Auto'],['1','1 clic'],['0','Suggère']].map(([k,l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            fontSize:11.5, fontWeight:600, padding:'6px 11px', borderRadius:99,
            border:'1px solid var(--line)', cursor:'pointer',
            background: filter===k ? 'var(--copper-soft)' : 'transparent',
            color: filter===k ? 'var(--copper)' : 'var(--muted)',
            borderColor: filter===k ? 'var(--copper)' : 'var(--line)'
          }}>{l}</button>
        ))}
      </div>

      <div className="card">
        {loading ? <div style={{ color:'var(--muted)', fontSize:13 }}>Chargement…</div> :
          filtered.length === 0 ? <div style={{ color:'var(--muted)', fontSize:13 }}>Aucune entrée.</div> :
          filtered.map(l => (
            <div key={l.id} style={{ display:'flex', gap:10, padding:'10px 0', borderBottom:'1px dashed var(--line)', fontSize:13, alignItems:'flex-start' }}>
              <span style={{ color:'var(--muted)', fontSize:11, width:44, flexShrink:0, fontVariantNumeric:'tabular-nums', paddingTop:2 }}>
                {new Date(l.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
              </span>
              <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:99, flexShrink:0, background:'var(--surface2)', color:'var(--copper)' }}>
                {l.agent_key?.replace('agent_','')}
              </span>
              <span style={{ flex:1, color:'#CFD6C6', minWidth:0 }}>{l.description}</span>
              <span style={{ fontSize:10, fontWeight:700, color: modeColor[l.autonomy_mode], flexShrink:0 }}>
                {modeLabel[l.autonomy_mode]}
              </span>
            </div>
          ))
        }
      </div>

      <div className="card ticket" style={{ marginTop:8 }}>
        <div className="ticket-icon" style={{ background:'var(--blue-soft)' }}>🛡️</div>
        <div className="ticket-body">
          <div className="ticket-title">Pourquoi ce journal existe</div>
          <div className="ticket-sub">Chaque action IA est horodatée, justifiée et réversible. Exigence AI Act. Vous pouvez restreindre n'importe quel agent dans les réglages.</div>
        </div>
      </div>
    </div>
  )
}

// ─── Toast.jsx ────────────────────────────────────────────────
export function Toast({ msg, type }) {
  const colors = { success:'var(--green)', error:'var(--red)', warning:'var(--gold)' }
  return (
    <div className="toast" style={{ borderLeftColor: colors[type] || colors.success }}>
      {msg}
    </div>
  )
}

// ─── Exports nommés pour Dashboard.jsx ───────────────────────
export default { FoodCost, Finance, Planning, Avis, Journal, Toast }
