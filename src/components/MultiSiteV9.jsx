import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function MultiSiteV9({ userId, toast, sites=[] }) {
  const [kpis, setKpis] = useState({})
  const [brief, setBrief] = useState(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const [tab, setTab] = useState('groupe')
  const [validated, setValidated] = useState({})

  useEffect(() => { if(sites.length) { loadKpis(); generateBrief() } }, [sites])

  async function loadKpis() {
    const result = {}
    for(const s of sites) {
      const { data } = await supabase.from('daily_pnl').select('revenue,ebitda,ebitda_pct,food_cost,labor_cost').eq('restaurant_id',s.id).order('report_date',{ascending:false}).limit(7)
      if(data?.length) {
        const avg = (k) => data.reduce((a,r)=>a+(r[k]||0),0)/data.length
        result[s.id] = { revenue:data[0].revenue, ebitda_pct:data[0].ebitda_pct, food_cost_pct:data[0].food_cost&&data[0].revenue?data[0].food_cost/data[0].revenue*100:0, avg_rev:avg('revenue'), avg_eb:avg('ebitda_pct') }
      }
    }
    setKpis(result)
  }

  async function generateBrief() {
    setBriefLoading(true)
    const summary = sites.map(s=>{const k=kpis[s.id]||{};return `${s.name}: CA ${k.revenue?.toLocaleString('fr-FR')||'—'}€, EBITDA ${k.ebitda_pct?.toFixed(1)||'—'}%, food cost ${k.food_cost_pct?.toFixed(1)||'—'}%`}).join('\n')
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':import.meta.env.VITE_ANTHROPIC_KEY,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:300, messages:[{role:'user',content:`Tu es DG du groupe "Les Portes du Mont Saint Michel". Brief direction en 4 points max. Direct, chiffré, orienté décision.\n\n${summary}\n\n4 points uniquement.`}] })
      })
      const json = await r.json()
      setBrief(json.content?.[0]?.text||null)
    } catch { setBrief(null) }
    setBriefLoading(false)
  }

  function doAction(key, msg) { setValidated(v=>({...v,[key]:true})); toast(msg) }

  const allKpis = Object.values(kpis)
  const totalRev = allKpis.reduce((a,k)=>a+(k.revenue||0),0)
  const avgEb = allKpis.length ? allKpis.reduce((a,k)=>a+(k.ebitda_pct||0),0)/allKpis.length : 0
  const avgFC = allKpis.length ? allKpis.reduce((a,k)=>a+(k.food_cost_pct||0),0)/allKpis.length : 0
  const best = sites.length ? sites.reduce((b,s)=>(kpis[s.id]?.ebitda_pct||0)>(kpis[b?.id]?.ebitda_pct||0)?s:b, sites[0]) : null
  const worst = sites.length ? sites.reduce((b,s)=>(kpis[s.id]?.ebitda_pct||0)<(kpis[b?.id]?.ebitda_pct||0)?s:b, sites[0]) : null
  const groupImpact = Math.round(totalRev*0.041)

  const DECISIONS = [
    { key:'menu', title:'Standardiser les entrées du groupe', desc:'Harmoniser 3 entrées phares sur les 3 sites. Réduction coût achat −6 %. Cohérence de l\'offre.', impacts:[420,380,520], reco:true },
    { key:'staff', title:'Réallocation staff inter-sites vendredi', desc:'Site B surstaffé +1,2 ETP. Site C sous tension. Déplacement d\'un extra proposé.', impacts:[-180,-320,640], reco:true },
    { key:'achat', title:'Groupement d\'achat poisson — Criée', desc:'Volume combiné 85 kg/sem → tarif −12 % négocié. Économie immédiate.', impacts:[310,240,430], reco:true },
  ]

  return (
    <div>
      {/* Impact groupe */}
      <div style={{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:20, padding:'22px 26px', marginBottom:16, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, right:0, width:280, height:140, background:'radial-gradient(circle at 80% 20%, var(--gold-bg), transparent 65%)', pointerEvents:'none' }} />
        <div className="label" style={{ marginBottom:8 }}>Impact RestOS — groupe aujourd'hui</div>
        <div style={{ fontSize:42, fontWeight:800, letterSpacing:'-0.04em', color:'var(--gold)', fontVariantNumeric:'tabular-nums', lineHeight:1 }}>
          +{groupImpact.toLocaleString('fr-FR')} €
        </div>
        <div style={{ display:'flex', gap:20, marginTop:10, flexWrap:'wrap' }}>
          {sites.map(s=>{ const k=kpis[s.id]||{}; return <div key={s.id} style={{ fontSize:12, color:'var(--t3)' }}><b style={{ color:'var(--t2)' }}>{s.name}</b> +{Math.round((k.revenue||0)*0.041).toLocaleString('fr-FR')} €</div> })}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:16, background:'var(--s2)', padding:4, borderRadius:12, border:'1px solid var(--b1)' }}>
        {[['groupe','Groupe'],['direction','Direction'],['sites','Par site']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{ flex:1, padding:'8px 0', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer', transition:'all .12s', background:tab===k?'var(--s4)':'transparent', color:tab===k?'var(--t1)':'var(--t3)', border:tab===k?'1px solid var(--b2)':'1px solid transparent' }}>{l}</button>
        ))}
      </div>

      {/* ── TAB GROUPE ── */}
      {tab==='groupe' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {/* KPIs consolidés */}
          <div className="kpi-grid kpi-grid-4">
            <div className="kpi"><div className="kpi-label">CA total</div><div className="kpi-value" style={{ fontSize:20 }}>{totalRev.toLocaleString('fr-FR')} €</div></div>
            <div className="kpi"><div className="kpi-label">EBITDA moy.</div><div className="kpi-value" style={{ fontSize:20, color:avgEb>13?'var(--green)':'var(--amber)' }}>{avgEb.toFixed(1)} %</div></div>
            <div className="kpi"><div className="kpi-label">Food cost moy.</div><div className="kpi-value" style={{ fontSize:20, color:avgFC>31?'var(--amber)':'var(--green)' }}>{avgFC.toFixed(1)} %</div></div>
            <div className="kpi"><div className="kpi-label">Meilleur site</div><div className="kpi-value" style={{ fontSize:16, color:'var(--green)' }}>{best?.name||'—'}</div></div>
          </div>

          {/* Comparaison sites */}
          <div className="card">
            <div style={{ fontWeight:700, fontSize:15, marginBottom:14 }}>Comparaison des sites</div>
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${sites.length},1fr)`, gap:10 }}>
              {sites.map(s=>{
                const k=kpis[s.id]||{}
                const isBest=best?.id===s.id, isWorst=worst?.id===s.id&&worst?.id!==best?.id
                return (
                  <div key={s.id} style={{ background: isBest?'var(--green-bg)':isWorst?'var(--red-bg)':'var(--s2)', border:`1px solid ${isBest?'var(--green-bd)':isWorst?'var(--red-bd)':'var(--b1)'}`, borderRadius:12, padding:'14px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                      <div style={{ fontWeight:700, fontSize:13 }}>{s.name}</div>
                      {isBest&&<span className="badge badge-green" style={{ fontSize:9 }}>TOP</span>}
                      {isWorst&&<span className="badge badge-red" style={{ fontSize:9 }}>⚠</span>}
                    </div>
                    {[['CA',`${k.revenue?.toLocaleString('fr-FR')||'—'} €`],['EBITDA',`${k.ebitda_pct?.toFixed(1)||'—'} %`],['Food cost',`${k.food_cost_pct?.toFixed(1)||'—'} %`]].map(([l,v])=>(
                      <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'3px 0', borderBottom:'1px solid var(--b1)' }}>
                        <span style={{ color:'var(--t3)' }}>{l}</span><span style={{ fontWeight:600 }}>{v}</span>
                      </div>
                    ))}
                    {best&&worst&&<div style={{ marginTop:8, fontSize:11, color:isBest?'var(--green)':isWorst?'var(--red)':'var(--t3)', fontWeight:600 }}>
                      {isBest?`+${((k.ebitda_pct||0)-avgEb).toFixed(1)} pts vs moy.`:isWorst?`${((k.ebitda_pct||0)-avgEb).toFixed(1)} pts vs moy.`:``}
                    </div>}
                  </div>
                )
              })}
            </div>
            {best&&worst&&best.id!==worst.id&&(
              <div style={{ marginTop:12, background:'var(--gold-bg)', border:'1px solid var(--gold-bd)', borderRadius:10, padding:'12px 14px', fontSize:13 }}>
                <b style={{ color:'var(--gold)' }}>Intelligence croisée —</b> {best.name} surperforme de {((kpis[best.id]?.ebitda_pct||0)-(kpis[worst.id]?.ebitda_pct||0)).toFixed(1)} pts d'EBITDA vs {worst.name}. Auditer et répliquer ses process.
              </div>
            )}
          </div>

          {/* Décisions groupe */}
          <div className="card">
            <div style={{ fontWeight:700, fontSize:15, marginBottom:14 }}>⚡ Décisions groupe</div>
            {DECISIONS.map((d,i)=>{
              const status=validated[d.key]
              return (
                <div key={d.key} style={{ padding:'14px 0', borderBottom:i<DECISIONS.length-1?'1px solid var(--b1)':'none' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, gap:10 }}>
                    <div style={{ fontWeight:700, fontSize:14 }}>{d.title}</div>
                    <span className="badge badge-gold" style={{ flexShrink:0, fontSize:9 }}>GROUPE</span>
                  </div>
                  <div style={{ fontSize:13, color:'var(--t3)', marginBottom:10 }}>{d.desc}</div>
                  <div style={{ display:'grid', gridTemplateColumns:`repeat(${sites.length},1fr)`, gap:8, marginBottom:10 }}>
                    {sites.slice(0,3).map((s,j)=>(
                      <div key={s.id} style={{ background:'var(--s2)', borderRadius:8, padding:'8px 10px' }}>
                        <div style={{ fontSize:10, color:'var(--t3)', marginBottom:2 }}>{s.name}</div>
                        <div style={{ fontSize:13, fontWeight:700, color:(d.impacts[j]||0)>=0?'var(--green)':'var(--red)' }}>{(d.impacts[j]||0)>=0?'+':''}{d.impacts[j]||0} €</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                    <div style={{ fontSize:12, color:'var(--t3)' }}>IA recommande : <b style={{ color:d.reco?'var(--green)':'var(--red)' }}>{d.reco?'✓ VALIDER':'✗ REFUSER'}</b></div>
                    {!status ? (
                      <div style={{ display:'flex', gap:8 }}>
                        <button className="btn btn-success btn-sm" onClick={()=>doAction(d.key,`${d.title} — validé groupe`)}>✓ Valider groupe</button>
                        <button className="btn btn-ghost btn-sm">Modifier</button>
                        <button className="btn btn-danger btn-sm" onClick={()=>doAction(d.key,`${d.title} — refusé`)}>✗</button>
                      </div>
                    ) : <span style={{ color:'var(--green)', fontWeight:600, fontSize:13 }}>✓ Validé</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── TAB DIRECTION ── */}
      {tab==='direction' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <div style={{ fontWeight:700, fontSize:16 }}>Briefing Direction — {new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}</div>
              <button className="btn btn-ghost btn-sm" onClick={generateBrief}>↺</button>
            </div>
            {briefLoading ? (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[70,55,80,60].map((w,i)=><div key={i} style={{ height:16, background:'var(--s3)', borderRadius:6, width:`${w}%` }} />)}
              </div>
            ) : brief ? (
              <div style={{ fontSize:14, lineHeight:1.9, whiteSpace:'pre-wrap', color:'var(--t1)' }}>{brief}</div>
            ) : <button className="btn btn-ghost btn-sm" onClick={generateBrief}>Générer le briefing</button>}
          </div>

          <div className="card">
            <div style={{ fontWeight:700, marginBottom:14 }}>KPIs Direction</div>
            {[
              { label:'CA total groupe', value:`${totalRev.toLocaleString('fr-FR')} €`, ok:totalRev>15000, ref:'Obj. semaine 160 k€' },
              { label:'EBITDA moyen', value:`${avgEb.toFixed(1)} %`, ok:avgEb>=14, ref:'Cible ≥ 14 %' },
              { label:'Food cost moyen', value:`${avgFC.toFixed(1)} %`, ok:avgFC<=30, ref:'Cible ≤ 30 %' },
              { label:'Impact RestOS/j', value:`+${groupImpact.toLocaleString('fr-FR')} €`, ok:true, ref:'ROI annualisé ~135 k€' },
            ].map(k=>(
              <div key={k.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom:'1px solid var(--b1)' }}>
                <div><div style={{ fontWeight:600, fontSize:14 }}>{k.label}</div><div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{k.ref}</div></div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontWeight:700, fontSize:17, color:k.ok?'var(--green)':'var(--red)', fontVariantNumeric:'tabular-nums' }}>{k.value}</div>
                  <div style={{ fontSize:10, color:k.ok?'var(--green)':'var(--red)', marginTop:2 }}>{k.ok?'✓ Dans les normes':'⚠ Hors cible'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB PAR SITE ── */}
      {tab==='sites' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {sites.map(s=>{
            const k=kpis[s.id]||{}
            const isBest=best?.id===s.id
            return (
              <div key={s.id} className="card">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                  <div style={{ fontWeight:700, fontSize:16 }}>{s.name}</div>
                  {isBest&&<span className="badge badge-green">🏆 Meilleur site</span>}
                </div>
                <div className="kpi-grid" style={{ gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                  {[['CA hier',`${k.revenue?.toLocaleString('fr-FR')||'—'} €`],['EBITDA',`${k.ebitda_pct?.toFixed(1)||'—'} %`],['Food cost',`${k.food_cost_pct?.toFixed(1)||'—'} %`]].map(([l,v])=>(
                    <div key={l} style={{ background:'var(--s2)', borderRadius:10, padding:'10px 12px' }}>
                      <div style={{ fontSize:10, color:'var(--t3)', marginBottom:4 }}>{l}</div>
                      <div style={{ fontWeight:700, fontSize:16 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
