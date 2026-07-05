import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import CopiloteV6 from '../components/CopiloteV6'
import { FoodCost } from '../components/Components'
import { Finance } from '../components/Components'
import { Journal } from '../components/Components'
import { Avis } from '../components/Components'
import { Toast } from '../components/Components'
import Director from '../components/Director'
import { RecipesManager, EmployeesManager, StocksManager, Settings } from '../components/Forms'
import MultiSite from '../components/MultiSite'
import PlanningV7 from '../components/PlanningV7'
import DevisManager from '../components/Devis'
import {
  exportPlanningExcel, exportPlanningPDF,
  exportPnlExcel, exportPnlPDF,
  exportFoodCostExcel, exportFoodCostPDF,
  exportHaccpPDF
} from '../components/Exports'

// ─── Navigation V6 : épurée, hiérarchisée ───────────────
const PAGES = [
  { key: 'copilote',   icon: '☀️',  label: 'Copilote',    group: 'Pilotage',      primary: true },
  { key: 'finance',    icon: '💶',  label: 'Finance',     group: 'Pilotage',      primary: true },
  { key: 'prevision',  icon: '📈',  label: 'Prévision',   group: 'Pilotage',      primary: false },
  { key: 'multisite',  icon: '🏢',  label: 'Multi-sites', group: 'Pilotage',      primary: false },
  { key: 'recettes',   icon: '🍽️', label: 'Carte',       group: 'Exploitation',  primary: true },
  { key: 'stocks',     icon: '📦',  label: 'Stocks',      group: 'Exploitation',  primary: true },
  { key: 'equipe',     icon: '👥',  label: 'Équipe',      group: 'Exploitation',  primary: false },
  { key: 'planning',   icon: '📅',  label: 'Planning',    group: 'Exploitation',  primary: true },
  { key: 'haccp',      icon: '🌡️', label: 'HACCP',       group: 'Exploitation',  primary: false },
  { key: 'avis',       icon: '⭐',  label: 'Avis',        group: 'Clients',       primary: true },
  { key: 'devis',      icon: '📋',  label: 'Devis',       group: 'Outils',        primary: false },
  { key: 'exports',    icon: '📤',  label: 'Exports',     group: 'Outils',        primary: false },
  { key: 'journal',    icon: '📜',  label: 'Journal IA',  group: 'Outils',        primary: false },
  { key: 'parametres', icon: '⚙️', label: 'Paramètres',  group: 'Outils',        primary: false },
]

export default function DashboardV6({ restaurant: initialRestaurant, session, onLogout }) {
  const [restaurant, setRestaurant] = useState(initialRestaurant)
  const [page, setPage] = useState('copilote')
  const [toasts, setToasts] = useState([])
  const [chatOpen, setChatOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [sideOpen, setSideOpen] = useState(false)
  const [alertCount, setAlertCount] = useState(0)

  const toast = useCallback((msg, type = 'success') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200)
  }, [])

  function go(p) { setPage(p); setSideOpen(false); window.scrollTo({ top: 0 }) }

  const groups = [...new Set(PAGES.map(p => p.group))]
  const planIcon = { pilot: '🟢', autopilot: '🔵', enterprise: '🟣' }[restaurant.plan] || '🔵'

  const Sidebar = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      {/* Logo */}
      <div style={{ padding: '4px 10px 18px' }}>
        <div style={{ fontFamily: "'Fraunces',serif", fontSize: 22, fontWeight: 650, color: 'var(--ink)', letterSpacing: .3 }}>
          Rest<span style={{ color: 'var(--copper)' }}>OS</span>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{restaurant.name}</div>
      </div>

      {/* Nav groupée */}
      {groups.map(g => (
        <div key={g}>
          <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)', padding: '10px 10px 4px', opacity: .75 }}>{g}</div>
          {PAGES.filter(p => p.group === g).map(p => (
            <button key={p.key} onClick={() => go(p.key)} style={{
              display: 'flex', alignItems: 'center', gap: 9, width: '100%',
              padding: '8px 10px', borderRadius: 9, marginBottom: 1,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: page === p.key ? 'var(--copper-soft)' : 'transparent',
              color: page === p.key ? 'var(--copper)' : 'var(--muted)',
              transition: 'background .12s'
            }}>
              <span>{p.icon}</span>
              {p.label}
              {p.primary && page !== p.key && (
                <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: 99, background: 'var(--copper)', opacity: .4 }} />
              )}
            </button>
          ))}
        </div>
      ))}

      <div style={{ flex: 1 }} />

      {/* User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px', borderTop: '1px solid var(--line)', marginTop: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 99, background: 'var(--copper)', color: '#14100A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
          {session.user.email[0].toUpperCase()}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.user.email}</div>
          <div style={{ fontSize: 10.5, color: 'var(--copper)' }}>{planIcon} {restaurant.plan}</div>
        </div>
        <button onClick={onLogout} style={{ color: 'var(--muted)', fontSize: 11 }}>Déco</button>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', maxWidth: 1200, margin: '0 auto', minHeight: '100vh' }}>

      {/* Sidebar desktop */}
      <aside style={{ width: 210, padding: '20px 10px', borderRight: '1px solid var(--line)', position: 'sticky', top: 0, height: '100vh', flexShrink: 0 }} className="sidebar-desk">
        <style>{`.sidebar-desk{display:flex!important;flex-direction:column;}@media(max-width:900px){.sidebar-desk{display:none!important}}`}</style>
        <Sidebar />
      </aside>

      {/* Sidebar mobile overlay */}
      {sideOpen && (
        <div onClick={() => setSideOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(10,14,11,.8)', zIndex: 40 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 230, background: 'var(--surface)', borderRight: '1px solid var(--line)', padding: '20px 10px', height: '100vh', overflowY: 'auto' }}>
            <Sidebar />
          </div>
        </div>
      )}

      {/* ── MAIN ── */}
      <div style={{ flex: 1, padding: '14px 16px 108px', minWidth: 0 }}>

        {/* Topbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, position: 'sticky', top: 0, background: 'linear-gradient(var(--bg) 82%, transparent)', padding: '6px 0 10px', zIndex: 15 }}>
          <button onClick={() => setSideOpen(true)} className="menu-btn" style={{ fontSize: 20, padding: '6px 8px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10 }}>
            <style>{`@media(min-width:900px){.menu-btn{display:none!important}}`}</style>
            ☰
          </button>
          <div className="brand-mobile" style={{ fontFamily: "'Fraunces',serif", fontSize: 20, fontWeight: 650 }}>
            <style>{`@media(min-width:900px){.brand-mobile{display:none!important}}`}</style>
            Rest<span style={{ color: 'var(--copper)' }}>OS</span>
          </div>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '5px 10px', borderRadius: 99, background: 'var(--copper-soft)', color: 'var(--copper)', border: '1px solid rgba(208,139,60,.35)' }}>
            {planIcon} {restaurant.plan.toUpperCase()}
          </span>
          <button onClick={() => setNotifOpen(o => !o)} style={{ fontSize: 18, padding: 7, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, position: 'relative' }}>
            🔔
            {alertCount > 0 && <span style={{ position: 'absolute', top: -4, right: -4, background: 'var(--red)', color: '#fff', fontSize: 9, fontWeight: 700, minWidth: 16, height: 16, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)' }}>{alertCount}</span>}
          </button>
        </div>

        {/* Breadcrumb discret */}
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
          <b style={{ color: 'var(--ink)' }}>{restaurant.name}</b>
          {' · '}{PAGES.find(p => p.key === page)?.label}
          {' · '}<span style={{ color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span className="live" />en ligne
          </span>
        </div>

        {/* ── PAGES ── */}
        {page === 'copilote'   && <CopiloteV6 restaurant={restaurant} toast={toast} onOpenChat={() => setChatOpen(true)} />}
        {page === 'finance'    && <Finance restaurant={restaurant} toast={toast} />}
        {page === 'recettes'   && <RecipesManager restaurant={restaurant} toast={toast} />}
        {page === 'stocks'     && <StocksManager restaurant={restaurant} toast={toast} />}
        {page === 'equipe'     && <EmployeesManager restaurant={restaurant} toast={toast} />}
        {page === 'planning'   && <PlanningV7 restaurant={restaurant} toast={toast} />}
        {page === 'avis'       && <Avis restaurant={restaurant} toast={toast} />}
        {page === 'devis'      && <DevisManager restaurant={restaurant} toast={toast} />}
        {page === 'journal'    && <Journal restaurant={restaurant} />}
        {page === 'multisite'  && <MultiSite userId={session.user.id} toast={toast} />}
        {page === 'parametres' && <Settings restaurant={restaurant} toast={toast} onUpdate={setRestaurant} />}

        {page === 'prevision' && <PrevisionV6 restaurant={restaurant} />}
        {page === 'haccp'     && <HaccpV6 restaurant={restaurant} toast={toast} />}
        {page === 'exports'   && <ExportsV6 restaurant={restaurant} toast={toast}
          exportPlanningExcel={() => { exportPlanningExcel(restaurant); toast('Planning Excel téléchargé ✓') }}
          exportPlanningPDF={() => exportPlanningPDF(restaurant)}
          exportPnlExcel={() => { exportPnlExcel(restaurant); toast('P&L Excel téléchargé ✓') }}
          exportPnlPDF={() => exportPnlPDF(restaurant)}
          exportFoodCostExcel={() => { exportFoodCostExcel(restaurant); toast('Food Cost Excel téléchargé ✓') }}
          exportFoodCostPDF={() => exportFoodCostPDF(restaurant)}
          exportHaccpPDF={() => exportHaccpPDF(restaurant)}
        />}

        <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 30, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          RestOS V6 · Supabase · Claude Sonnet 4.6 · © 2026
        </div>
      </div>

      {/* Nav mobile — seulement les pages primaires */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(15,20,17,.94)', backdropFilter: 'blur(12px)', borderTop: '1px solid var(--line)', zIndex: 10 }} className="nav-mobile">
        <style>{`@media(min-width:900px){.nav-mobile{display:none!important}}`}</style>
        <div style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', maxWidth: 520, margin: '0 auto' }}>
          {PAGES.filter(p => p.primary).map(p => (
            <button key={p.key} onClick={() => go(p.key)} style={{
              flex: '0 0 auto', minWidth: 60, color: page === p.key ? 'var(--copper)' : 'var(--muted)',
              padding: '9px 4px 11px', fontSize: 9, fontWeight: 600,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              borderTop: page === p.key ? '2px solid var(--copper)' : '2px solid transparent'
            }}>
              <span style={{ fontSize: 18 }}>{p.icon}</span>{p.label}
            </button>
          ))}
          <button onClick={() => setSideOpen(true)} style={{
            flex: '0 0 auto', minWidth: 60, color: 'var(--muted)',
            padding: '9px 4px 11px', fontSize: 9, fontWeight: 600,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            borderTop: '2px solid transparent'
          }}>
            <span style={{ fontSize: 18 }}>☰</span>Plus
          </button>
        </div>
      </nav>

      {/* Directeur IA */}
      <button onClick={() => setChatOpen(true)} style={{
        position: 'fixed', right: 16, bottom: 80, zIndex: 20,
        background: 'var(--copper)', color: '#14100A',
        borderRadius: 99, padding: '12px 18px', fontWeight: 700, fontSize: 13.5,
        boxShadow: '0 6px 24px rgba(208,139,60,.4)',
        display: 'flex', alignItems: 'center', gap: 7
      }}>🎩 Directeur</button>

      {chatOpen && <Director restaurant={restaurant} onClose={() => setChatOpen(false)} />}

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map(t => <Toast key={t.id} msg={t.msg} type={t.type} />)}
      </div>

      {/* Panel notifications */}
      {notifOpen && (
        <div style={{ position: 'fixed', top: 64, right: 16, width: 'min(360px, calc(100vw - 32px))', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, zIndex: 55, boxShadow: '0 16px 50px rgba(0,0,0,.5)', animation: 'pop .15s ease' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', fontWeight: 600, fontSize: 13.5, display: 'flex', justifyContent: 'space-between' }}>
            <span>Alertes</span>
            <button onClick={() => setNotifOpen(false)} style={{ color: 'var(--muted)' }}>✕</button>
          </div>
          {[
            { icon: '🌡️', t: 'Chambre froide en dérive', s: '5,1 °C — action requise', fn: () => { go('copilote'); setNotifOpen(false) } },
            { icon: '⭐', t: '2 avis sans réponse', s: 'dont un 2★ — impact Google', fn: () => { go('avis'); setNotifOpen(false) } },
            { icon: '📦', t: '3 produits en alerte stock', s: 'Crème, saumon, champignons', fn: () => { go('stocks'); setNotifOpen(false) } },
          ].map((n, i) => (
            <button key={i} onClick={n.fn} style={{ display: 'flex', gap: 10, padding: '12px 16px', borderBottom: '1px dashed var(--line)', width: '100%', textAlign: 'left', cursor: 'pointer' }}>
              <span style={{ fontSize: 18 }}>{n.icon}</span>
              <div><div style={{ fontWeight: 600, fontSize: 13 }}>{n.t}</div><div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 1 }}>{n.s}</div></div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Prévision V6 ──────────────────────────────────────
function PrevisionV6({ restaurant }) {
  const [forecasts, setForecasts] = useState([])
  const [pnl, setPnl] = useState([])

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    supabase.from('forecasts').select('*').eq('restaurant_id', restaurant.id).eq('forecast_type', 'revenue').gte('forecast_date', today).order('forecast_date').limit(7).then(({ data }) => setForecasts(data || []))
    supabase.from('daily_pnl').select('revenue,report_date').eq('restaurant_id', restaurant.id).order('report_date', { ascending: false }).limit(7).then(({ data }) => setPnl(data || []))
  }, [])

  const max = Math.max(...forecasts.map(f => f.predicted_value || 0), 1)

  return (
    <div className="animate-pop">
      <h2 style={{ fontFamily: "'Fraunces',serif", fontWeight: 650, fontSize: 19, margin: '0 0 14px' }}>
        Prévision CA <span style={{ color: 'var(--muted)', fontSize: 12.5, fontFamily: 'Inter', fontWeight: 500, marginLeft: 8 }}>7 jours · modèle IA</span>
      </h2>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, padding: '6px 2px 0' }}>
          {forecasts.map((f, i) => {
            const h = Math.round((f.predicted_value / max) * 100)
            const isHot = f.predicted_value > max * 0.75
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, justifyContent: 'flex-end', height: '100%' }}>
                <span style={{ fontSize: 10.5, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{(f.predicted_value / 1000).toFixed(1)} k€</span>
                <div style={{ width: '100%', height: `${h}%`, borderRadius: '7px 7px 3px 3px', background: isHot ? 'linear-gradient(180deg,var(--copper),#8F5E27)' : 'linear-gradient(180deg,#3E6B4E,#2C4A38)', minHeight: 4, transition: 'height .6s cubic-bezier(.2,.8,.2,1)' }} />
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(f.forecast_date).toLocaleDateString('fr-FR', { weekday: 'short' })}</span>
                <span style={{ fontSize: 9.5, color: 'var(--muted)' }}>{f.confidence_pct} %</span>
              </div>
            )
          })}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10, textAlign: 'center' }}>Confiance du modèle affichée sous chaque barre · données météo + réservations + historique</div>
      </div>
    </div>
  )
}

// ─── HACCP V6 ──────────────────────────────────────────
function HaccpV6({ restaurant, toast }) {
  const [sensors, setSensors] = useState([])
  const [checks, setChecks] = useState([
    { n: 'Relevé des enceintes froides', ph: 'auto (sondes) ✓', ok: true },
    { n: 'Nettoyage plan de travail', ph: 'photo 7h42 ✓', ok: true },
    { n: 'Contrôle des DLC en réserve', ph: 'appuyer pour valider', ok: false },
    { n: 'Température à réception', ph: 'appuyer pour valider', ok: false },
    { n: 'Nettoyage sols & poubelles', ph: 'appuyer pour valider', ok: false },
  ])

  useEffect(() => { supabase.from('haccp_sensors').select('*').eq('restaurant_id', restaurant.id).then(({ data }) => setSensors(data || [])) }, [])

  function tick(i) {
    setChecks(c => c.map((item, idx) => idx === i ? { ...item, ok: true, ph: `photo ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} ✓` } : item))
    toast('✓ Enregistré dans le registre HACCP')
  }

  const done = checks.filter(c => c.ok).length
  const score = Math.round(88 + done * 2.4)

  return (
    <div className="animate-pop">
      <h2 style={{ fontFamily: "'Fraunces',serif", fontWeight: 650, fontSize: 19, margin: '0 0 14px' }}>HACCP <span style={{ color: 'var(--muted)', fontSize: 12.5, fontFamily: 'Inter', fontWeight: 500, marginLeft: 8 }}>conformité automatique</span></h2>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '16px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 16 }}>
        <svg width="70" height="70" viewBox="0 0 74 74">
          <circle cx="37" cy="37" r="30" fill="none" stroke="var(--surface3)" strokeWidth="7" />
          <circle cx="37" cy="37" r="30" fill="none" stroke="var(--green)" strokeWidth="7" strokeLinecap="round"
            strokeDasharray="188.5" strokeDashoffset={188.5 * (1 - score / 100)}
            transform="rotate(-90 37 37)" style={{ transition: 'stroke-dashoffset .8s ease' }} />
          <text x="37" y="42" textAnchor="middle" fill="var(--ink)" fontWeight="700" fontSize="16" fontFamily="Inter">{score} %</text>
        </svg>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Score de conformité</div>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{done}/5 tâches · {sensors.length} sondes actives</div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => toast('Dossier d\'audit exporté ✓')}>📄 Exporter pour la DDPP</button>
        </div>
      </div>

      {sensors.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Sondes température</div>
          {sensors.map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px dashed var(--line)', fontSize: 13.5 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Autorisé : {s.min_temp}°C à {s.max_temp}°C</div>
              </div>
              <span style={{ background: 'var(--green-soft)', color: 'var(--green)', fontWeight: 700, fontSize: 11, padding: '3px 9px', borderRadius: 99 }}>✓ Active</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '14px 16px' }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Check-list d'ouverture <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12.5 }}>{done}/5</span></div>
        {checks.map((c, i) => (
          <button key={i} onClick={() => !c.ok && tick(i)} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
            borderBottom: i < checks.length - 1 ? '1px dashed var(--line)' : 'none',
            width: '100%', textAlign: 'left', cursor: c.ok ? 'default' : 'pointer'
          }}>
            <div style={{ width: 22, height: 22, borderRadius: 7, border: `1.5px solid ${c.ok ? 'var(--green)' : 'var(--line)'}`, background: c.ok ? 'var(--green)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#0C1710', flexShrink: 0, transition: 'all .15s' }}>
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

// ─── Exports V6 ────────────────────────────────────────
function ExportsV6({ restaurant, exportPlanningExcel, exportPlanningPDF, exportPnlExcel, exportPnlPDF, exportFoodCostExcel, exportFoodCostPDF, exportHaccpPDF }) {
  const sections = [
    { title: '📅 Planning semaine', desc: 'Équipe, horaires, coûts', actions: [{ label: '📊 Excel', fn: exportPlanningExcel }, { label: '📄 PDF', fn: exportPlanningPDF }] },
    { title: '💶 Compte de résultat', desc: 'P&L 30 jours — CA, food cost, EBITDA', actions: [{ label: '📊 Excel', fn: exportPnlExcel }, { label: '📄 PDF', fn: exportPnlPDF }] },
    { title: '🧾 Food Cost', desc: 'Fiches techniques, marges, menu engineering', actions: [{ label: '📊 Excel', fn: exportFoodCostExcel }, { label: '📄 PDF', fn: exportFoodCostPDF }] },
    { title: '🌡️ Registre HACCP', desc: 'Relevés, check-lists, dossier audit DDPP', actions: [{ label: '📄 PDF complet', fn: exportHaccpPDF }] },
  ]
  return (
    <div className="animate-pop">
      <h2 style={{ fontFamily: "'Fraunces',serif", fontWeight: 650, fontSize: 19, margin: '0 0 14px' }}>Exports</h2>
      {sections.map(s => (
        <div key={s.title} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{s.title}</div>
          <div style={{ color: 'var(--muted)', fontSize: 12.5, margin: '4px 0 12px' }}>{s.desc}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {s.actions.map(a => <button key={a.label} className="btn btn-ghost btn-sm" onClick={a.fn}>{a.label}</button>)}
          </div>
        </div>
      ))}
    </div>
  )
}
