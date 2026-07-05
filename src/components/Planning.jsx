import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Modal } from './Forms'

export default function PlanningManager({ restaurant, toast }) {
  const [shifts, setShifts] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showSwap, setShowSwap] = useState(null)
  const [weekOffset, setWeekOffset] = useState(0)

  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() + weekOffset * 7)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  useEffect(() => { loadAll() }, [weekOffset])

  async function loadAll() {
    setLoading(true)
    const [{ data: s }, { data: e }] = await Promise.all([
      supabase.from('shifts')
        .select('*, employees(id, first_name, last_name, role, hourly_rate)')
        .eq('restaurant_id', restaurant.id)
        .gte('shift_date', weekStart.toISOString().split('T')[0])
        .lte('shift_date', weekEnd.toISOString().split('T')[0])
        .order('shift_date').order('start_time'),
      supabase.from('employees').select('*')
        .eq('restaurant_id', restaurant.id).eq('is_active', true).order('last_name')
    ])
    setShifts(s || [])
    setEmployees(e || [])
    setLoading(false)
  }

  async function saveShift(form) {
    const payload = { ...form, restaurant_id: restaurant.id }
    if (editing) {
      await supabase.from('shifts').update(payload).eq('id', editing.id)
      toast('Shift modifié ✓')
    } else {
      await supabase.from('shifts').insert(payload)
      toast('Shift ajouté ✓')
    }
    setShowForm(false); setEditing(null); loadAll()
  }

  async function deleteShift(id) {
    if (!confirm('Supprimer ce shift ?')) return
    await supabase.from('shifts').delete().eq('id', id)
    toast('Shift supprimé'); loadAll()
  }

  async function updateStatus(id, status) {
    await supabase.from('shifts').update({ status }).eq('id', id)
    toast(`Statut mis à jour : ${status}`)
    loadAll()
  }

  async function doSwap(shiftId, newEmployeeId) {
    await supabase.from('shifts').update({
      employee_id: newEmployeeId,
      swap_requested: false,
      status: 'confirmed'
    }).eq('id', shiftId)
    toast('Échange de shift validé ✓')

    // Log dans le journal
    await supabase.from('ai_journal').insert({
      restaurant_id: restaurant.id,
      agent_key: 'agent_planning',
      action_type: 'shift_swap',
      autonomy_mode: 1,
      description: 'Échange de shift validé manuellement',
      triggered_by: 'user'
    })
    setShowSwap(null); loadAll()
  }

  // Calcul masse salariale semaine
  const masseSal = shifts.reduce((a, s) => {
    const h = s.start_time && s.end_time
      ? (new Date(`2000-01-01T${s.end_time}`) - new Date(`2000-01-01T${s.start_time}`)) / 3600000 : 8
    return a + (s.employees?.hourly_rate || 0) * h
  }, 0)

  // Grouper par jour
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart); d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    days.push({ date: d, dateStr, shifts: shifts.filter(s => s.shift_date === dateStr) })
  }

  const statusColor = { planned: 'var(--blue)', confirmed: 'var(--green)', done: 'var(--muted)', absent: 'var(--red)' }
  const statusLabel = { planned: '📅 Planifié', confirmed: '✅ Confirmé', done: '✔ Effectué', absent: '❌ Absent' }

  return (
    <div className="animate-pop">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontFamily: "'Fraunces',serif", fontWeight: 650, fontSize: 19, margin: 0 }}>
          Planning <span style={{ color: 'var(--muted)', fontSize: 12.5, fontFamily: 'Inter', fontWeight: 500, marginLeft: 8 }}>
            {weekStart.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} – {weekEnd.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
          </span>
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(w => w - 1)}>← Semaine préc.</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(0)}>Aujourd'hui</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(w => w + 1)}>Semaine suiv. →</button>
          <button className="btn btn-copper btn-sm" onClick={() => { setEditing(null); setShowForm(true) }}>+ Ajouter un shift</button>
        </div>
      </div>

      {/* Masse salariale */}
      <div className="card" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>Masse salariale estimée — semaine</div>
          <div style={{ fontWeight: 700, fontSize: 22, fontVariantNumeric: 'tabular-nums', color: 'var(--copper)', marginTop: 3 }}>{masseSal.toFixed(2)} €</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{shifts.length} shifts · {employees.length} employés actifs</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{shifts.filter(s => s.status === 'absent').length} absence(s) déclarée(s)</div>
        </div>
      </div>

      {/* Vue par jour */}
      {loading ? <div style={{ color: 'var(--muted)', padding: 20 }}>Chargement…</div> :
        days.map(({ date, dateStr, shifts: dayShifts }) => (
          <div key={dateStr} className="card" style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: dayShifts.length ? 10 : 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>
                {date.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}
                {date.toDateString() === new Date().toDateString() && <span className="pill pill-copper" style={{ marginLeft: 8, fontSize: 10 }}>Aujourd'hui</span>}
              </div>
              {dayShifts.length === 0 && <span style={{ color: 'var(--muted)', fontSize: 13 }}>Aucun shift</span>}
            </div>

            {dayShifts.map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                borderBottom: '1px dashed var(--line)', flexWrap: 'wrap',
                opacity: s.status === 'absent' ? .55 : 1
              }}>
                {/* Avatar */}
                <div style={{ width: 34, height: 34, borderRadius: 99, background: 'var(--copper)', color: '#14100A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                  {s.employees?.first_name?.[0]}{s.employees?.last_name?.[0]}
                </div>

                {/* Infos */}
                <div style={{ flex: 1, minWidth: 150 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.employees?.first_name} {s.employees?.last_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {s.employees?.role} · {s.service} · {s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}
                    {s.employees?.hourly_rate && s.start_time && s.end_time && (
                      <span style={{ marginLeft: 6 }}>
                        · {((new Date(`2000-01-01T${s.end_time}`) - new Date(`2000-01-01T${s.start_time}`)) / 3600000 * s.employees.hourly_rate).toFixed(2)} €
                      </span>
                    )}
                  </div>
                </div>

                {/* Statut */}
                <select value={s.status} onChange={e => updateStatus(s.id, e.target.value)} style={{
                  background: 'var(--surface2)', border: '1px solid var(--line)', borderRadius: 8,
                  padding: '5px 8px', fontSize: 12, color: statusColor[s.status] || 'var(--muted)', fontWeight: 600, cursor: 'pointer'
                }}>
                  <option value="planned">📅 Planifié</option>
                  <option value="confirmed">✅ Confirmé</option>
                  <option value="done">✔ Effectué</option>
                  <option value="absent">❌ Absent</option>
                </select>

                {/* Actions */}
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(s); setShowForm(true) }} title="Modifier">✏️</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowSwap(s)} title="Échanger le shift">🔁</button>
                <button className="btn btn-ghost btn-sm" onClick={() => deleteShift(s.id)} title="Supprimer">🗑️</button>
              </div>
            ))}
          </div>
        ))
      }

      {/* Formulaire shift */}
      {showForm && (
        <ShiftForm
          initial={editing}
          employees={employees}
          restaurant={restaurant}
          onSave={saveShift}
          onClose={() => { setShowForm(false); setEditing(null) }}
        />
      )}

      {/* Modal échange de shift */}
      {showSwap && (
        <Modal title="Échanger ce shift" onClose={() => setShowSwap(null)}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Shift actuel</div>
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 14px', fontSize: 13.5 }}>
              <b>{showSwap.employees?.first_name} {showSwap.employees?.last_name}</b> · {new Date(showSwap.shift_date).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'short' })} · {showSwap.service} · {showSwap.start_time?.slice(0, 5)}–{showSwap.end_time?.slice(0, 5)}
            </div>
          </div>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Assigner à un autre employé</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {employees.filter(e => e.id !== showSwap.employee_id).map(e => (
              <button key={e.id} onClick={() => doSwap(showSwap.id, e.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                background: 'var(--surface2)', border: '1px solid var(--line)', borderRadius: 10,
                cursor: 'pointer', textAlign: 'left', transition: 'border-color .15s'
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 99, background: 'var(--green)', color: '#0C1710', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>
                  {e.first_name[0]}{e.last_name[0]}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{e.first_name} {e.last_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{e.role} · {e.contract_type}</div>
                </div>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setShowSwap(null)}>Annuler</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function ShiftForm({ initial, employees, restaurant, onSave, onClose }) {
  const [form, setForm] = useState({
    employee_id: initial?.employee_id || (employees[0]?.id || ''),
    shift_date: initial?.shift_date || new Date().toISOString().split('T')[0],
    service: initial?.service || 'midi',
    start_time: initial?.start_time || '10:00',
    end_time: initial?.end_time || '15:00',
    status: initial?.status || 'planned',
    notes: initial?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  // Calcul automatique des heures et du coût
  const emp = employees.find(e => e.id === form.employee_id)
  const heures = form.start_time && form.end_time
    ? Math.max(0, (new Date(`2000-01-01T${form.end_time}`) - new Date(`2000-01-01T${form.start_time}`)) / 3600000) : 0
  const cout = emp?.hourly_rate ? (emp.hourly_rate * heures).toFixed(2) : '—'

  async function submit(e) {
    e.preventDefault(); setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <Modal title={initial ? 'Modifier le shift' : 'Ajouter un shift'} onClose={onClose}>
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
            <select className="input" style={{ width: '100%' }} value={form.service} onChange={e => set('service', e.target.value)}>
              <option value="midi">Midi</option>
              <option value="soir">Soir</option>
              <option value="continu">Continu</option>
              <option value="ouverture">Ouverture</option>
              <option value="fermeture">Fermeture</option>
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

        {/* Calcul auto */}
        {heures > 0 && (
          <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--muted)' }}>Durée : <b style={{ color: 'var(--ink)' }}>{heures.toFixed(1)}h</b></span>
            <span style={{ color: 'var(--muted)' }}>Coût estimé : <b style={{ color: 'var(--copper)' }}>{cout} €</b></span>
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
          <label style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Notes (optionnel)</label>
          <textarea className="input" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Ex: remplace Sophie, formation matin..." style={{ resize: 'vertical', width: '100%' }} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn btn-copper" style={{ flex: 1 }} disabled={saving || !form.employee_id}>
            {saving ? 'Enregistrement…' : initial ? 'Enregistrer les modifications' : 'Ajouter le shift'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
