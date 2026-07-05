import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ═══════════════════════════════════════════════════════
// MULTISITE V2 — Pilotage groupe Les Portes du MSM
// Tu ne raisonnes plus restaurant par restaurant.
// Tu raisonnes : GROUPE + ÉCARTS + OPTIMISATION CROISÉE
// ═══════════════════════════════════════════════════════

const SITES_DEMO = [
  { id: 'site_a', name: 'La Salicorne',  city: 'Mont Saint-Michel', seats: 60,  color: '#4C9A6A', colorSoft: 'rgba(76,154,106,.15)' },
  { id: 'site_b', name: 'Le Pré Salé',   city: 'Mont Saint-Michel', seats: 45,  color: '#D08B3C', colorSoft: 'rgba(208,139,60,.14)' },
  { id: 'site_c', name: "L'Hippocampe",  city: 'Mont Saint-Michel', seats: 80,  color: '#5B8FBF', colorSoft: 'rgba(91,143,191,.14)' },
]

// KPIs démo réalistes pour chaque site
const DEMO_KPI = {
  site_a: { revenue: 8420,  ebitda_pct: 18.2, food_cost_pct: 27.4, labor_pct: 29.1, covers: 198, avg_ticket: 42.5, rating: 4.6, reviews_pending: 1 },
  site_b: { revenue: 6180,  ebitda_pct: 12.1, food_cost_pct: 33.8, labor_pct: 32.4, covers: 142, avg_ticket: 43.5, rating: 4.2, reviews_pending: 3 },
  site_c: { revenue: 11240, ebitda_pct: 15.8, food_cost_pct: 29.6, labor_pct: 30.8, covers: 264, avg_ticket: 42.6, rating: 4.5, reviews_pending: 0 },
}

export default function MultiSiteV2({ userId, toast }) {
  const [sites, setSites]               = useState([])
  const [kpis, setKpis]                 = useState({})
  const [loading, setLoading]           = useState(true)
  const [mode, setMode]                 = useState('group')   // group | direction | site
  const [activeSite, setActiveSite]     = useState(null)
  const [decisions, setDecisions]       = useState(initDecisions())
  const [briefLoading, setBriefLoading] = useState(false)
  const [brief, setBrief]               = useState(null)
  const [validated, setValidated]       = useState({})

  useEffect(() => { loadSites() }, [])
  useEffect(() => { if (sites.length > 0) { loadKpis(); generateBrief() } }, [sites])

  // ─── Chargement des sites réels + fallback démo ────────
  async function loadSites() {
    const { data } = await supabase
      .from('restaurant_members')
      .select('role, restaurants(*)')
      .eq('user_id', userId)
      .eq('is_active', true)
    const real = (data || []).map(d => ({ ...d.restaurants, role: d.role, _real: true }))
    // Compléter avec les sites démo si < 3
    const all = real.length >= 3 ? real.slice(0, 3) : [
      ...real,
      ...SITES_DEMO.slice(real.length).map(s => ({ ...s, _demo: true }))
    ]
    setSites(all)
    setLoading(false)
  }

  async function loadKpis() {
    const result = {}
    for (const site of sites) {
      if (site._demo) {
        result[site.id] = DEMO_KPI[site.id] || DEMO_KPI.site_a
      } else {
        const { data: pnl } = await supabase.from('daily_pnl').select('*')
          .eq('restaurant_id', site.id).order('report_date', { ascending: false }).limit(1).single()
        if (pnl) {
          result[site.id] = {
            revenue: pnl.revenue,
            ebitda_pct: pnl.ebitda_pct,
            food_cost_pct: pnl.food_cost && pnl.revenue ? pnl.food_cost / pnl.revenue * 100 : 0,
            labor_pct: pnl.labor_cost && pnl.revenue ? pnl.labor_cost / pnl.revenue * 100 : 0,
            covers: 0, avg_ticket: 0, rating: 4.4, reviews_pending: 0
          }
        }
      }
    }
    setKpis(result)
  }

  // ─── Brief groupe généré par Claude ───────────────────
  async function generateBrief() {
    setBriefLoading(true)
    try {
      const kpiSummary = sites.map(s => {
        const k = DEMO_KPI[s.id] || {}
        return `${s.name}: CA ${k.revenue?.toLocaleString('fr-FR')} €, EBITDA ${k.ebitda_pct} %, food cost ${k.food_cost_pct} %, note ${k.rating}/5`
      }).join('\n')

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6', max_tokens: 400,
          messages: [{ role: 'user', content: `Tu es le directeur d'exploitation du groupe "Les Portes du Mont Saint Michel" (3 restaurants). Génère le briefing groupe du matin en 4 points maximum. Sois direct, chiffré, orienté décision. Identifie le meilleur site, le site qui dérive, et une opportunité d'optimisation inter-sites. Format : 4 points avec emoji, phrase courte, chiffre clé.\n\nKPIs d'hier :\n${kpiSummary}\n\nRéponds UNIQUEMENT avec les 4 points, rien d'autre.` }]
        })
      })
      const json = await resp.json()
      setBrief(json.content?.[0]?.text || null)
    } catch { setBrief(null) }
    setBriefLoading(false)
  }

  // ─── Calculs consolidés ────────────────────────────────
  const allKpis = Object.values(kpis)
  const totalRevenue   = allKpis.reduce((a, k) => a + (k.revenue || 0), 0)
  const avgEbitda      = allKpis.length ? allKpis.reduce((a, k) => a + (k.ebitda_pct || 0), 0) / allKpis.length : 0
  const avgFoodCost    = allKpis.length ? allKpis.reduce((a, k) => a + (k.food_cost_pct || 0), 0) / allKpis.length : 0
  const totalCovers    = allKpis.reduce((a, k) => a + (k.covers || 0), 0)
  const bestSite       = sites.length ? sites.reduce((best, s) => (kpis[s.id]?.ebitda_pct || 0) > (kpis[best?.id]?.ebitda_pct || 0) ? s : best, sites[0]) : null
  const worstSite      = sites.length ? sites.reduce((worst, s) => (kpis[s.id]?.ebitda_pct || 0) < (kpis[worst?.id]?.ebitda_pct || 0) ? s : worst, sites[0]) : null
  const groupImpact    = Math.round(totalRevenue * 0.041) // 4,1 % d'impact RestOS estimé

  // Écarts de performance
  const ecarts = sites.map(s => {
    const k = kpis[s.id] || {}
    return {
      site: s,
      kpi: k,
      ecartEbitda: k.ebitda_pct - avgEbitda,
      ecartFood: k.food_cost_pct - avgFoodCost,
      isBest: bestSite?.id === s.id,
      isWorst: worstSite?.id === s.id,
    }
  })

  // Détection anomalies
  const anomalies = []
  sites.forEach(s => {
    const k = kpis[s.id] || {}
    if (k.food_cost_pct > 32) anomalies.push({ site: s.name, type: 'food', msg: `Food cost élevé : ${k.food_cost_pct?.toFixed(1)} %`, impact: Math.round((k.food_cost_pct - 30) / 100 * k.revenue * 30) })
    if (k.ebitda_pct < 12) anomalies.push({ site: s.name, type: 'ebitda', msg: `EBITDA sous cible : ${k.ebitda_pct?.toFixed(1)} %`, impact: Math.round((12 - k.ebitda_pct) / 100 * k.revenue * 30) })
    if (k.reviews_pending > 2) anomalies.push({ site: s.name, type: 'reviews', msg: `${k.reviews_pending} avis sans réponse`, impact: 1200 })
  })

  function doAction(key, msg) {
    setValidated(v => ({ ...v, [key]: true }))
    toast(msg)
    supabase.from('ai_journal').insert({
      restaurant_id: sites[0]?.id || 'group',
      agent_key: 'agent_director',
      action_type: 'group_decision_validated',
      autonomy_mode: 1,
      description: `[GROUPE] ${msg}`,
      triggered_by: 'user'
    })
  }

  if (loading) return <div style={{ color: 'var(--muted)', padding: 30, textAlign: 'center' }}>Chargement du groupe…</div>

  return (
    <div className="animate-pop">

      {/* ── HEADER GROUPE ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontFamily: "'Fraunces',serif", fontWeight: 650, fontSize: 22, margin: '0 0 4px' }}>
            Les Portes du Mont Saint Michel
          </h2>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>
            {sites.length} établissements · pilotage groupe · {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
        {/* Mode switcher */}
        <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: 3, gap: 3 }}>
          {[['group', '📊 Groupe'], ['direction', '🎯 Direction'], ['site', '🏠 Par site']].map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} style={{
              padding: '7px 12px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
              background: mode === k ? 'var(--copper)' : 'transparent',
              color: mode === k ? '#14100A' : 'var(--muted)'
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* ── IMPACT GROUPE (toujours visible) ── */}
      <div style={{ background: 'linear-gradient(160deg, var(--surface2), var(--surface))', border: '1px solid var(--line)', borderRadius: 16, padding: '16px 20px', marginBottom: 14, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(420px 120px at 85% -20%, var(--copper-soft), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)' }}>Impact RestOS groupe — aujourd'hui</div>
        <div style={{ fontFamily: "'Fraunces',serif", fontSize: 42, fontWeight: 650, color: 'var(--copper)', lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>
          +{groupImpact.toLocaleString('fr-FR')} €
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
          {sites.map(s => {
            const k = kpis[s.id] || {}
            const siteImpact = Math.round((k.revenue || 0) * 0.041)
            return (
              <div key={s.id} style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                <span style={{ fontWeight: 700, color: s.color || 'var(--copper)' }}>{s.name}</span> +{siteImpact.toLocaleString('fr-FR')} €
              </div>
            )
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════ */}
      {/* MODE GROUPE */}
      {/* ══════════════════════════════════════════════════ */}
      {mode === 'group' && (
        <div>
          {/* KPIs consolidés */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'CA total groupe', value: `${totalRevenue.toLocaleString('fr-FR')} €`, sub: `${totalCovers} couverts`, color: 'var(--ink)' },
              { label: 'EBITDA moyen', value: `${avgEbitda.toFixed(1)} %`, sub: avgEbitda > 14 ? '✓ objectif atteint' : '⚠ sous objectif', color: avgEbitda > 14 ? 'var(--green)' : 'var(--gold)' },
              { label: 'Food cost moyen', value: `${avgFoodCost.toFixed(1)} %`, sub: avgFoodCost > 31 ? '⚠ au-dessus cible' : '✓ dans la cible', color: avgFoodCost > 31 ? 'var(--gold)' : 'var(--green)' },
              { label: 'Meilleur site', value: bestSite?.name || '—', sub: `EBITDA ${kpis[bestSite?.id]?.ebitda_pct?.toFixed(1)} %`, color: 'var(--green)' },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '13px 15px' }}>
                <div style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{k.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: k.color, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Comparaison des 3 sites */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 650, fontSize: 17, marginBottom: 14 }}>
              📍 Comparaison des sites
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sites.length}, 1fr)`, gap: 10, marginBottom: 12 }}>
              {ecarts.map(({ site, kpi: k, ecartEbitda, isBest, isWorst }) => (
                <div key={site.id} style={{ background: isBest ? 'var(--green-soft)' : isWorst ? 'var(--red-soft)' : 'var(--surface2)', border: `1px solid ${isBest ? 'rgba(76,154,106,.4)' : isWorst ? 'rgba(214,84,63,.4)' : 'var(--line)'}`, borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: site.color }}>{site.name}</div>
                    {isBest && <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--green)', color: '#0C1710', padding: '2px 7px', borderRadius: 99 }}>🏆 TOP</span>}
                    {isWorst && <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--red)', color: '#fff', padding: '2px 7px', borderRadius: 99 }}>⚠️</span>}
                  </div>
                  {[
                    ['CA', `${k.revenue?.toLocaleString('fr-FR')} €`],
                    ['EBITDA', `${k.ebitda_pct?.toFixed(1)} %`],
                    ['Food cost', `${k.food_cost_pct?.toFixed(1)} %`],
                    ['Note ★', `${k.rating}`],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '3px 0', borderBottom: '1px dashed var(--line)' }}>
                      <span style={{ color: 'var(--muted)' }}>{label}</span>
                      <span style={{ fontWeight: 600 }}>{val}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 8, fontSize: 12, color: ecartEbitda >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                    {ecartEbitda >= 0 ? '+' : ''}{ecartEbitda.toFixed(1)} pts vs moy.
                  </div>
                </div>
              ))}
            </div>

            {/* Intelligence croisée */}
            {bestSite && worstSite && bestSite.id !== worstSite.id && (
              <div style={{ background: 'var(--copper-soft)', border: '1px solid rgba(208,139,60,.35)', borderRadius: 10, padding: '10px 14px', marginTop: 4 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--copper)', marginBottom: 4 }}>🧠 Intelligence croisée</div>
                <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>
                  <b>{bestSite.name}</b> surperforme de <b>{(kpis[bestSite.id]?.ebitda_pct - kpis[worstSite.id]?.ebitda_pct).toFixed(1)} pts d'EBITDA</b> vs <b>{worstSite.name}</b>.
                  Causes probables : food cost maîtrisé ({kpis[bestSite.id]?.food_cost_pct?.toFixed(1)} % vs {kpis[worstSite.id]?.food_cost_pct?.toFixed(1)} %) et staffing optimisé.
                  <br /><b>Recommandation IA :</b> auditer et répliquer les process de {bestSite.name} sur {worstSite.name}.
                </div>
              </div>
            )}
          </div>

          {/* Anomalies groupe */}
          {anomalies.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '14px 16px', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>⚠️ Anomalies détectées — {anomalies.length} points critiques</div>
              {anomalies.map((a, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px dashed var(--line)', fontSize: 13 }}>
                  <div>
                    <span style={{ fontWeight: 700, color: 'var(--copper)' }}>{a.site}</span> — {a.msg}
                  </div>
                  <span style={{ color: 'var(--red)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>−{a.impact.toLocaleString('fr-FR')} €/mois</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions automatiques IA */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>🔵 Actions automatiques IA — cette nuit</div>
            {[
              { site: sites[0]?.name || 'Site A', action: 'Planning optimisé — masse salariale −1,8 %', agent: 'agent_planning' },
              { site: sites[1]?.name || 'Site B', action: 'Food cost recalculé suite facture Pomona', agent: 'agent_achats' },
              { site: sites[2]?.name || 'Site C', action: 'Commande fournisseur pré-remplie pour mardi', agent: 'agent_commandes' },
              { site: 'Groupe', action: 'Briefing consolidé direction généré à 6h00', agent: 'agent_director' },
            ].map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px dashed var(--line)', fontSize: 13 }}>
                <span style={{ color: 'var(--green)', fontWeight: 700 }}>✔</span>
                <span style={{ color: 'var(--copper)', fontWeight: 600, minWidth: 100 }}>{a.site}</span>
                <span style={{ color: 'var(--muted)' }}>{a.action}</span>
              </div>
            ))}
          </div>

          {/* Décisions groupe */}
          <GroupDecisions decisions={decisions} validated={validated} onValidate={doAction} onRefuse={(key) => setValidated(v => ({ ...v, [key]: 'refused' }))} sites={sites} />

          {/* Standardisation */}
          <Standardisation sites={sites} bestSite={bestSite} toast={toast} doAction={doAction} validated={validated} />
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* MODE DIRECTION */}
      {/* ══════════════════════════════════════════════════ */}
      {mode === 'direction' && (
        <div>
          {/* Brief IA groupe */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '16px 18px', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontFamily: "'Fraunces',serif", fontSize: 17, fontWeight: 650 }}>Briefing Direction — {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
              <button onClick={generateBrief} style={{ fontSize: 11.5, color: 'var(--copper)', fontWeight: 600 }}>🔄 Actualiser</button>
            </div>
            {briefLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 18, background: 'var(--surface2)', borderRadius: 6, width: `${55 + i * 12}%` }} />)}
              </div>
            ) : brief ? (
              <div style={{ fontSize: 14, lineHeight: 1.9, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{brief}</div>
            ) : (
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                <button onClick={generateBrief} className="btn btn-copper btn-sm">Générer le briefing</button>
              </div>
            )}
          </div>

          {/* Alertes critiques uniquement */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>🚨 Alertes critiques</div>
            {anomalies.length === 0 ? (
              <div style={{ color: 'var(--green)', fontWeight: 600, fontSize: 14 }}>✅ Aucune alerte critique — tous les sites dans les normes.</div>
            ) : anomalies.filter(a => a.impact > 500).map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px dashed var(--line)', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 20 }}>⚠️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{a.site} — {a.msg}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>Impact estimé : <b style={{ color: 'var(--red)' }}>−{a.impact.toLocaleString('fr-FR')} €/mois</b></div>
                </div>
              </div>
            ))}
          </div>

          {/* KPIs direction — vue synthétique */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>📊 KPIs groupe consolidés</div>
            {[
              { label: 'CA total groupe', value: `${totalRevenue.toLocaleString('fr-FR')} €/jour`, ref: 'Objectif semaine : 160 k€', ok: totalRevenue > 20000 },
              { label: 'EBITDA moyen', value: `${avgEbitda.toFixed(1)} %`, ref: 'Cible ≥ 14 %', ok: avgEbitda >= 14 },
              { label: 'Food cost moyen', value: `${avgFoodCost.toFixed(1)} %`, ref: 'Cible ≤ 30 %', ok: avgFoodCost <= 30 },
              { label: 'Écart perf. max', value: `${Math.max(...ecarts.map(e => Math.abs(e.ecartEbitda))).toFixed(1)} pts`, ref: 'Seuil alerte : 5 pts', ok: Math.max(...ecarts.map(e => Math.abs(e.ecartEbitda))) < 5 },
              { label: 'Impact RestOS/j', value: `+${groupImpact.toLocaleString('fr-FR')} €`, ref: 'ROI annualisé ≈ +135 k€', ok: true },
            ].map(k => (
              <div key={k.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px dashed var(--line)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{k.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{k.ref}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: k.ok ? 'var(--green)' : 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: k.ok ? 'var(--green)' : 'var(--red)' }}>{k.ok ? '✓ dans les normes' : '⚠ hors cible'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* MODE PAR SITE */}
      {/* ══════════════════════════════════════════════════ */}
      {mode === 'site' && (
        <div>
          {/* Sélecteur de site */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {sites.map(s => (
              <button key={s.id} onClick={() => setActiveSite(s.id === activeSite ? null : s.id)} style={{
                padding: '10px 16px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all .15s',
                background: activeSite === s.id ? s.color || 'var(--copper)' : 'var(--surface)',
                color: activeSite === s.id ? '#fff' : 'var(--muted)',
                border: `1px solid ${activeSite === s.id ? s.color || 'var(--copper)' : 'var(--line)'}`
              }}>{s.name}</button>
            ))}
          </div>

          {activeSite ? (
            <SiteDetail siteId={activeSite} sites={sites} kpis={kpis} ecarts={ecarts} bestSite={bestSite} />
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 30, textAlign: 'center', color: 'var(--muted)' }}>
              Sélectionnez un site pour voir son détail
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Décisions groupe ─────────────────────────────────
function GroupDecisions({ decisions, validated, onValidate, onRefuse, sites }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '14px 16px', marginBottom: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>⚡ Décisions groupe — validation requise</div>
      {decisions.map((d, i) => {
        const key = `dec_${i}`
        const status = validated[key]
        return (
          <div key={i} style={{ marginBottom: 14, padding: '14px', background: 'var(--surface2)', borderRadius: 12, border: `1px solid ${status === true ? 'var(--green)' : status === 'refused' ? 'var(--red)' : 'var(--line)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{d.title}</div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'var(--copper-soft)', color: 'var(--copper)' }}>GROUPE</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.6 }}>{d.desc}</div>

            {/* Impact par site */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
              {sites.slice(0, 3).map((s, j) => (
                <div key={s.id} style={{ background: 'var(--surface)', borderRadius: 9, padding: '8px 10px' }}>
                  <div style={{ fontSize: 11, color: s.color || 'var(--copper)', fontWeight: 700 }}>{s.name}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: d.impacts[j] >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 3 }}>
                    {d.impacts[j] >= 0 ? '+' : ''}{d.impacts[j]} €/mois
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 12.5 }}>
                <span style={{ color: 'var(--muted)' }}>Recommandation IA : </span>
                <span style={{ fontWeight: 700, color: d.reco ? 'var(--green)' : 'var(--red)' }}>{d.reco ? '✅ VALIDER' : '❌ REFUSER'}</span>
              </div>
              {!status ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-green btn-sm" onClick={() => onValidate(key, `[GROUPE] ${d.title} — validé pour les ${sites.length} sites`)}>✔ Valider groupe</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => onValidate(key, `[GROUPE] ${d.title} — modifié avant validation`)}>✏ Modifier</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => onRefuse(key)}>✗ Refuser</button>
                </div>
              ) : (
                <div style={{ color: status === true ? 'var(--green)' : 'var(--red)', fontWeight: 600, fontSize: 13 }}>
                  {status === true ? '✅ Validé pour les 3 sites' : '❌ Refusé'}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Standardisation inter-sites ──────────────────────
function Standardisation({ sites, bestSite, toast, doAction, validated }) {
  const suggestions = [
    { key: 'std_menu', title: 'Répliquer la carte optimisée', desc: `La carte de ${bestSite?.name || 'Site A'} génère +2,1 pts de marge grâce à 3 plats reformulés. Déploiement proposé sur les 2 autres sites.`, gain: '+4 200 €/mois groupe', icon: '🍽️' },
    { key: 'std_planning', title: 'Diffuser le modèle de planning', desc: `Le planning de ${bestSite?.name || 'Site A'} réduit la masse salariale de 1,8 pts. Duplication sur les autres sites possible en 1 clic.`, gain: '+2 800 €/mois groupe', icon: '📅' },
    { key: 'std_achats', title: 'Groupement d\'achat consolidé', desc: 'Regrouper les commandes des 3 sites chez Metro et Pomona pour obtenir les tarifs volume. Potentiel négocié : −8 % sur les achats.', gain: '+1 900 €/mois groupe', icon: '🛒' },
  ]

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '14px 16px' }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>🔁 Standardisation inter-sites</div>
      {suggestions.map(s => (
        <div key={s.key} style={{ padding: '12px 0', borderBottom: '1px dashed var(--line)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 20 }}>{s.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{s.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', margin: '4px 0 8px', lineHeight: 1.5 }}>{s.desc}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{s.gain}</span>
                {!validated[s.key] ? (
                  <button className="btn btn-copper btn-sm" onClick={() => doAction(s.key, `Standardisation "${s.title}" déployée sur les 3 sites`)}>
                    → Déployer sur les 3 sites
                  </button>
                ) : (
                  <span style={{ color: 'var(--green)', fontWeight: 600, fontSize: 13 }}>✅ Déployé</span>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Détail d'un site ─────────────────────────────────
function SiteDetail({ siteId, sites, kpis, ecarts, bestSite }) {
  const site = sites.find(s => s.id === siteId)
  const k = kpis[siteId] || {}
  const ecart = ecarts.find(e => e.site.id === siteId)
  if (!site) return null

  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${site.color || 'var(--line)'}`, borderRadius: 16, padding: '16px 18px', animation: 'pop .2s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontFamily: "'Fraunces',serif", fontSize: 19, fontWeight: 650, color: site.color }}>{site.name}</div>
        {bestSite?.id === siteId && <span style={{ background: 'var(--green)', color: '#0C1710', fontWeight: 700, fontSize: 11, padding: '3px 10px', borderRadius: 99 }}>🏆 Meilleur site</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 14 }}>
        {[
          ['CA hier', `${k.revenue?.toLocaleString('fr-FR')} €`],
          ['EBITDA', `${k.ebitda_pct?.toFixed(1)} %`],
          ['Food cost', `${k.food_cost_pct?.toFixed(1)} %`],
          ['Masse sal.', `${k.labor_pct?.toFixed(1)} %`],
          ['Couverts', String(k.covers)],
          ['Note Google', `${k.rating} ★`],
        ].map(([l, v]) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--surface2)', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>
            <span style={{ color: 'var(--muted)' }}>{l}</span>
            <span style={{ fontWeight: 700 }}>{v}</span>
          </div>
        ))}
      </div>
      {ecart && (
        <div style={{ background: ecart.ecartEbitda >= 0 ? 'var(--green-soft)' : 'var(--red-soft)', border: `1px solid ${ecart.ecartEbitda >= 0 ? 'rgba(76,154,106,.4)' : 'rgba(214,84,63,.4)'}`, borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
          <b>Position groupe :</b> {ecart.ecartEbitda >= 0 ? '+' : ''}{ecart.ecartEbitda.toFixed(1)} pts d'EBITDA vs moyenne groupe.
          {ecart.isWorst && ` Priorité d'intervention — gap de ${Math.abs(ecart.ecartEbitda).toFixed(1)} pts.`}
          {ecart.isBest && ` Pratiques à dupliquer sur les autres sites.`}
        </div>
      )}
    </div>
  )
}

// ─── Décisions par défaut ─────────────────────────────
function initDecisions() {
  return [
    {
      title: 'Standardiser le menu "entrées" groupe',
      desc: 'Harmoniser les 3 entrées phares sur les 3 sites avec des recettes identiques optimisées. Impact : réduction coût d\'achat groupe −6 % et cohérence de l\'offre.',
      impacts: [+420, +380, +520],
      reco: true
    },
    {
      title: 'Réallocation staff — Site B → Site C',
      desc: 'Le Site B est surstaffé le vendredi soir (+1,2 ETP inutile). Le Site C est sous tension le même créneau. Proposition : déplacement d\'un extra vendredi.',
      impacts: [-180, -320, +640],
      reco: true
    },
    {
      title: 'Groupement d\'achat poisson — Criée Rochelaise',
      desc: 'Centraliser les achats poisson des 3 sites auprès de la Criée Rochelaise. Volume combiné : 85 kg/sem → tarif préférentiel −12 % négocié.',
      impacts: [+310, +240, +430],
      reco: true
    }
  ]
}
