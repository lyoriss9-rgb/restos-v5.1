import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import CopiloteV9 from '../components/CopiloteV9'
import MultiSiteV9 from '../components/MultiSiteV9'
import PlanningV9 from '../components/PlanningV9'
import { RecipesManager, EmployeesManager, StocksManager, Settings } from '../components/Forms'
import { Avis, Finance, Journal, Toast } from '../components/Components'
import Director from '../components/Director'
import ProfitOptimizer from '../components/ProfitOptimizer'
import DevisManager from '../components/Devis'
import { exportPlanningPDF, exportPlanningExcel, exportPnlPDF, exportPnlExcel, exportFoodCostPDF, exportFoodCostExcel, exportHaccpPDF } from '../components/Exports'

const NAV = [
  { key:'copilote',  icon:'◈', label:'Copilote',    section:'Pilotage' },
  { key:'multisite', icon:'⬡', label:'Multi-sites', section:'Pilotage' },
  { key:'finance',   icon:'◎', label:'Finance',      section:'Pilotage' },
  { key:'profit',    icon:'◇', label:'Profit',       section:'Pilotage' },
  { key:'carte',     icon:'▤', label:'Carte',        section:'Exploitation' },
  { key:'planning',  icon:'▦', label:'Planning',     section:'Exploitation' },
  { key:'equipe',    icon:'◉', label:'Équipe',       section:'Exploitation' },
  { key:'stocks',    icon:'◫', label:'Stocks',       section:'Exploitation' },
  { key:'avis',      icon:'◈', label:'Avis',         section:'Clients' },
  { key:'devis',     icon:'▭', label:'Devis',        section:'Outils' },
  { key:'exports',   icon:'↗', label:'Exports',      section:'Outils' },
  { key:'journal',   icon:'≡', label:'Journal IA',   section:'Outils' },
  { key:'settings',  icon:'◌', label:'Paramètres',   section:'Outils' },
]

export default function DashboardV9({ restaurant: init, session, onLogout }) {
  const [restaurant, setRestaurant] = useState(init)
  const [page, setPage] = useState('copilote')
  const [toasts, setToasts] = useState([])
  const [chatOpen, setChatOpen] = useState(false)
  const [sideOpen, setSideOpen] = useState(false)
  const [sites, setSites] = useState([])

  const toast = useCallback((msg, type='ok') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])

  useEffect(() => {
    supabase.from('restaurant_members').select('role, restaurants(*)').eq('user_id', session.user.id).eq('is_active', true)
      .then(({ data }) => setSites((data || []).map(d => ({ ...d.restaurants, role: d.role }))))
  }, [])

  function go(p) { setPage(p); setSideOpen(false); window.scrollTo({ top: 0 }) }
  const sections = [...new Set(NAV.map(n => n.section))]

  const Sidebar = () => (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ padding:'0 10px 24px' }}>
        <div style={{ fontSize:20, fontWeight:800, letterSpacing:'-0.04em' }}>Rest<span style={{ color:'var(--gold)' }}>OS</span></div>
        <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>v9 · {restaurant.plan}</div>
      </div>

      {sites.length > 1 && (
        <div style={{ marginBottom:14 }}>
          <div className="sidebar-section">Sites</div>
          {sites.map(s => (
            <button key={s.id} onClick={() => setRestaurant(s)} className="sidebar-item" style={{ width:'100%', background: restaurant.id===s.id ? 'var(--gold-bg)' : 'transparent', color: restaurant.id===s.id ? 'var(--gold)' : 'var(--t3)', border:`1px solid ${restaurant.id===s.id ? 'var(--gold-bd)' : 'transparent'}`, fontSize:12 }}>
              <span style={{ width:7, height:7, borderRadius:99, background: restaurant.id===s.id ? 'var(--gold)' : 'var(--b2)', flexShrink:0, display:'inline-block' }} />
              {s.name}
            </button>
          ))}
          <div style={{ margin:'12px 0 2px', borderTop:'1px solid var(--b1)' }} />
        </div>
      )}

      {sections.map(sec => (
        <div key={sec}>
          <div className="sidebar-section">{sec}</div>
          {NAV.filter(n => n.section===sec).map(n => (
            <button key={n.key} onClick={() => go(n.key)} className={`sidebar-item ${page===n.key?'active':''}`} style={{ width:'100%' }}>
              <span style={{ fontSize:13, width:18, textAlign:'center' }}>{n.icon}</span>{n.label}
            </button>
          ))}
        </div>
      ))}

      <div style={{ flex:1 }} />
      <div style={{ padding:'12px 8px', borderTop:'1px solid var(--b1)', display:'flex', alignItems:'center', gap:10, marginTop:12 }}>
        <div style={{ width:28, height:28, borderRadius:99, background:'var(--gold)', color:'#0A0800', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:11, flexShrink:0 }}>
          {session.user.email[0].toUpperCase()}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:11, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--t2)' }}>{session.user.email}</div>
        </div>
        <button onClick={onLogout} style={{ fontSize:11, color:'var(--t3)', cursor:'pointer', padding:'4px 8px', borderRadius:6, border:'1px solid var(--b1)', background:'transparent' }}>←</button>
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh', maxWidth:1280, margin:'0 auto' }}>
      <style>{`
        .desk{display:flex!important;flex-direction:column;}
        @media(max-width:900px){.desk{display:none!important}}
        @media(min-width:900px){.mob{display:none!important}}
      `}</style>

      <aside className="desk" style={{ width:215, padding:'24px 12px', borderRight:'1px solid var(--b1)', position:'sticky', top:0, height:'100vh', overflowY:'auto', flexShrink:0 }}>
        <Sidebar />
      </aside>

      {sideOpen && (
        <div onClick={() => setSideOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:40, backdropFilter:'blur(5px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ width:230, background:'var(--s1)', borderRight:'1px solid var(--b1)', height:'100vh', overflowY:'auto', padding:'20px 12px' }}>
            <Sidebar />
          </div>
        </div>
      )}

      <main style={{ flex:1, padding:'20px 20px 100px', minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24, position:'sticky', top:0, background:'linear-gradient(var(--bg) 82%, transparent)', padding:'4px 0 14px', zIndex:20 }}>
          <button className="mob btn btn-ghost btn-sm" onClick={() => setSideOpen(true)}>☰</button>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, color:'var(--t3)' }}>{restaurant.name}</div>
            <div style={{ fontSize:17, fontWeight:700, letterSpacing:'-0.02em', marginTop:1 }}>{NAV.find(n=>n.key===page)?.label}</div>
          </div>
          <span className="badge badge-gold">{restaurant.plan?.toUpperCase()}</span>
          <button onClick={() => setChatOpen(true)} style={{ background:'var(--gold)', color:'#0A0800', borderRadius:99, padding:'8px 16px', fontWeight:700, fontSize:13, cursor:'pointer', border:'none', display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}>
            ✦ Directeur
          </button>
        </div>

        <div className="anim-up" key={page}>
          {page==='copilote'  && <CopiloteV9 restaurant={restaurant} toast={toast} onOpenChat={() => setChatOpen(true)} />}
          {page==='multisite' && <MultiSiteV9 userId={session.user.id} toast={toast} sites={sites} />}
          {page==='finance'   && <Finance restaurant={restaurant} toast={toast} />}
          {page==='profit'    && <ProfitOptimizer toast={toast} />}
          {page==='carte'     && <RecipesManager restaurant={restaurant} toast={toast} />}
          {page==='planning'  && <PlanningV9 restaurant={restaurant} toast={toast} sites={sites} />}
          {page==='equipe'    && <EmployeesManager restaurant={restaurant} toast={toast} />}
          {page==='stocks'    && <StocksManager restaurant={restaurant} toast={toast} />}
          {page==='avis'      && <Avis restaurant={restaurant} toast={toast} />}
          {page==='devis'     && <DevisManager restaurant={restaurant} toast={toast} />}
          {page==='journal'   && <Journal restaurant={restaurant} />}
          {page==='settings'  && <Settings restaurant={restaurant} toast={toast} onUpdate={setRestaurant} />}
          {page==='exports'   && (
            <div>
              <div style={{ marginBottom:20 }}>
                <div className="title">Exports</div>
                <div className="body" style={{ marginTop:4 }}>Documents prêts — comptable, direction, DDPP.</div>
              </div>
              {[
                { t:'Planning semaine', d:'Horaires, effectifs, masse salariale', a:[{l:'PDF',f:()=>exportPlanningPDF(restaurant)},{l:'Excel',f:()=>{exportPlanningExcel(restaurant);toast('Planning Excel ✓')}}] },
                { t:'Compte de résultat', d:'P&L 30 jours', a:[{l:'PDF',f:()=>exportPnlPDF(restaurant)},{l:'Excel',f:()=>{exportPnlExcel(restaurant);toast('P&L Excel ✓')}}] },
                { t:'Food cost', d:'Marges par plat, menu engineering', a:[{l:'PDF',f:()=>exportFoodCostPDF(restaurant)},{l:'Excel',f:()=>{exportFoodCostExcel(restaurant);toast('Food cost Excel ✓')}}] },
                { t:'Registre HACCP', d:'Températures, check-lists, audit', a:[{l:'PDF',f:()=>exportHaccpPDF(restaurant)}] },
              ].map(s => (
                <div key={s.t} className="card" style={{ marginBottom:10, display:'flex', alignItems:'center', gap:16, padding:'14px 18px' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600 }}>{s.t}</div>
                    <div style={{ fontSize:12, color:'var(--t3)', marginTop:2 }}>{s.d}</div>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>{s.a.map(a => <button key={a.l} className="btn btn-ghost btn-sm" onClick={a.f}>{a.l}</button>)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <nav className="mob" style={{ position:'fixed', bottom:0, left:0, right:0, background:'rgba(9,9,11,.94)', backdropFilter:'blur(16px)', borderTop:'1px solid var(--b1)', zIndex:10 }}>
        <div style={{ display:'flex', overflowX:'auto', scrollbarWidth:'none' }}>
          {['copilote','multisite','planning','carte','avis'].map(k => {
            const n = NAV.find(x=>x.key===k)
            return (
              <button key={k} onClick={() => go(k)} style={{ flex:'0 0 auto', minWidth:64, padding:'9px 4px 11px', fontSize:9, fontWeight:600, display:'flex', flexDirection:'column', alignItems:'center', gap:3, color: page===k ? 'var(--gold)' : 'var(--t3)', borderTop: page===k ? '2px solid var(--gold)' : '2px solid transparent', cursor:'pointer' }}>
                <span style={{ fontSize:17 }}>{n?.icon}</span>{n?.label}
              </button>
            )
          })}
          <button onClick={() => setSideOpen(true)} style={{ flex:'0 0 auto', minWidth:64, padding:'9px 4px 11px', fontSize:9, fontWeight:600, display:'flex', flexDirection:'column', alignItems:'center', gap:3, color:'var(--t3)', borderTop:'2px solid transparent', cursor:'pointer' }}>
            <span style={{ fontSize:17 }}>≡</span>Plus
          </button>
        </div>
      </nav>

      {chatOpen && <Director restaurant={restaurant} onClose={() => setChatOpen(false)} />}
      <div className="toast-wrap">{toasts.map(t => <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>
    </div>
  )
}
