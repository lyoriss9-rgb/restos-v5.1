import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Copilote from '../components/Copilote'
import { FoodCost } from '../components/Components'
import { Finance } from '../components/Components'
import { Planning } from '../components/Components'
import { Avis } from '../components/Components'
import { Journal } from '../components/Components'
import { Toast } from '../components/Components'
import Director from '../components/Director'
import { RecipesManager, EmployeesManager, StocksManager, Settings } from '../components/Forms'
import MultiSite from '../components/MultiSite'
import {
  exportPlanningExcel, exportPlanningPDF,
  exportPnlExcel, exportPnlPDF,
  exportFoodCostExcel, exportFoodCostPDF,
  exportHaccpPDF
} from '../components/Exports'

const PAGES = [
  { key: 'copilote',   icon: '☀️',  label: 'Copilote',    group: 'Pilotage' },
  { key: 'finance',    icon: '💶',  label: 'Finance',     group: 'Pilotage' },
  { key: 'prevision',  icon: '📈',  label: 'Prévision',   group: 'Pilotage' },
  { key: 'multisite',  icon: '🏢',  label: 'Multi-sites', group: 'Pilotage' },
  { key: 'recettes',   icon: '🍽️', label: 'Carte',       group: 'Exploitation' },
  { key: 'stocks',     icon: '📦',  label: 'Stocks',      group: 'Exploitation' },
  { key: 'equipe',     icon: '👥',  label: 'Équipe',      group: 'Exploitation' },
  { key: 'planning',   icon: '📅',  label: 'Planning',    group: 'Exploitation' },
  { key: 'haccp',      icon: '🌡️', label: 'HACCP',       group: 'Exploitation' },
  { key: 'avis',       icon: '⭐',  label: 'Avis',        group: 'Clients' },
  { key: 'exports',    icon: '📤',  label: 'Exports',     group: 'Outils' },
  { key: 'journal',    icon: '📜',  label: 'Journal IA',  group: 'Outils' },
  { key: 'parametres', icon: '⚙️', label: 'Paramètres',  group: 'Outils' },
]

export default function Dashboard({ restaurant: initialRestaurant, session, onLogout }) {
  const [restaurant, setRestaurant] = useState(initialRestaurant)
  const [page, setPage] = useState('copilote')
  const [toasts, setToasts] = useState([])
  const [chatOpen, setChatOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [kpis, setKpis] = useState(null)
  const [sideOpen, setSideOpen] = useState(false)

  const toast = useCallback((msg, type = 'success') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])

  useEffect(() => { loadKpis() }, [restaurant.id])

  async function loadKpis() {
    const { data } = await supabase.from('daily_pnl').select('revenue,ebitda,food_cost,ebitda_pct')
      .eq('restaurant_id', restaurant.id).order('report_date', { ascending: false }).limit(1).single()
    if (data) setKpis(data)
  }

  function go(p) { setPage(p); setSideOpen(false); window.scrollTo({ top: 0 }) }

  const groups = [...new Set(PAGES.map(p => p.group))]
  const planIcon = { pilot: '🟢', autopilot: '🔵', enterprise: '🟣' }[restaurant.plan] || '🔵'

  const Sidebar = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      <div style={{ fontFamily: "'Fraunces',serif", fontSize: 22, fontWeight: 650, padding: '0 10px 2px', color: 'var(--ink)' }}>
        Rest<span style={{ color: 'var(--copper)' }}>OS</span>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', padding: '0 10px 16px' }}>{restaurant.name}</div>
      {groups.map(g => (
        <div key={g}>
          <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)', padding: '10px 10px 5px', opacity: .8 }}>{g}</div>
          {PAGES.filter(p => p.group === g).map(p => (
            <button key={p.key} onClick={() => go(p.key)} style={{
              display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left',
              padding: '8px 10px', borderRadius: 9, marginBottom: 1, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: page === p.key ? 'var(--copper-soft)' : 'transparent',
              color: page === p.key ? 'var(--copper)' : 'var(--muted)',
              transition: 'background .12s'
            }}>
              <span>{p.icon}</span>{p.label}
            </button>
          ))}
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: 10, borderTop: '1px solid var(--line)', marginTop: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 99, background: 'var(--copper)', color: '#14100A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
          {session.user.email[0].toUpperCase()}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.user.email}</div>
          <div style={{ fontSize: 10.5, color: 'var(--copper)' }}>{planIcon} {restaurant.plan}</div>
        </div>
        <button onClick={onLogout} style={{ color: 'var(--muted)', fontSize: 12 }}>Déco</button>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', maxWidth: 1200, margin: '0 auto', minHeight: '100vh' }}>

      {/* Sidebar desktop */}
      <aside style={{ width: 220, padding: '20px 12px', borderRight: '1px solid var(--line)', position: 'sticky', top: 0, height: '100vh', flexShrink: 0, display: 'none' }} className="sidebar-desk">
        <style>{`.sidebar-desk{display:flex!important;flex-direction:column;}@media(max-width:900px){.sidebar-desk{display:none!important}}`}</style>
        <Sidebar />
      </aside>

      {/* Sidebar mobile overlay */}
      {sideOpen && (
        <div onClick={() => setSideOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(10,14,11,.8)', zIndex: 40, display: 'flex' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 240, background: 'var(--surface)', borderRight: '1px solid var(--line)', padding: '20px 12px', height: '100vh', overflowY: 'auto' }}>
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, padding: '14px 16px 108px', minWidth: 0 }}>

        {/* Topbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, position: 'sticky', top: 0, background: 'linear-gradient(var(--bg) 82%,transparent)', padding: '6px 0 10px', zIndex: 15 }}>
          <button onClick={() => setSideOpen(true)} style={{ fontSize: 20, padding: '6px 8px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10 }} className="menu-btn">
            <style>{`@media(min-width:900px){.menu-btn{display:none!important}}`}</style>
            ☰
          </button>
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: 20, fontWeight: 650 }} className="brand-mobile">
            <style>{`@media(min-width:900px){.brand-mobile{display:none!important}}`}</style>
            Rest<span style={{ color: 'var(--copper)' }}>OS</span>
          </div>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '5px 10px', borderRadius: 99, background: 'var(--copper-soft)', color: 'var(--copper)', border: '1px solid rgba(208,139,60,.35)' }}>
            {planIcon} {restaurant.plan.toUpperCase()}
          </span>
          <button onClick={() => setNotifOpen(o => !o)} style={{ fontSize: 18, padding: 7, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, position: 'relative' }}>
            🔔<span style={{ position: 'absolute', top: -4, right: -4, background: 'var(--red)', color: '#fff', fontSize: 9, fontWeight: 700, minWidth: 16, height: 16, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)' }}>3</span>
          </button>
        </div>

        <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 14 }}>
          <b style={{ color: 'var(--ink)' }}>{restaurant.name}</b> · {restaurant.city} ·{' '}
          <span style={{ color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span className="live" />en ligne
          </span>
        </div>

        {/* KPIs globaux */}
        {kpis && (
          <div className="kpis kpis-3" style={{ marginBottom: 14 }}>
            <div className="kpi"><div className="kpi-label">CA hier</div><div className="kpi-value">{kpis.revenue?.toLocaleString('fr-FR')} €</div><div className="kpi-delta delta-up">Supabase live</div></div>
            <div className="kpi"><div className="kpi-label">Food cost</div><div className="kpi-value">{kpis.food_cost && kpis.revenue ? Math.round(kpis.food_cost / kpis.revenue * 100) : '—'} %</div></div>
            <div className="kpi"><div className="kpi-label">EBITDA</div><div className="kpi-value" style={{ color: kpis.ebitda > 0 ? 'var(--green)' : 'var(--red)' }}>{kpis.ebitda_pct?.toFixed(1)} %</div></div>
          </div>
        )}

        {/* Pages */}
        {page === 'copilote'   && <Copilote restaurant={restaurant} toast={toast} onOpenChat={() => setChatOpen(true)} />}
        {page === 'finance'    && <Finance restaurant={restaurant} toast={toast} />}
        {page === 'planning'   && <Planning restaurant={restaurant} toast={toast} />}
        {page === 'avis'       && <Avis restaurant={restaurant} toast={toast} />}
        {page === 'journal'    && <Journal restaurant={restaurant} />}
        {page === 'recettes'   && <RecipesManager restaurant={restaurant} toast={toast} />}
        {page === 'equipe'     && <EmployeesManager restaurant={restaurant} toast={toast} />}
        {page === 'stocks'     && <StocksManager restaurant={restaurant} toast={toast} />}
        {page === 'multisite'  && <MultiSite userId={session.user.id} toast={toast} />}
        {page === 'parametres' && <Settings restaurant={restaurant} toast={toast} onUpdate={setRestaurant} />}

        {page === 'prevision' && (
          <div className="animate-pop">
            <h2 style={{ fontFamily: "'Fraunces',serif", fontWeight: 650, fontSize: 19, margin: '0 0 10px' }}>Prévision CA <span style={{ color: 'var(--muted)', fontSize: 12.5, fontFamily: 'Inter', fontWeight: 500, marginLeft: 8 }}>7 jours</span></h2>
            <PrevisionView restaurant={restaurant} />
          </div>
        )}

        {page === 'haccp' && <HaccpView restaurant={restaurant} toast={toast} />}

        {page === 'exports' && (
          <div className="animate-pop">
            <h2 style={{ fontFamily: "'Fraunces',serif", fontWeight: 650, fontSize: 19, margin: '0 0 14px' }}>
              Exports <span style={{ color: 'var(--muted)', fontSize: 12.5, fontFamily: 'Inter', fontWeight: 500, marginLeft: 8 }}>PDF & Excel</span>
            </h2>
            <ExportsPage restaurant={restaurant} toast={toast}
              exportPlanningExcel={() => { exportPlanningExcel(restaurant); toast('Export planning Excel ✓') }}
              exportPlanningPDF={() => exportPlanningPDF(restaurant)}
              exportPnlExcel={() => { exportPnlExcel(restaurant); toast('Export P&L Excel ✓') }}
              exportPnlPDF={() => exportPnlPDF(restaurant)}
              exportFoodCostExcel={() => { exportFoodCostExcel(restaurant); toast('Export Food Cost Excel ✓') }}
              exportFoodCostPDF={() => exportFoodCostPDF(restaurant)}
              exportHaccpPDF={() => exportHaccpPDF(restaurant)}
            />
          </div>
        )}

        <div style={{ fontSize: 11.5, color: 'var(--muted)', textAlign: 'center', marginTop: 26, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          RestOS V5.1 · Supabase + Claude API · © 2026
        </div>
      </div>

      {/* Nav mobile */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(15,20,17,.94)', backdropFilter: 'blur(12px)', borderTop: '1px solid var(--line)', zIndex: 10 }} className="nav-mobile">
        <style>{`@media(min-width:900px){.nav-mobile{display:none!important}}`}</style>
        <div style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {PAGES.slice(0, 8).map(p => (
            <button key={p.key} onClick={() => go(p.key)} style={{
              flex: '0 0 auto', minWidth: 58, color: page === p.key ? 'var(--copper)' : 'var(--muted)',
              padding: '9px 4px 11px', fontSize: 9, fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              borderTop: page === p.key ? '2px solid var(--copper)' : '2px solid transparent'
            }}>
              <span style={{ fontSize: 17 }}>{p.icon}</span>{p.label}
            </button>
          ))}
        </div>
      </nav>

      <button onClick={() => setChatOpen(true)} style={{
        position: 'fixed', right: 16, bottom: 76, zIndex: 20, background: 'var(--copper)', color: '#14100A',
        borderRadius: 99, padding: '12px 18px', fontWeight: 700, fontSize: 13.5,
        boxShadow: '0 6px 24px rgba(208,139,60,.35)', display: 'flex', alignItems: 'center', gap: 7
      }}>🎩 Directeur</button>

      {chatOpen && <Director restaurant={restaurant} onClose={() => setChatOpen(false)} />}

      <div className="toast-container">
        {toasts.map(t => <Toast key={t.id} msg={t.msg} type={t.type} />)}
      </div>

      {notifOpen && (
        <div style={{ position: 'fixed', top: 64, right: 16, width: 'min(360px,calc(100vw - 32px))', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, zIndex: 55, boxShadow: '0 16px 50px rgba(0,0,0,.5)', animation: 'pop .15s ease' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', fontWeight: 600, fontSize: 13.5, display: 'flex', justifyContent: 'space-between' }}>
            <span>Notifications</span><button onClick={() => setNotifOpen(false)} style={{ color: 'var(--muted)' }}>✕</button>
          </div>
          {[
            { icon: '🌡️', t: 'Chambre froide en dérive', s: '5,1 °C — voir le copilote', fn: () => { go('copilote'); setNotifOpen(false) } },
            { icon: '⭐', t: '2 avis sans réponse', s: 'dont un 2★ posté il y a 2h', fn: () => { go('avis'); setNotifOpen(false) } },
            { icon: '📦', t: 'Alerte stock — 3 produits', s: 'Crème fraîche, saumon, champignons', fn: () => { go('stocks'); setNotifOpen(false) } },
          ].map((n, i) => (
            <button key={i} onClick={n.fn} style={{ display: 'flex', gap: 10, padding: '12px 16px', borderBottom: '1px dashed var(--line)', width: '100%', textAlign: 'left', cursor: 'pointer' }}>
              <span>{n.icon}</span>
              <div><div style={{ fontWeight: 600, fontSize: 13 }}>{n.t}</div><div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>{n.s}</div></div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PrevisionView({ restaurant }) {
  const [forecasts, setForecasts] = useState([])
  useEffect(() => {
    supabase.from('forecasts').select('*').eq('restaurant_id', restaurant.id).eq('forecast_type', 'revenue')
      .gte('forecast_date', new Date().toISOString().split('T')[0]).order('forecast_date').limit(7)
      .then(({ data }) => setForecasts(data || []))
  }, [])
  const max = Math.max(...forecasts.map(f => f.predicted_value || 0), 1)
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 150, padding: '6px 2px 0' }}>
        {forecasts.map((f, i) => {
          const h = Math.round((f.predicted_value / max) * 100)
          const isHot = f.predicted_value > max * 0.8
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, justifyContent: 'flex-end', height: '100%' }}>
              <span style={{ fontSize: 10.5, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{(f.predicted_value / 1000).toFixed(1)} k€</span>
              <div style={{ width: '100%', height: `${h}%`, borderRadius: '7px 7px 3px 3px', background: isHot ? 'linear-gradient(180deg,var(--copper),#8F5E27)' : 'linear-gradient(180deg,#3E6B4E,#2C4A38)' }} />
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(f.forecast_date).toLocaleDateString('fr-FR', { weekday: 'short' })}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HaccpView({ restaurant, toast }) {
  const [sensors, setSensors] = useState([])
  const [checks, setChecks] = useState([
    { n: 'Relevé des enceintes froides', ph: 'auto (sondes) ✓', ok: true },
    { n: 'Nettoyage plan de travail', ph: 'photo 7h42 ✓', ok: true },
    { n: 'Contrôle des DLC en réserve', ph: 'photo requise', ok: false },
    { n: 'Température à réception livraison', ph: 'saisie requise', ok: false },
    { n: 'Nettoyage sols & poubelles', ph: 'photo requise', ok: false },
  ])

  useEffect(() => {
    supabase.from('haccp_sensors').select('*').eq('restaurant_id', restaurant.id)
      .then(({ data }) => setSensors(data || []))
  }, [])

  function tick(i) {
    setChecks(c => c.map((item, idx) => idx === i ? { ...item, ok: true, ph: 'photo ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ' ✓' } : item))
    toast('Preuve photo horodatée enregistrée ✓')
  }

  const done = checks.filter(c => c.ok).length
  const score = Math.round(88 + done * 2.4)

  return (
    <div className="animate-pop">
      <h2 style={{ fontFamily: "'Fraunces',serif", fontWeight: 650, fontSize: 19, margin: '0 0 14px' }}>HACCP <span style={{ color: 'var(--muted)', fontSize: 12.5, fontFamily: 'Inter', fontWeight: 500, marginLeft: 8 }}>relevés automatiques · registre légal</span></h2>
      <div className="card" style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <svg width="74" height="74" viewBox="0 0 74 74">
            <circle cx="37" cy="37" r="30" fill="none" stroke="var(--surface3)" strokeWidth="7" />
            <circle cx="37" cy="37" r="30" fill="none" stroke="var(--green)" strokeWidth="7" strokeLinecap="round"
              strokeDasharray="188.5" strokeDashoffset={188.5 * (1 - score / 100)} transform="rotate(-90 37 37)"
              style={{ transition: 'stroke-dashoffset .8s ease' }} />
            <text x="37" y="42" textAnchor="middle" fill="var(--ink)" fontWeight="700" fontSize="16" fontFamily="Inter">{score} %</text>
          </svg>
          <div>
            <div style={{ fontWeight: 600 }}>Score de conformité</div>
            <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 4 }}>Check-list {done}/5 · Sondes actives : {sensors.length}</div>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => toast('Dossier d\'audit exporté — PDF prêt pour la DDPP ✓')}>
              📄 Exporter le dossier d'audit
            </button>
          </div>
        </div>
      </div>
      {sensors.length > 0 && (
        <div className="card" style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Sondes <span style={{ color: 'var(--muted)', fontSize: 12 }}>(depuis Supabase)</span></div>
          {sensors.map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--line)', fontSize: 13.5 }}>
              <div><div style={{ fontWeight: 600 }}>{s.name}</div><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{s.min_temp}°C à {s.max_temp}°C autorisé</div></div>
              <span className="pill pill-green">Active</span>
            </div>
          ))}
        </div>
      )}
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Check-list d'ouverture <span style={{ color: 'var(--muted)', fontSize: 12 }}>{done}/5</span></div>
        {checks.map((c, i) => (
          <button key={i} onClick={() => !c.ok && tick(i)} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px dashed var(--line)',
            width: '100%', textAlign: 'left', cursor: c.ok ? 'default' : 'pointer', opacity: 1
          }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${c.ok ? 'var(--green)' : 'var(--line)'}`, background: c.ok ? 'var(--green)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0, color: '#0C1710', transition: 'all .15s' }}>
              {c.ok ? '✓' : ''}
            </div>
            <span style={{ flex: 1, fontSize: 13.5, color: c.ok ? 'var(--muted)' : 'var(--ink)', textDecoration: c.ok ? 'line-through' : 'none' }}>{c.n}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{c.ph}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function ExportsPage({ exportPlanningExcel, exportPlanningPDF, exportPnlExcel, exportPnlPDF, exportFoodCostExcel, exportFoodCostPDF, exportHaccpPDF }) {
  const sections = [
    {
      title: '📅 Planning',
      desc: 'Planning hebdomadaire de l\'équipe avec horaires et coûts',
      actions: [
        { label: '📊 Excel (.csv)', fn: exportPlanningExcel },
        { label: '📄 PDF', fn: exportPlanningPDF },
      ]
    },
    {
      title: '💶 Compte de résultat (P&L)',
      desc: 'P&L quotidien sur 30 jours — CA, food cost, EBITDA',
      actions: [
        { label: '📊 Excel (.csv)', fn: exportPnlExcel },
        { label: '📄 PDF', fn: exportPnlPDF },
      ]
    },
    {
      title: '🧾 Food Cost & Fiches techniques',
      desc: 'Marges par plat, menu engineering, alertes',
      actions: [
        { label: '📊 Excel (.csv)', fn: exportFoodCostExcel },
        { label: '📄 PDF', fn: exportFoodCostPDF },
      ]
    },
    {
      title: '🌡️ Registre HACCP',
      desc: 'Relevés de température, check-lists, dossier d\'audit DDPP',
      actions: [
        { label: '📄 PDF complet', fn: exportHaccpPDF },
      ]
    },
  ]

  return (
    <div>
      {sections.map(s => (
        <div key={s.title} className="card" style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{s.title}</div>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>{s.desc}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {s.actions.map(a => (
              <button key={a.label} className="btn btn-ghost btn-sm" onClick={a.fn}>{a.label}</button>
            ))}
          </div>
        </div>
      ))}
      <div className="card" style={{ background: 'var(--surface2)', border: '1px solid var(--copper)' }}>
        <div style={{ fontWeight: 600, color: 'var(--copper)', marginBottom: 6 }}>💡 Comment ça marche</div>
        <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
          Les exports <b style={{ color: 'var(--ink)' }}>Excel (.csv)</b> s'ouvrent directement dans Excel ou Numbers — importez-les dans votre comptabilité ou envoyez-les à votre expert-comptable.<br />
          Les exports <b style={{ color: 'var(--ink)' }}>PDF</b> utilisent l'impression de votre navigateur — sauvegardez en PDF ou imprimez directement.
        </div>
      </div>
    </div>
  )
}
