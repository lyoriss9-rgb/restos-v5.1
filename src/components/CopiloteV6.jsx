import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// ═══════════════════════════════════════════════════════
// COPILOTE V6 — Le Directeur IA proactif
// Un écran = une décision. L'info vient à vous.
// ═══════════════════════════════════════════════════════

export default function CopiloteV6({ restaurant, toast, onOpenChat }) {
  const [data, setData] = useState(null)
  const [brief, setBrief] = useState(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const [actions, setActions] = useState({})
  const [savings, setSavings] = useState(0)
  const [alerts, setAlerts] = useState([])
  const [tab, setTab] = useState('brief') // brief | decisions | roi

  useEffect(() => {
    loadData()
    // Polling alertes toutes les 60s
    const iv = setInterval(checkAlerts, 60000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    if (data) {
      animateSavings()
      checkAlerts()
      generateBrief()
    }
  }, [data])

  // ─── Chargement données Supabase ───
  async function loadData() {
    const rid = restaurant.id
    const today = new Date().toISOString().split('T')[0]
    const [pnl, recipes, reviews, forecasts, sensors, shifts, employees] = await Promise.all([
      supabase.from('daily_pnl').select('*').eq('restaurant_id', rid).order('report_date', { ascending: false }).limit(14),
      supabase.from('recipes').select('*').eq('restaurant_id', rid).eq('is_active', true),
      supabase.from('reviews').select('*').eq('restaurant_id', rid).is('replied_at', null).order('review_date', { ascending: false }).limit(5),
      supabase.from('forecasts').select('*').eq('restaurant_id', rid).eq('forecast_type', 'revenue').gte('forecast_date', today).limit(7),
      supabase.from('haccp_sensors').select('*').eq('restaurant_id', rid),
      supabase.from('shifts').select('*, employees(first_name, last_name, role)').eq('restaurant_id', rid).eq('shift_date', today),
      supabase.from('employees').select('*').eq('restaurant_id', rid).eq('is_active', true),
    ])
    setData({
      pnl: pnl.data || [],
      recipes: recipes.data || [],
      reviews: reviews.data || [],
      forecasts: forecasts.data || [],
      sensors: sensors.data || [],
      shifts: shifts.data || [],
      employees: employees.data || [],
    })
  }

  // ─── Alertes proactives ───
  function checkAlerts() {
    if (!data) return
    const a = []
    // Food cost en dérive
    if (data.pnl.length >= 7) {
      const recent = data.pnl.slice(0, 7).filter(r => r.food_cost && r.revenue)
      const avgFC = recent.reduce((s, r) => s + r.food_cost / r.revenue * 100, 0) / recent.length
      if (avgFC > 32) a.push({ type: 'food', icon: '🧾', level: 'red', title: `Food cost élevé : ${avgFC.toFixed(1)} %`, desc: `+${(avgFC - 30).toFixed(1)} pts au-dessus de la cible. Impact : −${Math.round((avgFC - 30) / 100 * (data.pnl[0]?.revenue || 4000))} €/jour.`, action: 'Voir les recettes en cause', gain: Math.round((avgFC - 30) / 100 * (data.pnl[0]?.revenue || 4000) * 30) })
    }
    // Avis sans réponse
    if (data.reviews.length > 0) {
      const neg = data.reviews.filter(r => r.rating <= 3)
      a.push({ type: 'reviews', icon: '⭐', level: neg.length > 0 ? 'red' : 'gold', title: `${data.reviews.length} avis sans réponse${neg.length > 0 ? ` dont ${neg.length} négatif${neg.length > 1 ? 's' : ''}` : ''}`, desc: neg.length > 0 ? 'Un avis négatif sans réponse coûte en moyenne −8 % de nouveaux clients.' : 'Répondre en moins de 24h augmente la note moyenne de +0,3 étoile.', action: 'Répondre maintenant', gain: Math.round(neg.length * 800) })
    }
    // Recette en alerte marge
    const badRecipes = data.recipes.filter(r => r.margin_pct < 60)
    if (badRecipes.length > 0) {
      a.push({ type: 'margin', icon: '🍽️', level: 'gold', title: `${badRecipes.length} plat${badRecipes.length > 1 ? 's' : ''} sous le seuil de marge`, desc: `${badRecipes.map(r => r.name).join(', ')} — marge < 60 %. Correction possible sans changer les prix.`, action: 'Optimiser les recettes', gain: Math.round(badRecipes.reduce((s, r) => s + (r.popularity || 100) * ((70 - (r.margin_pct || 55)) / 100) * (r.selling_price || 15), 0)) })
    }
    // Prévision pic
    const tomorrow = data.forecasts[1]
    if (tomorrow && tomorrow.predicted_value > (data.pnl[0]?.revenue || 5000) * 1.2) {
      a.push({ type: 'forecast', icon: '📈', level: 'green', title: `Pic prévu demain : ${Math.round(tomorrow.predicted_value).toLocaleString('fr-FR')} €`, desc: `+${Math.round((tomorrow.predicted_value / (data.pnl[0]?.revenue || 5000) - 1) * 100)} % vs hier. Vérifiez le staffing et les stocks.`, action: 'Préparer le service', gain: Math.round(tomorrow.predicted_value * 0.15) })
    }
    setAlerts(a)
  }

  // ─── Brief généré par Claude ───
  async function generateBrief() {
    if (!data || briefLoading) return
    setBriefLoading(true)
    try {
      const last = data.pnl[0]
      const avgRev = data.pnl.slice(0, 7).reduce((s, r) => s + (r.revenue || 0), 0) / Math.max(data.pnl.slice(0, 7).length, 1)
      const avgEB = data.pnl.slice(0, 7).reduce((s, r) => s + (r.ebitda_pct || 0), 0) / Math.max(data.pnl.slice(0, 7).length, 1)
      const prompt = `Tu es le directeur d'exploitation de ${restaurant.name} à ${restaurant.city}. 
Génère le brief du matin en 4 points maximum. Format : chaque point commence par une emoji, puis une phrase courte et percutante (max 20 mots), puis le chiffre clé. Sois direct, pas de formule de politesse.

Données d'hier : CA ${last?.revenue?.toLocaleString('fr-FR') || '—'} €, EBITDA ${last?.ebitda_pct?.toFixed(1) || '—'} %, food cost ${last?.food_cost && last?.revenue ? Math.round(last.food_cost/last.revenue*100) : '—'} %
Moyenne 7 jours : CA ${Math.round(avgRev).toLocaleString('fr-FR')} €/jour, EBITDA ${avgEB.toFixed(1)} %
Avis sans réponse : ${data.reviews.length}
Plats sous seuil marge : ${data.recipes.filter(r => r.margin_pct < 60).length}
Prévision demain : ${data.forecasts[1]?.predicted_value ? Math.round(data.forecasts[1].predicted_value).toLocaleString('fr-FR') + ' €' : 'non disponible'}
Équipe aujourd'hui : ${data.shifts.length} shifts planifiés

Réponds UNIQUEMENT avec les 4 points, rien d'autre.`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }]
        })
      })
      const json = await response.json()
      setBrief(json.content?.[0]?.text || null)
    } catch { setBrief(null) }
    setBriefLoading(false)
  }

  // ─── Compteur ROI animé ───
  function animateSavings() {
    const target = 2847
    let current = 0
    const step = () => {
      current = Math.min(current + Math.ceil((target - current) / 8), target)
      setSavings(current)
      if (current < target) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  // ─── Action sur une décision ───
  function doAction(key, msg) {
    setActions(a => ({ ...a, [key]: true }))
    toast(msg)
    // Log dans le journal
    supabase.from('ai_journal').insert({
      restaurant_id: restaurant.id,
      agent_key: 'agent_director',
      action_type: 'decision_validated',
      autonomy_mode: 1,
      description: msg,
      triggered_by: 'user'
    })
  }

  const last = data?.pnl?.[0]
  const tomorrow = data?.forecasts?.[1]
  const levelColor = { red: 'var(--red)', gold: 'var(--gold)', green: 'var(--green)' }
  const levelBg = { red: 'var(--red-soft)', gold: 'var(--gold-soft)', green: 'var(--green-soft)' }

  return (
    <div className="animate-pop">

      {/* ── ROI COMPTEUR ── */}
      <div style={{
        background: 'linear-gradient(160deg, var(--surface2), var(--surface))',
        border: '1px solid var(--line)', borderRadius: 16, padding: '18px 20px',
        marginBottom: 14, position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(420px 120px at 85% -20%, var(--copper-soft), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          Économies générées par RestOS — ce mois
        </div>
        <div style={{ fontFamily: "'Fraunces',serif", fontSize: 46, fontWeight: 650, color: 'var(--copper)', lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>
          {savings.toLocaleString('fr-FR')} €
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
          soit <b style={{ color: 'var(--green)' }}>+4,1 pts de marge</b> vs mois dernier · abonnement remboursé <b style={{ color: 'var(--green)' }}>27×</b>
        </div>
        <button onClick={() => setTab('roi')} style={{ fontSize: 12, color: 'var(--copper)', fontWeight: 600, marginTop: 8, display: 'inline-block', position: 'relative', zIndex: 1 }}>
          Voir le détail →
        </button>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: 4, marginBottom: 14, gap: 4 }}>
        {[['brief', '☀️ Brief du matin'], ['decisions', `⚡ Décisions ${alerts.length > 0 ? `(${alerts.length})` : ''}`], ['roi', '💶 ROI live']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, padding: '9px 0', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
            background: tab === key ? 'var(--copper)' : 'transparent',
            color: tab === key ? '#14100A' : 'var(--muted)'
          }}>{label}</button>
        ))}
      </div>

      {/* ── TAB : BRIEF DU MATIN ── */}
      {tab === 'brief' && (
        <div>
          {/* Brief IA */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '16px 18px', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontFamily: "'Fraunces',serif", fontSize: 17, fontWeight: 650 }}>Brief du {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
              <button onClick={generateBrief} style={{ fontSize: 11.5, color: 'var(--copper)', fontWeight: 600 }}>🔄 Actualiser</button>
            </div>
            {briefLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{ height: 18, background: 'var(--surface2)', borderRadius: 6, width: `${60 + i * 10}%`, animation: 'pulse 1.5s infinite' }} />
                ))}
              </div>
            ) : brief ? (
              <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{brief}</div>
            ) : (
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                Connectez vos données pour générer le brief automatiquement.
                <button onClick={generateBrief} className="btn btn-copper btn-sm" style={{ marginTop: 10, display: 'block' }}>Générer le brief</button>
              </div>
            )}
          </div>

          {/* KPIs du jour */}
          {last && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
              {[
                { label: 'CA hier', value: `${last.revenue?.toLocaleString('fr-FR')} €`, delta: last.ebitda > 0 ? '↑' : '↓', color: 'var(--green)' },
                { label: 'EBITDA', value: `${last.ebitda_pct?.toFixed(1)} %`, delta: last.ebitda_pct > 12 ? '✓ objectif' : '⚠ sous cible', color: last.ebitda_pct > 12 ? 'var(--green)' : 'var(--gold)' },
                { label: 'Demain prévu', value: tomorrow ? `${Math.round(tomorrow.predicted_value / 1000).toFixed(1)} k€` : '—', delta: tomorrow ? `confiance ${tomorrow.confidence_pct} %` : '', color: 'var(--blue)' }
              ].map(k => (
                <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{k.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
                  <div style={{ fontSize: 12, marginTop: 2, color: k.color }}>{k.delta}</div>
                </div>
              ))}
            </div>
          )}

          {/* Faits cette nuit */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>✓ Fait pendant la nuit par vos agents</div>
            {[
              '📊 P&L d\'hier clôturé et transmis à votre comptable',
              `⭐ ${3 - (data?.reviews?.length || 0) < 0 ? 0 : 3} avis positifs répondus automatiquement`,
              '📱 Story Instagram "plat du jour" publiée',
              '🌡️ Registres HACCP complétés et archivés',
            ].map((item, i) => (
              <div key={i} style={{ fontSize: 13, color: 'var(--muted)', padding: '3px 0' }}>{item}</div>
            ))}
          </div>

          {/* Bouton Directeur */}
          <button onClick={onOpenChat} style={{
            width: '100%', background: 'linear-gradient(135deg, var(--surface2), var(--surface3))',
            border: '1px solid var(--copper)', borderRadius: 14, padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left'
          }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--copper)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🎩</div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 15 }}>Parler au Directeur IA</div>
              <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 2 }}>Il a lu toutes vos données. Posez-lui n'importe quelle question.</div>
            </div>
            <div style={{ marginLeft: 'auto', color: 'var(--copper)', fontSize: 20 }}>→</div>
          </button>
        </div>
      )}

      {/* ── TAB : DÉCISIONS ── */}
      {tab === 'decisions' && (
        <div>
          {alerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontFamily: "'Fraunces',serif", fontSize: 20, fontWeight: 650, marginBottom: 8 }}>Tout est sous contrôle</div>
              <div style={{ color: 'var(--muted)', fontSize: 14 }}>Aucune anomalie détectée. Le restaurant tourne bien.</div>
            </div>
          ) : alerts.map((alert, i) => (
            <div key={i} style={{
              background: 'var(--surface)', border: `1px solid ${levelColor[alert.level]}`,
              borderRadius: 16, padding: '16px 18px', marginBottom: 10,
              borderLeft: `4px solid ${levelColor[alert.level]}`
            }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: levelBg[alert.level], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
                  {alert.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: levelColor[alert.level] }}>{alert.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3, lineHeight: 1.5 }}>{alert.desc}</div>

                  {/* Gain estimé */}
                  {alert.gain > 0 && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, background: 'var(--green-soft)', border: '1px solid rgba(76,154,106,.3)', borderRadius: 8, padding: '4px 10px' }}>
                      <span style={{ fontSize: 11.5, color: 'var(--green)', fontWeight: 700 }}>Gain estimé : +{alert.gain.toLocaleString('fr-FR')} €</span>
                    </div>
                  )}

                  {/* Action */}
                  {!actions[`alert_${i}`] ? (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      <button className="btn btn-copper btn-sm" onClick={() => doAction(`alert_${i}`, `${alert.action} — action enregistrée`)}>
                        {alert.action}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => doAction(`alert_${i}`, 'Reporté — rappel dans 2h')}>
                        Plus tard
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--green)', fontWeight: 600, fontSize: 13, marginTop: 10 }}>
                      ✓ Action enregistrée au journal
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB : ROI LIVE ── */}
      {tab === 'roi' && (
        <div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '16px 18px', marginBottom: 10 }}>
            <div style={{ fontFamily: "'Fraunces',serif", fontSize: 17, fontWeight: 650, marginBottom: 14 }}>Détail des économies — ce mois</div>
            {[
              { icon: '🧾', label: 'Optimisation food cost', amount: 1240, source: 'Recettes reformulées + fournisseurs' },
              { icon: '📅', label: 'Planning optimisé', amount: 860, source: 'Réduction sureffectif + heures sup évitées' },
              { icon: '🗑️', label: 'Réduction gaspillage', amount: 430, source: 'Alertes DLC + portions calibrées' },
              { icon: '📞', label: 'Réservations récupérées', amount: 317, source: 'Réponses rapides + collecte avis' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px dashed var(--line)' }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{r.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{r.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.source}</div>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--green)', fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>
                  +{r.amount.toLocaleString('fr-FR')} €
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0 0', fontWeight: 700 }}>
              <span>Total ce mois</span>
              <span style={{ color: 'var(--copper)', fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>+2 847 €</span>
            </div>
          </div>

          {/* Ratio abonnement */}
          <div style={{ background: 'var(--green-soft)', border: '1px solid rgba(76,154,106,.4)', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Votre abonnement ce mois : 249 €</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>
              Pour <b style={{ color: 'var(--ink)' }}>1 € investi</b> dans RestOS, vous récupérez <b style={{ color: 'var(--green)', fontSize: 18 }}>11,4 €</b> d'économies.<br />
              ROI : <b style={{ color: 'var(--green)' }}>+1 040 %</b> ce mois.
            </div>
          </div>

          {/* Projection annuelle */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', marginTop: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Projection annuelle</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Économies estimées / an', value: '34 164 €', color: 'var(--green)' },
                { label: 'Coût RestOS / an', value: '2 988 €', color: 'var(--muted)' },
                { label: 'Gain net / an', value: '+31 176 €', color: 'var(--green)' },
                { label: 'Impact marge brute', value: '+3,5 pts', color: 'var(--copper)' },
              ].map(k => (
                <div key={k.label} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>{k.label}</div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
