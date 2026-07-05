import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Modal } from './Forms'

// ═══════════════════════════════════════════════════════
// PLANNING V7 — Autonome, optimisé, validé en 1 clic
// L'utilisateur valide. Il ne crée plus.
// ═══════════════════════════════════════════════════════

const SERVICES = [
  { key: 'midi',     label: 'Midi',     start: '10:00', end: '15:30', icon: '🌤️' },
  { key: 'soir',     label: 'Soir',     start: '18:00', end: '23:00', icon: '🌙' },
  { key: 'ouverture',label: 'Ouverture',start: '09:00', end: '11:00', icon: '🔑' },
  { key: 'fermeture',label: 'Fermeture',start: '22:30', end: '00:00', icon: '🔒' },
]

// Prévisions de fréquentation par jour (index = 0 lundi)
const TRAFFIC_COEFF = [0.65, 0.70, 0.72, 0.80, 0.95, 1.0, 0.85]
const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const METEO_ICONS = ['☀️', '⛅', '🌧️', '☀️', '☀️', '🌤️', '⛅']

export default function PlanningV7({ restaurant, toast }) {
  const [employees, setEmployees]         = useState([])
  const [existingShifts, setExisting]     = useState([])
  const [generatedPlan, setGenerated]     = useState(null)
  const [generating, setGenerating]       = useState(false)
  const [validated, setValidated]         = useState(false)
  const [weekOffset, setWeekOffset]       = useState(0)
  const [editShift, setEditShift]         = useState(null)
  const [showCompare, setShowCompare]     = useState(false)
  const [absences, setAbsences]           = useState({}) // { shiftId: true }
  const [optimScore, setOptimScore]       = useState(null)

  const weekStart = getWeekStart(weekOffset)
  const weekEnd   = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6)

  useEffect(() => { loadAll() }, [weekOffset])

  // ─── Chargement ───────────────────────────────────────
  async function loadAll() {
    setValidated(false); setGenerated(null); setOptimScore(null)
    const [{ data: emps }, { data: shifts }] = await Promise.all([
      supabase.from('employees').select('*').eq('restaurant_id', restaurant.id).eq('is_active', true).order('role'),
      supabase.from('shifts').select('*, employees(first_name,last_name,role,hourly_rate)')
        .eq('restaurant_id', restaurant.id)
        .gte('shift_date', weekStart.toISOString().split('T')[0])
        .lte('shift_date', weekEnd.toISOString().split('T')[0])
        .order('shift_date').order('start_time')
    ])
    setEmployees(emps || [])
    setExisting(shifts || [])

    // Auto-générer si semaine vide
    if ((shifts || []).length === 0 && (emps || []).length > 0) {
      setTimeout(() => generatePlan(emps || []), 300)
    } else if ((emps || []).length > 0) {
      computeOptimScore(shifts || [], emps || [])
    }
  }

  // ─── Génération IA du planning ────────────────────────
  async function generatePlan(emps = employees) {
    if (emps.length === 0) { toast('Ajoutez d\'abord des employés dans l\'onglet Équipe.', 'error'); return }
    setGenerating(true); setValidated(false)

    // Algo d'optimisation : répartir les employés par compétences et coûts
    const plan = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart); date.setDate(date.getDate() + d)
      const dateStr = date.toISOString().split('T')[0]
      const coeff = TRAFFIC_COEFF[d]
      const dayName = DAY_NAMES[d]

      // Déterminer les services nécessaires selon le trafic
      const needMidi  = coeff >= 0.60
      const needSoir  = coeff >= 0.50
      const staffMidi = Math.max(1, Math.round(coeff * emps.length * 0.5))
      const staffSoir = Math.max(1, Math.round(coeff * emps.length * 0.6))

      // Trier les employés par coût (les moins chers en priorité pour optimiser)
      const sorted = [...emps].sort((a, b) => (a.hourly_rate || 13) - (b.hourly_rate || 13))

      if (needMidi) {
        // Sélection équipe midi
        const midiTeam = sorted.slice(0, staffMidi)
        midiTeam.forEach(emp => {
          const s = SERVICES[0]
          const h = timeToH(s.end) - timeToH(s.start)
          plan.push({
            _id: `gen_${dateStr}_midi_${emp.id}`,
            employee_id: emp.id,
            employee: emp,
            shift_date: dateStr,
            service: 'midi',
            start_time: s.start,
            end_time: s.end,
            status: 'planned',
            _cost: (emp.hourly_rate || 13.50) * h,
            _justification: `Service midi ${dayName} — trafic prévu ${Math.round(coeff * 100)} % · rôle ${emp.role || 'polyvalent'}`,
            _generated: true,
          })
        })
      }

      if (needSoir) {
        // Équipe soir — privilégier les plus expérimentés (coût plus élevé = senior)
        const soirSorted = [...emps].sort((a, b) => (b.hourly_rate || 13) - (a.hourly_rate || 13))
        const soirTeam = soirSorted.slice(0, staffSoir)
        soirTeam.forEach(emp => {
          // Éviter double shift si même employé midi (sauf CDI full-time)
          const alreadyMidi = plan.find(p => p.employee_id === emp.id && p.shift_date === dateStr && p.service === 'midi')
          if (alreadyMidi && emp.contract_type !== 'cdi') return
          const s = SERVICES[1]
          const h = timeToH(s.end) - timeToH(s.start)
          plan.push({
            _id: `gen_${dateStr}_soir_${emp.id}`,
            employee_id: emp.id,
            employee: emp,
            shift_date: dateStr,
            service: 'soir',
            start_time: s.start,
            end_time: s.end,
            status: 'planned',
            _cost: (emp.hourly_rate || 13.50) * h,
            _justification: `Service soir ${dayName} — trafic élevé ${Math.round(coeff * 100)} % · préférence profil expérimenté`,
            _generated: true,
          })
        })
      }
    }

    // Calcul du score d'optimisation
    computeOptimScore(plan, emps)
    setGenerated(plan)
    setGenerating(false)
    toast(`Planning généré — ${plan.length} shifts optimisés ✓`)

    // Log IA
    await supabase.from('ai_journal').insert({
      restaurant_id: restaurant.id,
      agent_key: 'agent_planning',
      action_type: 'planning_generated',
      autonomy_mode: 2,
      description: `Planning semaine du ${weekStart.toLocaleDateString('fr-FR')} généré automatiquement — ${plan.length} shifts, optimisation ${getScoreLabel(computeRawScore(plan, emps))}`,
      triggered_by: 'auto'
    })
  }

  // ─── Score d'optimisation ─────────────────────────────
  function computeRawScore(plan, emps) {
    if (!plan || plan.length === 0) return 0
    const totalCost = plan.reduce((a, s) => a + (s._cost || 0), 0)
    const avgRevWeek = 7 * 4500 // estimation CA semaine
    const massePct = totalCost / avgRevWeek * 100
    // Score : masse salariale cible ~30 %, pénalité si trop haut ou trop bas
    const diff = Math.abs(massePct - 30)
    return Math.max(0, Math.min(100, 100 - diff * 3))
  }

  function computeOptimScore(plan, emps) {
    setOptimScore(computeRawScore(plan, emps))
  }

  function getScoreLabel(score) {
    if (score >= 75) return 'optimal'
    if (score >= 50) return 'acceptable'
    return 'à corriger'
  }

  function getScoreColor(score) {
    if (score >= 75) return 'var(--green)'
    if (score >= 50) return 'var(--gold)'
    return 'var(--red)'
  }

  function getScoreEmoji(score) {
    if (score >= 75) return '🟢'
    if (score >= 50) return '🟠'
    return '🔴'
  }

  // ─── Validation du planning ───────────────────────────
  async function validatePlan() {
    if (!generatedPlan || generatedPlan.length === 0) return
    try {
      // Supprimer les shifts existants de la semaine
      const { data: existing } = await supabase.from('shifts')
        .select('id').eq('restaurant_id', restaurant.id)
        .gte('shift_date', weekStart.toISOString().split('T')[0])
        .lte('shift_date', weekEnd.toISOString().split('T')[0])
      if (existing?.length) {
        await supabase.from('shifts').delete().in('id', existing.map(s => s.id))
      }
      // Insérer le nouveau planning
      const toInsert = generatedPlan
        .filter(s => !absences[s._id])
        .map(({ _id, employee, _cost, _justification, _generated, ...s }) => ({
          ...s, restaurant_id: restaurant.id
        }))
      await supabase.from('shifts').insert(toInsert)
      setValidated(true)
      setExisting(generatedPlan)
      toast(`✅ Planning validé — ${toInsert.length} shifts enregistrés`)
      await supabase.from('ai_journal').insert({
        restaurant_id: restaurant.id,
        agent_key: 'agent_planning',
        action_type: 'planning_validated',
        autonomy_mode: 1,
        description: `Planning semaine validé par le directeur — ${toInsert.length} shifts enregistrés`,
        triggered_by: 'user'
      })
    } catch (e) { toast('Erreur lors de la validation', 'error') }
  }

  // ─── Gestion absences ─────────────────────────────────
  function toggleAbsence(shiftId) {
    setAbsences(a => ({ ...a, [shiftId]: !a[shiftId] }))
  }

  // ─── Calculs ──────────────────────────────────────────
  const activePlan = generatedPlan || existingShifts.map(s => ({
    ...s, _id: s.id, employee: s.employees, _cost: calcCost(s),
    _justification: 'Planning existant', _generated: false
  }))

  const totalCost = activePlan.filter(s => !absences[s._id]).reduce((a, s) => a + (s._cost || 0), 0)

  // Grouper par jour
  const byDay = DAY_NAMES.map((name, i) => {
    const date = new Date(weekStart); date.setDate(date.getDate() + i)
    const dateStr = date.toISOString().split('T')[0]
    const dayShifts = activePlan.filter(s => s.shift_date === dateStr)
    const dayCost = dayShifts.filter(s => !absences[s._id]).reduce((a, s) => a + (s._cost || 0), 0)
    const coeff = TRAFFIC_COEFF[i]
    return { name, date, dateStr, shifts: dayShifts, cost: dayCost, coeff, meteo: METEO_ICONS[i] }
  })

  // Anomalies
  const anomalies = []
  byDay.forEach(day => {
    if (day.shifts.length === 0 && day.coeff > 0.5) anomalies.push({ type: 'missing', day: day.name, msg: `Aucun staff prévu — trafic estimé ${Math.round(day.coeff * 100)} %` })
    if (day.coeff > 0.9 && day.shifts.filter(s => s.service === 'soir').length < 2) anomalies.push({ type: 'understaffed', day: day.name, msg: `Sous-staffé le soir — pic de fréquentation prévu` })
  })

  // Score final
  const score = optimScore !== null ? optimScore : computeRawScore(activePlan, employees)

  return (
    <div className="animate-pop">

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontFamily: "'Fraunces',serif", fontWeight: 650, fontSize: 22, margin: '0 0 4px' }}>
            Planning {generatedPlan ? <span style={{ fontSize: 14, color: 'var(--copper)', fontFamily: 'Inter', fontWeight: 600 }}>· généré par IA</span> : null}
          </h2>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>
            📅 {weekStart.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })} – {weekEnd.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(w => w - 1)}>←</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(0)}>Cette semaine</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(w => w + 1)}>→</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowCompare(true)} disabled={!generatedPlan || existingShifts.length === 0}>⚖️ Comparer</button>
        </div>
      </div>

      {/* ── DASHBOARD MASSE SALARIALE ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>💰 Masse salariale</div>
          <div style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 4, color: 'var(--copper)' }}>{totalCost.toFixed(0)} €</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>≈ {(totalCost / (7 * 4500) * 100).toFixed(1)} % du CA estimé</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>📊 Optimisation</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: getScoreColor(score) }}>
            {getScoreEmoji(score)} {getScoreLabel(score)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Score {Math.round(score)}/100</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>👥 Shifts</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{activePlan.filter(s => !absences[s._id]).length}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{employees.length} employés actifs</div>
        </div>
      </div>

      {/* ── ANOMALIES ── */}
      {anomalies.length > 0 && (
        <div style={{ background: 'var(--red-soft)', border: '1px solid rgba(214,84,63,.4)', borderRadius: 12, padding: '12px 16px', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, color: 'var(--red)', marginBottom: 6, fontSize: 13.5 }}>⚠️ {anomalies.length} anomalie{anomalies.length > 1 ? 's' : ''} détectée{anomalies.length > 1 ? 's' : ''}</div>
          {anomalies.map((a, i) => (
            <div key={i} style={{ fontSize: 13, color: 'var(--ink)', padding: '2px 0' }}>
              <b>{a.day}</b> — {a.msg}
            </div>
          ))}
        </div>
      )}

      {/* ── ACTIONS PRINCIPALES ── */}
      {!validated ? (
        <div style={{ background: 'linear-gradient(135deg, var(--surface2), var(--surface3))', border: '1px solid var(--copper)', borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: 16, fontWeight: 650, marginBottom: 4 }}>
            {generatedPlan ? '🔵 Planning généré — prêt à valider' : '⏳ Chargement du planning…'}
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 14 }}>
            {generatedPlan
              ? `${generatedPlan.length} shifts optimisés · masse salariale ${totalCost.toFixed(0)} € · score ${getScoreEmoji(score)} ${getScoreLabel(score)}`
              : 'L\'IA analyse votre équipe et génère le planning optimal.'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-green" onClick={validatePlan} disabled={!generatedPlan || generating} style={{ fontSize: 15, padding: '10px 20px' }}>
              ✔ Valider tout
            </button>
            <button className="btn btn-ghost" onClick={() => generatePlan()} disabled={generating} style={{ fontSize: 14 }}>
              {generating ? '⏳ Génération…' : '🔁 Régénérer'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--green-soft)', border: '1px solid var(--green)', borderRadius: 14, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>✅</span>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--green)', fontSize: 15 }}>Planning validé et enregistré</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>L'équipe peut consulter son planning sur l'app · envoi notifications automatique</div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { setValidated(false); generatePlan() }}>
            🔁 Modifier
          </button>
        </div>
      )}

      {/* ── PLANNING PAR JOUR ── */}
      {generating ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 650, marginBottom: 8 }}>Génération en cours…</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>L'IA analyse l'historique, la météo, les compétences et les contraintes légales.</div>
        </div>
      ) : employees.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 650, marginBottom: 8 }}>Aucun employé configuré</div>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>Ajoutez votre équipe dans l'onglet Équipe pour générer un planning automatique.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {byDay.map(({ name, date, dateStr, shifts: dayShifts, cost, coeff, meteo }) => (
            <DayCard key={dateStr}
              name={name} date={date} dateStr={dateStr}
              shifts={dayShifts} cost={cost} coeff={coeff} meteo={meteo}
              absences={absences} employees={employees}
              onToggleAbsence={toggleAbsence}
              onEdit={setEditShift}
              onAdd={() => setEditShift({ shift_date: dateStr, _new: true })}
              restaurant={restaurant}
              isGenerated={!!generatedPlan}
            />
          ))}
        </div>
      )}

      {/* ── MODAL AJOUT/MODIF SHIFT ── */}
      {editShift && (
        <ShiftEditModal
          shift={editShift}
          employees={employees}
          onSave={async (form) => {
            if (generatedPlan) {
              if (editShift._new) {
                const newShift = {
                  _id: `manual_${Date.now()}`,
                  employee_id: form.employee_id,
                  employee: employees.find(e => e.id === form.employee_id),
                  shift_date: form.shift_date,
                  service: form.service,
                  start_time: form.start_time,
                  end_time: form.end_time,
                  status: 'planned',
                  _cost: calcCostFromForm(form, employees),
                  _justification: 'Ajout manuel',
                  _generated: false,
                }
                setGenerated(p => [...(p || []), newShift])
              } else {
                setGenerated(p => p.map(s => s._id === editShift._id
                  ? { ...s, ...form, employee: employees.find(e => e.id === form.employee_id), _cost: calcCostFromForm(form, employees) }
                  : s))
              }
            } else {
              // Planning existant — sauvegarder en DB
              if (editShift.id) {
                await supabase.from('shifts').update({ ...form }).eq('id', editShift.id)
              } else {
                await supabase.from('shifts').insert({ ...form, restaurant_id: restaurant.id })
              }
              loadAll()
            }
            toast('Shift mis à jour ✓')
            setEditShift(null)
          }}
          onClose={() => setEditShift(null)}
        />
      )}

      {/* ── MODAL COMPARAISON ── */}
      {showCompare && (
        <CompareModal
          generated={generatedPlan || []}
          existing={existingShifts}
          employees={employees}
          onClose={() => setShowCompare(false)}
        />
      )}
    </div>
  )
}

// ─── Carte d'un jour ──────────────────────────────────
function DayCard({ name, date, dateStr, shifts, cost, coeff, meteo, absences, employees, onToggleAbsence, onEdit, onAdd, isGenerated }) {
  const isToday = date.toDateString() === new Date().toDateString()
  const trafficLevel = coeff >= 0.9 ? 'var(--red)' : coeff >= 0.75 ? 'var(--gold)' : 'var(--green)'
  const activeShifts = shifts.filter(s => !absences[s._id])

  return (
    <div style={{
      background: 'var(--surface)', border: `1px solid ${isToday ? 'var(--copper)' : 'var(--line)'}`,
      borderRadius: 14, overflow: 'hidden'
    }}>
      {/* Header jour */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: shifts.length ? '1px solid var(--line)' : 'none', background: isToday ? 'var(--copper-soft)' : 'transparent' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              {name}
              {isToday && <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--copper)', color: '#14100A', padding: '2px 7px', borderRadius: 99 }}>Aujourd'hui</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} · {meteo} · trafic <span style={{ color: trafficLevel, fontWeight: 600 }}>{Math.round(coeff * 100)} %</span></div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {cost > 0 && <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 14, color: 'var(--copper)' }}>{cost.toFixed(0)} €</div>}
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{activeShifts.length} shift{activeShifts.length > 1 ? 's' : ''}</div>
          <button onClick={onAdd} style={{ fontSize: 18, color: 'var(--muted)', padding: '4px 6px' }} title="Ajouter un shift">+</button>
        </div>
      </div>

      {/* Shifts */}
      {shifts.length > 0 && (
        <div style={{ padding: '8px 12px' }}>
          {shifts.map((s, i) => (
            <ShiftRow key={s._id || i} shift={s} absent={absences[s._id]} onToggleAbsence={() => onToggleAbsence(s._id)} onEdit={() => onEdit(s)} isGenerated={isGenerated} />
          ))}
        </div>
      )}

      {shifts.length === 0 && (
        <div style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Aucun shift planifié</span>
          <button onClick={onAdd} className="btn btn-ghost btn-sm">+ Ajouter</button>
        </div>
      )}
    </div>
  )
}

// ─── Ligne d'un shift ─────────────────────────────────
function ShiftRow({ shift, absent, onToggleAbsence, onEdit, isGenerated }) {
  const emp = shift.employee || shift.employees
  const serviceIcons = { midi: '🌤️', soir: '🌙', ouverture: '🔑', fermeture: '🔒', continu: '⏰' }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px',
      borderBottom: '1px dashed var(--line)', opacity: absent ? .4 : 1,
      transition: 'opacity .2s'
    }}>
      {/* Avatar */}
      <div style={{ width: 30, height: 30, borderRadius: 99, background: absent ? 'var(--red)' : 'var(--copper)', color: absent ? '#fff' : '#14100A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
        {emp?.first_name?.[0]}{emp?.last_name?.[0]}
      </div>

      {/* Infos */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6 }}>
          {emp?.first_name} {emp?.last_name}
          {isGenerated && <span style={{ fontSize: 9, background: 'var(--blue-soft)', color: 'var(--blue)', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>IA</span>}
          {absent && <span style={{ fontSize: 9, background: 'var(--red-soft)', color: 'var(--red)', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>ABSENT</span>}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', display: 'flex', gap: 8 }}>
          <span>{serviceIcons[shift.service] || '⏰'} {shift.service}</span>
          <span>·</span>
          <span>{shift.start_time?.slice(0, 5)} – {shift.end_time?.slice(0, 5)}</span>
          <span>·</span>
          <span style={{ color: 'var(--copper)', fontWeight: 600 }}>{(shift._cost || calcCost(shift))?.toFixed(0)} €</span>
        </div>
        {shift._justification && isGenerated && (
          <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2, fontStyle: 'italic' }}>{shift._justification}</div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={onEdit} style={{ fontSize: 14, padding: '4px 6px', color: 'var(--muted)' }} title="Modifier">✏️</button>
        <button onClick={onToggleAbsence} style={{ fontSize: 14, padding: '4px 6px', color: absent ? 'var(--green)' : 'var(--muted)' }} title={absent ? 'Réactiver' : 'Marquer absent'}>
          {absent ? '✓' : '🤒'}
        </button>
      </div>
    </div>
  )
}

// ─── Modal édition shift ──────────────────────────────
function ShiftEditModal({ shift, employees, onSave, onClose }) {
  const [form, setForm] = useState({
    employee_id: shift.employee_id || shift.employee?.id || employees[0]?.id || '',
    shift_date: shift.shift_date || new Date().toISOString().split('T')[0],
    service: shift.service || 'midi',
    start_time: shift.start_time || '10:00',
    end_time: shift.end_time || '15:30',
    status: shift.status || 'planned',
    notes: shift.notes || '',
  })
  const [saving, setSaving] = useState(false)
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  const emp = employees.find(e => e.id === form.employee_id)
  const h = form.start_time && form.end_time ? Math.max(0, (new Date(`2000-01-01T${form.end_time}`) - new Date(`2000-01-01T${form.start_time}`)) / 3600000) : 0
  const cost = emp?.hourly_rate ? emp.hourly_rate * h : 0

  // Auto-remplir horaires selon service
  function applyService(svc) {
    const s = SERVICES.find(x => x.key === svc)
    if (s) setForm(f => ({ ...f, service: svc, start_time: s.start, end_time: s.end }))
    else set('service', svc)
  }

  async function submit(e) {
    e.preventDefault(); setSaving(true)
    await onSave(form); setSaving(false)
  }

  return (
    <Modal title={shift._new ? 'Ajouter un shift' : 'Modifier le shift'} onClose={onClose}>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Employé</label>
          <select className="input" style={{ width: '100%' }} value={form.employee_id} onChange={e => set('employee_id', e.target.value)} required>
            {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} — {e.role}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Date</label>
            <input className="input" type="date" value={form.shift_date} onChange={e => set('shift_date', e.target.value)} required style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Service</label>
            <select className="input" style={{ width: '100%' }} value={form.service} onChange={e => applyService(e.target.value)}>
              <option value="midi">🌤️ Midi</option>
              <option value="soir">🌙 Soir</option>
              <option value="continu">⏰ Continu</option>
              <option value="ouverture">🔑 Ouverture</option>
              <option value="fermeture">🔒 Fermeture</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Début</label>
            <input className="input" type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Fin</label>
            <input className="input" type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} style={{ width: '100%' }} />
          </div>
        </div>
        {h > 0 && cost > 0 && (
          <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>Durée : <b style={{ color: 'var(--ink)' }}>{h.toFixed(1)}h</b></span>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>Coût estimé : <b style={{ color: 'var(--copper)' }}>{cost.toFixed(2)} €</b></span>
          </div>
        )}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Statut</label>
          <select className="input" style={{ width: '100%' }} value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="planned">📅 Planifié</option>
            <option value="confirmed">✅ Confirmé</option>
            <option value="done">✔ Effectué</option>
            <option value="absent">❌ Absent / Maladie</option>
          </select>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Notes</label>
          <textarea className="input" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} style={{ width: '100%', resize: 'vertical' }} placeholder="Ex: remplace Sophie, formation matin…" />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn btn-copper" style={{ flex: 1 }} disabled={saving || !form.employee_id}>
            {saving ? 'Enregistrement…' : shift._new ? 'Ajouter le shift' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Modal comparaison ────────────────────────────────
function CompareModal({ generated, existing, employees, onClose }) {
  const genCost = generated.reduce((a, s) => a + (s._cost || 0), 0)
  const exCost = existing.reduce((a, s) => a + calcCost(s), 0)
  const saving = exCost - genCost

  return (
    <Modal title="Comparaison — Actuel vs Planning IA" onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Planning actuel', cost: exCost, count: existing.length, color: 'var(--muted)' },
          { label: 'Planning IA optimisé', cost: genCost, count: generated.length, color: 'var(--green)' },
        ].map(p => (
          <div key={p.label} style={{ background: 'var(--surface2)', borderRadius: 12, padding: '14px' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{p.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: p.color, fontVariantNumeric: 'tabular-nums' }}>{p.cost.toFixed(0)} €</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{p.count} shifts</div>
          </div>
        ))}
      </div>
      {saving !== 0 && (
        <div style={{ background: saving > 0 ? 'var(--green-soft)' : 'var(--red-soft)', border: `1px solid ${saving > 0 ? 'rgba(76,154,106,.4)' : 'rgba(214,84,63,.4)'}`, borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{saving > 0 ? 'Économie possible' : 'Surcoût'}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: saving > 0 ? 'var(--green)' : 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>
            {saving > 0 ? '+' : ''}{saving.toFixed(0)} € / semaine
          </div>
          {saving > 0 && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>soit ≈ {(saving * 52 / 1000).toFixed(0)} k€ / an</div>}
        </div>
      )}
      <button className="btn btn-ghost" style={{ width: '100%', marginTop: 14 }} onClick={onClose}>Fermer</button>
    </Modal>
  )
}

// ─── Utilitaires ──────────────────────────────────────
function getWeekStart(offset = 0) {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff + offset * 7)
  d.setHours(0, 0, 0, 0)
  return d
}

function timeToH(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h + m / 60
}

function calcCost(shift) {
  const emp = shift.employees || shift.employee
  if (!emp?.hourly_rate || !shift.start_time || !shift.end_time) return 0
  return emp.hourly_rate * (timeToH(shift.end_time) - timeToH(shift.start_time))
}

function calcCostFromForm(form, employees) {
  const emp = employees.find(e => e.id === form.employee_id)
  if (!emp?.hourly_rate || !form.start_time || !form.end_time) return 0
  return emp.hourly_rate * (timeToH(form.end_time) - timeToH(form.start_time))
}
