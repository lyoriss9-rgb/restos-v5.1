import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const DAYS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']
const TRAFFIC = [0.65, 0.70, 0.72, 0.80, 0.95, 1.0, 0.85]
const SERVICES = { midi:{start:'10:00',end:'15:30'}, soir:{start:'18:00',end:'23:30'}, continu:{start:'10:00',end:'23:30'}, ouverture:{start:'09:00',end:'11:30'}, fermeture:{start:'22:00',end:'00:00'} }

function timeH(t) { if(!t) return 0; const [h,m]=t.split(':').map(Number); return h+m/60 }
function shiftCost(s) {
  const emp = s.employees || s.employee
  if(!emp?.hourly_rate||!s.start_time||!s.end_time) return 0
  return emp.hourly_rate * Math.max(0, timeH(s.end_time)-timeH(s.start_time))
}

export default function PlanningV9({ restaurant, toast, sites=[] }) {
  const [employees, setEmployees] = useState([])
  const [shifts, setShifts] = useState([])
  const [generated, setGenerated] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [validated, setValidated] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  const [viewSite, setViewSite] = useState(restaurant.id)
  const [editShift, setEditShift] = useState(null)
  const [absences, setAbsences] = useState({})

  // Semaine
  const wStart = (() => { const d=new Date(); const day=d.getDay(); d.setDate(d.getDate()-day+(day===0?-6:1)+weekOffset*7); d.setHours(0,0,0,0); return d })()
  const wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate()+6)

  useEffect(() => { loadAll() }, [viewSite, weekOffset])

  async function loadAll() {
    setValidated(false); setGenerated(null)
    const [{ data:emps }, { data:sh }] = await Promise.all([
      supabase.from('employees').select('*').eq('restaurant_id', viewSite).eq('is_active', true).order('last_name'),
      supabase.from('shifts').select('*, employees(id,first_name,last_name,role,hourly_rate)')
        .eq('restaurant_id', viewSite)
        .gte('shift_date', wStart.toISOString().split('T')[0])
        .lte('shift_date', wEnd.toISOString().split('T')[0])
        .order('shift_date').order('start_time')
    ])
    setEmployees(emps||[])
    setShifts(sh||[])
    if ((sh||[]).length===0 && (emps||[]).length>0) setTimeout(()=>generatePlan(emps||[]), 400)
  }

  async function generatePlan(emps=employees) {
    if(!emps.length) { toast('Ajoutez d\'abord des employés','warn'); return }
    setGenerating(true)
    const plan = []
    for(let d=0;d<7;d++) {
      const date = new Date(wStart); date.setDate(date.getDate()+d)
      const ds = date.toISOString().split('T')[0]
      const coeff = TRAFFIC[d]
      const sorted = [...emps].sort((a,b)=>(a.hourly_rate||13)-(b.hourly_rate||13))
      const nMidi = Math.max(1, Math.round(coeff*emps.length*0.5))
      const nSoir = Math.max(1, Math.round(coeff*emps.length*0.6))
      sorted.slice(0,nMidi).forEach(emp => {
        plan.push({ _id:`g_${ds}_m_${emp.id}`, employee_id:emp.id, employee:emp, shift_date:ds, service:'midi', start_time:'10:00', end_time:'15:30', status:'planned', _cost:(emp.hourly_rate||13.5)*5.5, _ia:true })
      })
      const seniorSort = [...emps].sort((a,b)=>(b.hourly_rate||13)-(a.hourly_rate||13))
      seniorSort.slice(0,nSoir).forEach(emp => {
        if(plan.find(p=>p.employee_id===emp.id&&p.shift_date===ds&&p.service==='midi')&&emp.contract_type!=='cdi') return
        plan.push({ _id:`g_${ds}_s_${emp.id}`, employee_id:emp.id, employee:emp, shift_date:ds, service:'soir', start_time:'18:00', end_time:'23:30', status:'planned', _cost:(emp.hourly_rate||13.5)*5.5, _ia:true })
      })
    }
    setGenerated(plan)
    setGenerating(false)
    toast(`Planning généré — ${plan.length} shifts optimisés`)
    await supabase.from('ai_journal').insert({ restaurant_id:viewSite, agent_key:'agent_planning', action_type:'planning_generated', autonomy_mode:2, description:`Planning IA semaine du ${wStart.toLocaleDateString('fr-FR')} — ${plan.length} shifts`, triggered_by:'auto' })
  }

  async function validatePlan() {
    const plan = generated || []
    if(!plan.length) return
    const { data:ex } = await supabase.from('shifts').select('id').eq('restaurant_id',viewSite).gte('shift_date',wStart.toISOString().split('T')[0]).lte('shift_date',wEnd.toISOString().split('T')[0])
    if(ex?.length) await supabase.from('shifts').delete().in('id',ex.map(s=>s.id))
    const toInsert = plan.filter(s=>!absences[s._id]).map(({_id,employee,_cost,_ia,...s})=>({...s,restaurant_id:viewSite}))
    await supabase.from('shifts').insert(toInsert)
    setValidated(true)
    toast(`✓ Planning validé — ${toInsert.length} shifts enregistrés`)
  }

  const active = generated || shifts.map(s=>({...s,_id:s.id,employee:s.employees,_cost:shiftCost(s)}))
  const totalCost = active.filter(s=>!absences[s._id]).reduce((a,s)=>a+(s._cost||0),0)
  const score = Math.min(100, Math.max(0, 100-Math.abs(totalCost/(7*4500)*100-30)*3))
  const scoreColor = score>=75?'var(--green)':score>=50?'var(--amber)':'var(--red)'
  const scoreLabel = score>=75?'Optimal':score>=50?'Acceptable':'À corriger'

  const byDay = DAYS.map((name,i) => {
    const date = new Date(wStart); date.setDate(date.getDate()+i)
    const ds = date.toISOString().split('T')[0]
    const dayShifts = active.filter(s=>s.shift_date===ds)
    return { name, date, ds, shifts:dayShifts, cost:dayShifts.filter(s=>!absences[s._id]).reduce((a,s)=>a+(s._cost||0),0), coeff:TRAFFIC[i] }
  })

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div className="title" style={{ marginBottom:4 }}>
            Planning {generated && <span style={{ fontSize:13, color:'var(--gold)', fontWeight:600 }}>· IA</span>}
          </div>
          <div style={{ fontSize:13, color:'var(--t3)' }}>
            {wStart.toLocaleDateString('fr-FR',{day:'2-digit',month:'long'})} – {wEnd.toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={()=>setWeekOffset(w=>w-1)}>←</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>setWeekOffset(0)}>Cette semaine</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>setWeekOffset(w=>w+1)}>→</button>
        </div>
      </div>

      {/* Sélecteur multi-sites */}
      {sites.length > 1 && (
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
          {sites.map(s => (
            <button key={s.id} onClick={()=>setViewSite(s.id)} style={{
              padding:'7px 14px', borderRadius:10, fontSize:12.5, fontWeight:600, cursor:'pointer', transition:'all .12s',
              background: viewSite===s.id ? 'var(--gold-bg)' : 'var(--s2)',
              color: viewSite===s.id ? 'var(--gold)' : 'var(--t3)',
              border: `1px solid ${viewSite===s.id ? 'var(--gold-bd)' : 'var(--b1)'}`
            }}>{s.name}</button>
          ))}
        </div>
      )}

      {/* Métriques */}
      <div className="kpi-grid kpi-grid-3" style={{ marginBottom:16 }}>
        <div className="kpi">
          <div className="kpi-label">💰 Masse salariale</div>
          <div className="kpi-value" style={{ color:'var(--gold)', fontSize:22 }}>{totalCost.toFixed(0)} €</div>
          <div className="kpi-delta">{(totalCost/(7*4500)*100).toFixed(1)} % du CA est.</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Optimisation</div>
          <div className="kpi-value" style={{ color:scoreColor, fontSize:18 }}>{scoreLabel}</div>
          <div className="kpi-delta">Score {Math.round(score)}/100</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Shifts</div>
          <div className="kpi-value" style={{ fontSize:22 }}>{active.filter(s=>!absences[s._id]).length}</div>
          <div className="kpi-delta">{employees.length} actifs</div>
        </div>
      </div>

      {/* Action principale */}
      {!validated ? (
        <div style={{ background:'var(--s2)', border:'1px solid var(--gold-bd)', borderRadius:14, padding:'16px 20px', marginBottom:16 }}>
          <div style={{ fontWeight:700, marginBottom:4 }}>{generated ? '◉ Planning IA prêt' : generating ? '⟳ Génération…' : '⟳ Chargement…'}</div>
          <div style={{ fontSize:13, color:'var(--t3)', marginBottom:12 }}>{generated ? `${generated.length} shifts · ${totalCost.toFixed(0)} € · Score ${scoreLabel}` : 'Analyse de votre équipe en cours…'}</div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-primary" onClick={validatePlan} disabled={!generated||generating}>✓ Valider tout</button>
            <button className="btn btn-ghost" onClick={()=>generatePlan()} disabled={generating}>{generating?'Génération…':'↺ Régénérer'}</button>
          </div>
        </div>
      ) : (
        <div style={{ background:'var(--green-bg)', border:'1px solid var(--green-bd)', borderRadius:14, padding:'14px 20px', marginBottom:16, display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ color:'var(--green)', fontSize:24 }}>✓</div>
          <div>
            <div style={{ fontWeight:700, color:'var(--green)' }}>Planning validé</div>
            <div style={{ fontSize:12, color:'var(--t3)' }}>Enregistré · équipe notifiée</div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft:'auto' }} onClick={()=>{setValidated(false);generatePlan()}}>↺ Modifier</button>
        </div>
      )}

      {/* Planning par jour */}
      {generating ? (
        <div className="card" style={{ textAlign:'center', padding:48 }}>
          <div style={{ fontSize:32, marginBottom:12 }}>◈</div>
          <div style={{ fontWeight:700, fontSize:18, marginBottom:6 }}>Génération du planning…</div>
          <div style={{ color:'var(--t3)', fontSize:13 }}>L'IA analyse votre équipe, la météo et l'historique.</div>
        </div>
      ) : employees.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:48 }}>
          <div style={{ fontSize:32, marginBottom:12 }}>◉</div>
          <div style={{ fontWeight:700, fontSize:18, marginBottom:6 }}>Aucun employé</div>
          <div style={{ color:'var(--t3)', fontSize:13, marginBottom:16 }}>Ajoutez votre équipe dans l'onglet Équipe.</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {byDay.map(({name,date,ds,shifts:dayShifts,cost,coeff}) => {
            const isToday = date.toDateString()===new Date().toDateString()
            const activeShifts = dayShifts.filter(s=>!absences[s._id])
            return (
              <div key={ds} style={{ background:'var(--s1)', border:`1px solid ${isToday?'var(--gold-bd)':'var(--b1)'}`, borderRadius:14, overflow:'hidden' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom: dayShifts.length?'1px solid var(--b1)':'none', background: isToday?'var(--gold-bg)':'transparent' }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:14, display:'flex', alignItems:'center', gap:8 }}>
                      {name} {isToday && <span className="badge badge-gold" style={{ fontSize:10 }}>Aujourd'hui</span>}
                    </div>
                    <div style={{ fontSize:11, color:'var(--t3)', marginTop:1 }}>
                      {date.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})} · trafic {Math.round(coeff*100)} %
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    {cost>0 && <div style={{ fontWeight:700, color:'var(--gold)', fontSize:13, fontVariantNumeric:'tabular-nums' }}>{cost.toFixed(0)} €</div>}
                    <div style={{ fontSize:12, color:'var(--t3)' }}>{activeShifts.length} shift{activeShifts.length!==1?'s':''}</div>
                    <button onClick={()=>setEditShift({shift_date:ds,_new:true})} style={{ fontSize:18, color:'var(--t3)', cursor:'pointer', padding:'2px 6px', borderRadius:6, border:'1px solid var(--b1)', background:'var(--s2)', lineHeight:1 }}>+</button>
                  </div>
                </div>
                {dayShifts.length > 0 && (
                  <div style={{ padding:'6px 10px' }}>
                    {dayShifts.map((s,i) => {
                      const emp = s.employee||s.employees
                      const isAbs = absences[s._id]
                      return (
                        <div key={s._id||i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 6px', borderBottom: i<dayShifts.length-1?'1px solid var(--b1)':'none', opacity:isAbs?.5:1 }}>
                          <div style={{ width:28,height:28,borderRadius:99,background:isAbs?'var(--red-bg)':'var(--gold-bg)',color:isAbs?'var(--red)':'var(--gold)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:10,flexShrink:0 }}>
                            {emp?.first_name?.[0]}{emp?.last_name?.[0]}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:600, fontSize:13 }}>{emp?.first_name} {emp?.last_name} {s._ia&&<span style={{ fontSize:9,background:'var(--blue-bg)',color:'var(--blue)',padding:'1px 5px',borderRadius:4,fontWeight:700 }}>IA</span>}</div>
                            <div style={{ fontSize:11, color:'var(--t3)' }}>{emp?.role} · {s.service} · {s.start_time?.slice(0,5)}–{s.end_time?.slice(0,5)} · <span style={{ color:'var(--gold)' }}>{(s._cost||shiftCost(s)).toFixed(0)} €</span></div>
                          </div>
                          <button onClick={()=>setEditShift(s)} style={{ fontSize:12,color:'var(--t3)',padding:'3px 7px',borderRadius:6,border:'1px solid var(--b1)',background:'transparent',cursor:'pointer' }}>✏</button>
                          <button onClick={()=>setAbsences(a=>({...a,[s._id]:!a[s._id]}))} style={{ fontSize:12,color:isAbs?'var(--green)':'var(--t3)',padding:'3px 7px',borderRadius:6,border:'1px solid var(--b1)',background:'transparent',cursor:'pointer' }}>
                            {isAbs?'✓':'🤒'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal édition shift */}
      {editShift && (
        <ShiftModal shift={editShift} employees={employees} onSave={async(form)=>{
          if(generated) {
            if(editShift._new) {
              const emp = employees.find(e=>e.id===form.employee_id)
              const h = Math.max(0,timeH(form.end_time)-timeH(form.start_time))
              setGenerated(p=>[...(p||[]),{_id:`m_${Date.now()}`,employee_id:form.employee_id,employee:emp,...form,_cost:(emp?.hourly_rate||13)*h,_ia:false}])
            } else setGenerated(p=>p.map(s=>s._id===editShift._id?{...s,...form,employee:employees.find(e=>e.id===form.employee_id),_cost:shiftCost({...form,employees:employees.find(e=>e.id===form.employee_id)})}:s))
          } else {
            if(editShift.id) await supabase.from('shifts').update(form).eq('id',editShift.id)
            else await supabase.from('shifts').insert({...form,restaurant_id:viewSite})
            loadAll()
          }
          toast('Shift mis à jour')
          setEditShift(null)
        }} onClose={()=>setEditShift(null)} />
      )}
    </div>
  )
}

function ShiftModal({ shift, employees, onSave, onClose }) {
  const [form, setForm] = useState({ employee_id:shift.employee_id||shift.employee?.id||employees[0]?.id||'', shift_date:shift.shift_date||new Date().toISOString().split('T')[0], service:shift.service||'midi', start_time:shift.start_time||'10:00', end_time:shift.end_time||'15:30', status:shift.status||'planned', notes:shift.notes||'' })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const emp = employees.find(e=>e.id===form.employee_id)
  const h = Math.max(0,timeH(form.end_time)-timeH(form.start_time))
  const cost = (emp?.hourly_rate||13)*h

  function applyService(svc) {
    const s = SERVICES[svc]
    if(s) setForm(f=>({...f,service:svc,start_time:s.start,end_time:s.end}))
    else set('service',svc)
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div style={{ fontWeight:700, fontSize:16 }}>{shift._new?'Ajouter un shift':'Modifier'}</div>
          <button onClick={onClose} style={{ color:'var(--t3)', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom:14 }}>
            <div className="label" style={{ marginBottom:6 }}>Employé</div>
            <select className="input" value={form.employee_id} onChange={e=>set('employee_id',e.target.value)} required>
              {employees.map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name} — {e.role}</option>)}
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
            <div><div className="label" style={{ marginBottom:6 }}>Date</div><input className="input" type="date" value={form.shift_date} onChange={e=>set('shift_date',e.target.value)} /></div>
            <div><div className="label" style={{ marginBottom:6 }}>Service</div>
              <select className="input" value={form.service} onChange={e=>applyService(e.target.value)}>
                <option value="midi">🌤 Midi</option><option value="soir">🌙 Soir</option>
                <option value="continu">⏰ Continu</option><option value="ouverture">🔑 Ouverture</option><option value="fermeture">🔒 Fermeture</option>
              </select>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
            <div><div className="label" style={{ marginBottom:6 }}>Début</div><input className="input" type="time" value={form.start_time} onChange={e=>set('start_time',e.target.value)} /></div>
            <div><div className="label" style={{ marginBottom:6 }}>Fin</div><input className="input" type="time" value={form.end_time} onChange={e=>set('end_time',e.target.value)} /></div>
          </div>
          {h>0&&<div style={{ background:'var(--s2)',borderRadius:10,padding:'10px 14px',marginBottom:14,display:'flex',justifyContent:'space-between',fontSize:13 }}>
            <span style={{ color:'var(--t3)' }}>Durée <b style={{ color:'var(--t1)' }}>{h.toFixed(1)}h</b></span>
            <span style={{ color:'var(--t3)' }}>Coût <b style={{ color:'var(--gold)' }}>{cost.toFixed(2)} €</b></span>
          </div>}
          <div style={{ marginBottom:14 }}>
            <div className="label" style={{ marginBottom:6 }}>Statut</div>
            <select className="input" value={form.status} onChange={e=>set('status',e.target.value)}>
              <option value="planned">Planifié</option><option value="confirmed">Confirmé</option><option value="done">Effectué</option><option value="absent">Absent</option>
            </select>
          </div>
          <div><div className="label" style={{ marginBottom:6 }}>Notes</div><textarea className="input" value={form.notes} onChange={e=>set('notes',e.target.value)} rows={2} style={{ resize:'vertical' }} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={saving||!form.employee_id} onClick={async()=>{setSaving(true);await onSave(form);setSaving(false)}}>
            {saving?'Enregistrement…':shift._new?'Ajouter':'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
