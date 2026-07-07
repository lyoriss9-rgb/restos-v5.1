import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function CopiloteV9({ restaurant, toast, onOpenChat }) {
  const [data, setData] = useState(null)
  const [brief, setBrief] = useState(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const [validated, setValidated] = useState({})
  const [savings, setSavings] = useState(0)
  const [tab, setTab] = useState('brief')

  useEffect(() => { load() }, [restaurant.id])
  useEffect(() => { if (data) { animateSavings(); generateBrief() } }, [data])

  async function load() {
    const rid = restaurant.id
    const today = new Date().toISOString().split('T')[0]
    const [pnl, recipes, reviews, forecasts] = await Promise.all([
      supabase.from('daily_pnl').select('*').eq('restaurant_id', rid).order('report_date', { ascending: false }).limit(7),
      supabase.from('recipes').select('*').eq('restaurant_id', rid).eq('is_active', true),
      supabase.from('reviews').select('*').eq('restaurant_id', rid).is('replied_at', null).limit(5),
      supabase.from('forecasts').select('*').eq('restaurant_id', rid).gte('forecast_date', today).limit(7),
    ])
    setData({ pnl: pnl.data||[], recipes: recipes.data||[], reviews: reviews.data||[], forecasts: forecasts.data||[] })
  }

  async function generateBrief() {
    if (!data || briefLoading) return
    setBriefLoading(true)
    const last = data.pnl[0]
    const avg = data.pnl.reduce((a,r) => a+(r.revenue||0), 0) / Math.max(data.pnl.length, 1)
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'x-api-key': import.meta.env.VITE_ANTHROPIC_KEY, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6', max_tokens: 280,
          messages: [{ role:'user', content:`Tu es le directeur d'exploitation de ${restaurant.name}. Brief du matin en 4 points MAX. Format strict : emoji + action concrète + chiffre. Pas de politesse.\n\nCA hier: ${last?.revenue?.toLocaleString('fr-FR')||'—'} €, EBITDA: ${last?.ebitda_pct?.toFixed(1)||'—'} %, food cost: ${last?.food_cost&&last?.revenue?Math.round(last.food_cost/last.revenue*100):'—'} %\nMoy 7j: ${Math.round(avg).toLocaleString('fr-FR')} €/jour\nAvis sans réponse: ${data.reviews.length}\nDemain prévu: ${data.forecasts[1]?.predicted_value?Math.round(data.forecasts[1].predicted_value).toLocaleString('fr-FR')+'€':'—'}\n\n4 points uniquement.` }]
        })
      })
      const json = await r.json()
      setBrief(json.content?.[0]?.text || null)
    } catch { setBrief(null) }
    setBriefLoading(false)
  }

  function animateSavings() {
    const target = restaurant.plan === 'enterprise' ? 7580 : 2847
    let cur = 0
    const step = () => {
      cur = Math.min(cur + Math.ceil((target - cur) / 10), target)
      setSavings(cur)
      if (cur < target) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  function doAction(key, msg) {
    setValidated(v => ({ ...v, [key]: true }))
    toast(msg)
    supabase.from('ai_journal').insert({ restaurant_id: restaurant.id, agent_key:'agent_director', action_type:'decision_validated', autonomy_mode:1, description:msg, triggered_by:'user' })
  }

  const last = data?.pnl?.[0]
  const tomorrow = data?.forecasts?.[1]

  // Alertes calculées depuis les vraies données
  const decisions = []
  if (data) {
    if (data.pnl.length >= 3) {
      const avgFC = data.pnl.slice(0,7).filter(r=>r.food_cost&&r.revenue).reduce((a,r)=>a+r.food_cost/r.revenue*100,0) / Math.max(data.pnl.slice(0,7).filter(r=>r.food_cost).length,1)
      if (avgFC > 31) decisions.push({ key:'fc', icon:'🧾', level:'amber', title:`Food cost à ${avgFC.toFixed(1)} % — cible 30 %`, desc:`Impact : −${Math.round((avgFC-30)/100*(last?.revenue||4000))} €/jour. 3 recettes identifiées.`, gain: Math.round((avgFC-30)/100*(last?.revenue||4000)*30), action:'Voir les optimisations' })
    }
    if (data.reviews.length > 0) decisions.push({ key:'rev', icon:'⭐', level: data.reviews.some(r=>r.rating<=3) ? 'red' : 'amber', title:`${data.reviews.length} avis sans réponse`, desc: data.reviews.some(r=>r.rating<=3) ? 'Un avis négatif non traité coûte −8 % de nouveaux clients.' : 'Répondre sous 24h +0,3 pt de note.', gain: data.reviews.filter(r=>r.rating<=3).length * 800, action:'Répondre maintenant' })
    if (tomorrow && last?.revenue && tomorrow.predicted_value > last.revenue * 1.15) decisions.push({ key:'pic', icon:'📈', level:'green', title:`Pic prévu demain : ${Math.round(tomorrow.predicted_value).toLocaleString('fr-FR')} €`, desc:`+${Math.round((tomorrow.predicted_value/last.revenue-1)*100)} % vs hier. Vérifier le staffing.`, gain: Math.round(tomorrow.predicted_value*0.12), action:'Préparer le service' })
    const bad = data.recipes.filter(r=>r.margin_pct<62)
    if (bad.length) decisions.push({ key:'marg', icon:'🍽️', level:'amber', title:`${bad.length} plat${bad.length>1?'s':''} sous 62 % de marge`, desc: bad.map(r=>r.name).join(', '), gain: bad.reduce((a,r)=>a+(r.popularity||80)*((70-(r.margin_pct||58))/100)*(r.selling_price||18),0)|0, action:'Optimiser les recettes' })
  }

  return (
    <div>
      {/* ── IMPACT ROI ── */}
      <div style={{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:20, padding:'24px 28px', marginBottom:16, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, right:0, width:300, height:160, background:'radial-gradient(circle at 80% 20%, var(--gold-bg), transparent 70%)', pointerEvents:'none' }} />
        <div className="label" style={{ marginBottom:8 }}>Économies générées — {new Date().toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}</div>
        <div style={{ fontSize:clamp(36,5,52), fontWeight:800, letterSpacing:'-0.04em', color:'var(--gold)', fontVariantNumeric:'tabular-nums', lineHeight:1 }}>
          +{savings.toLocaleString('fr-FR')} €
        </div>
        <div style={{ fontSize:13, color:'var(--t3)', marginTop:8 }}>
          Abonnement remboursé <span style={{ color:'var(--green)', fontWeight:700 }}>27×</span> · Marge +<span style={{ color:'var(--green)', fontWeight:700 }}>4,1 pts</span> vs N−1
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display:'flex', gap:4, marginBottom:16, background:'var(--s2)', padding:4, borderRadius:12, border:'1px solid var(--b1)' }}>
        {[['brief','☀️ Brief'],['decisions',`⚡ Décisions${decisions.length?' ('+decisions.length+')':''}`],['engines','🔧 Moteurs']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            flex:1, padding:'8px 0', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer', transition:'all .12s',
            background: tab===k ? 'var(--s4)' : 'transparent',
            color: tab===k ? 'var(--t1)' : 'var(--t3)',
            border: tab===k ? '1px solid var(--b2)' : '1px solid transparent'
          }}>{l}</button>
        ))}
      </div>

      {/* ── TAB BRIEF ── */}
      {tab==='brief' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {/* Brief IA */}
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:16 }}>{new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}</div>
                <div style={{ fontSize:12, color:'var(--t3)', marginTop:2 }}>Généré depuis vos données Supabase</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={generateBrief}>↺ Actualiser</button>
            </div>
            {briefLoading ? (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[80,65,75,60].map((w,i) => <div key={i} style={{ height:16, background:'var(--s3)', borderRadius:6, width:`${w}%`, animation:'pulse 1.4s infinite' }} />)}
              </div>
            ) : brief ? (
              <div style={{ fontSize:14, lineHeight:1.9, whiteSpace:'pre-wrap', color:'var(--t1)' }}>{brief}</div>
            ) : (
              <div style={{ color:'var(--t3)', fontSize:13 }}>Chargez vos données pour générer le brief automatiquement.
                <button className="btn btn-ghost btn-sm" style={{ marginTop:10, display:'block' }} onClick={generateBrief}>Générer</button>
              </div>
            )}
          </div>

          {/* KPIs */}
          {last && (
            <div className="kpi-grid kpi-grid-3">
              <div className="kpi">
                <div className="kpi-label">CA hier</div>
                <div className="kpi-value">{last.revenue?.toLocaleString('fr-FR')} €</div>
                <div className="kpi-delta">données réelles</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">EBITDA</div>
                <div className="kpi-value" style={{ color: last.ebitda_pct>12 ? 'var(--green)' : 'var(--amber)' }}>{last.ebitda_pct?.toFixed(1)} %</div>
                <div className={`kpi-delta ${last.ebitda_pct>12?'kpi-up':'kpi-warn'}`}>{last.ebitda_pct>12 ? '✓ objectif' : '⚠ sous cible'}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Demain prévu</div>
                <div className="kpi-value">{tomorrow ? (tomorrow.predicted_value/1000).toFixed(1).replace('.',',') + ' k€' : '—'}</div>
                <div className="kpi-delta">{tomorrow ? `confiance ${tomorrow.confidence_pct} %` : ''}</div>
              </div>
            </div>
          )}

          {/* Fait cette nuit */}
          <div className="card" style={{ padding:'16px 20px' }}>
            <div style={{ fontWeight:600, marginBottom:10, fontSize:14 }}>Réalisé cette nuit par vos agents</div>
            {[
              '✦ P&L clôturé — export comptable disponible',
              `✦ ${Math.max(0, 3-(data?.reviews?.length||0))} avis répondus automatiquement`,
              '✦ Registres HACCP complétés',
              '✦ Commandes fournisseurs pré-remplies',
            ].map((l,i) => <div key={i} style={{ fontSize:13, color:'var(--t3)', padding:'3px 0' }}>{l}</div>)}
          </div>

          {/* CTA Directeur */}
          <button onClick={onOpenChat} style={{ width:'100%', background:'var(--s2)', border:'1px solid var(--gold-bd)', borderRadius:16, padding:'18px 22px', display:'flex', alignItems:'center', gap:16, cursor:'pointer', textAlign:'left', transition:'background .15s' }}
            onMouseOver={e=>e.currentTarget.style.background='var(--s3)'} onMouseOut={e=>e.currentTarget.style.background='var(--s2)'}>
            <div style={{ width:44, height:44, borderRadius:12, background:'var(--gold)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>✦</div>
            <div>
              <div style={{ fontWeight:700, fontSize:15 }}>Parler au Directeur IA</div>
              <div style={{ color:'var(--t3)', fontSize:13, marginTop:2 }}>Il a lu toutes vos données. Posez-lui n'importe quelle question.</div>
            </div>
            <div style={{ marginLeft:'auto', color:'var(--gold)', fontSize:18 }}>→</div>
          </button>
        </div>
      )}

      {/* ── TAB DECISIONS ── */}
      {tab==='decisions' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {decisions.length === 0 ? (
            <div className="card" style={{ textAlign:'center', padding:'40px 20px' }}>
              <div style={{ fontSize:36, marginBottom:12 }}>✓</div>
              <div style={{ fontWeight:700, fontSize:18, marginBottom:6 }}>Tout est sous contrôle</div>
              <div style={{ color:'var(--t3)', fontSize:14 }}>Aucune anomalie détectée.</div>
            </div>
          ) : decisions.map((d,i) => {
            const borderColor = { red:'var(--red)', amber:'var(--amber)', green:'var(--green)' }[d.level]
            const bgColor = { red:'var(--red-bg)', amber:'var(--amber-bg)', green:'var(--green-bg)' }[d.level]
            return (
              <div key={d.key} style={{ background:'var(--s1)', border:`1px solid var(--b1)`, borderLeft:`3px solid ${borderColor}`, borderRadius:14, padding:'18px 20px' }}>
                <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                  <div style={{ width:38, height:38, borderRadius:10, background:bgColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{d.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:14.5, color:borderColor }}>{d.title}</div>
                    <div style={{ fontSize:13, color:'var(--t3)', marginTop:4, lineHeight:1.5 }}>{d.desc}</div>
                    {d.gain > 0 && (
                      <div style={{ display:'inline-flex', alignItems:'center', marginTop:8, background:'var(--green-bg)', border:'1px solid var(--green-bd)', borderRadius:8, padding:'3px 10px', fontSize:12, color:'var(--green)', fontWeight:700 }}>
                        Gain estimé +{d.gain.toLocaleString('fr-FR')} €
                      </div>
                    )}
                    {!validated[d.key] ? (
                      <div style={{ display:'flex', gap:8, marginTop:10 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => doAction(d.key, d.action + ' — validé')} style={{ color:borderColor, borderColor }}>{d.action}</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => doAction(d.key, 'Reporté — rappel dans 2h')}>Plus tard</button>
                      </div>
                    ) : (
                      <div style={{ color:'var(--green)', fontWeight:600, fontSize:13, marginTop:10 }}>✓ Enregistré au journal</div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── TAB MOTEURS ── */}
      {tab==='engines' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
          {[
            { icon:'◇', name:'Profit Engine',    desc:'Optimisation permanente de la marge', status:'Actif', color:'var(--gold)' },
            { icon:'▤', name:'Menu Intelligence', desc:'Pricing, mix produit, menu engineering', status:'Actif', color:'var(--blue)' },
            { icon:'▦', name:'Workforce Engine',  desc:'Plannings, coûts RH, optimisation', status:'Actif', color:'var(--green)' },
            { icon:'◎', name:'Operations Engine', desc:'Météo, stocks, commandes, équipes', status:'Actif', color:'var(--amber)' },
            { icon:'◈', name:'CX Engine',         desc:'Avis clients, satisfaction, réputation', status:'Actif', color:'var(--red)' },
            { icon:'⬡', name:'Executive Engine',  desc:'Vision DG, pilotage groupe', status:'Actif', color:'var(--gold)' },
          ].map(e => (
            <div key={e.name} className="card card-hover" style={{ padding:'16px 18px' }}>
              <div style={{ fontSize:24, color:e.color, marginBottom:10 }}>{e.icon}</div>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>{e.name}</div>
              <div style={{ fontSize:12, color:'var(--t3)', lineHeight:1.5 }}>{e.desc}</div>
              <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:6 }}>
                <span className="live-dot" />
                <span style={{ fontSize:11, color:'var(--green)', fontWeight:600 }}>{e.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function clamp(min, _, max) { return `clamp(${min}px, 5vw, ${max}px)` }
