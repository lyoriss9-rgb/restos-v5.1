import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ═══════════════════════════════════════════════════════
// MODAL GÉNÉRIQUE
// ═══════════════════════════════════════════════════════
export function Modal({ title, onClose, children }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: 'fixed', inset: 0, background: 'rgba(10,14,11,.75)',
      backdropFilter: 'blur(4px)', zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 16, width: 'min(520px,100%)', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', animation: 'pop .2s ease'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: 19, fontWeight: 650 }}>{title}</div>
          <button onClick={onClose} style={{ fontSize: 20, color: 'var(--muted)' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// CHAMP DE FORMULAIRE
// ═══════════════════════════════════════════════════════
function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

function Input({ ...props }) {
  return <input className="input" style={{ width: '100%' }} {...props} />
}

function Select({ children, ...props }) {
  return (
    <select className="input" style={{ width: '100%' }} {...props}>
      {children}
    </select>
  )
}

// ═══════════════════════════════════════════════════════
// GESTION DES PLATS
// ═══════════════════════════════════════════════════════
export function RecipesManager({ restaurant, toast }) {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('recipes').select('*')
      .eq('restaurant_id', restaurant.id).order('category').order('name')
    setRecipes(data || [])
    setLoading(false)
  }

  async function save(form) {
    const payload = { ...form, restaurant_id: restaurant.id,
      margin_pct: form.selling_price > 0 ? Math.round((1 - form.cost_price / form.selling_price) * 100) : 0 }
    if (editing) {
      await supabase.from('recipes').update(payload).eq('id', editing.id)
      toast('Plat modifié ✓')
    } else {
      await supabase.from('recipes').insert(payload)
      toast('Plat ajouté ✓')
    }
    setShowForm(false); setEditing(null); load()
  }

  async function toggle(recipe) {
    await supabase.from('recipes').update({ is_active: !recipe.is_active }).eq('id', recipe.id)
    toast(recipe.is_active ? 'Plat retiré de la carte' : 'Plat remis à la carte')
    load()
  }

  async function del(id) {
    if (!confirm('Supprimer ce plat ?')) return
    await supabase.from('recipes').delete().eq('id', id)
    toast('Plat supprimé'); load()
  }

  const cats = ['entree', 'plat', 'dessert', 'boisson']
  const catLabel = { entree: 'Entrées', plat: 'Plats', dessert: 'Desserts', boisson: 'Boissons' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ fontFamily: "'Fraunces',serif", fontWeight: 650, fontSize: 19, margin: 0 }}>
          Carte & recettes <span style={{ color: 'var(--muted)', fontSize: 12.5, fontFamily: 'Inter', fontWeight: 500, marginLeft: 8 }}>{recipes.filter(r => r.is_active).length} plats actifs</span>
        </h2>
        <button className="btn btn-copper btn-sm" onClick={() => { setEditing(null); setShowForm(true) }}>+ Ajouter un plat</button>
      </div>

      {loading ? <div style={{ color: 'var(--muted)' }}>Chargement…</div> :
        cats.map(cat => {
          const items = recipes.filter(r => r.category === cat)
          if (!items.length) return null
          return (
            <div key={cat} className="card" style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>{catLabel[cat]}</div>
              {items.map(r => {
                const margin = r.margin_pct || 0
                const marginColor = margin >= 70 ? 'var(--green)' : margin >= 60 ? 'var(--gold)' : 'var(--red)'
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px dashed var(--line)', opacity: r.is_active ? 1 : .45 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14.5 }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        Coût {r.cost_price?.toFixed(2)} € · Vente {r.selling_price?.toFixed(2)} € · {r.popularity} ventes/mois
                      </div>
                    </div>
                    <span style={{ fontWeight: 700, color: marginColor, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{margin} %</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(r); setShowForm(true) }}>✏️</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggle(r)} title={r.is_active ? 'Retirer de la carte' : 'Remettre à la carte'}>
                      {r.is_active ? '🟢' : '🔴'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => del(r.id)}>🗑️</button>
                  </div>
                )
              })}
            </div>
          )
        })
      }

      {showForm && (
        <RecipeForm
          initial={editing}
          onSave={save}
          onClose={() => { setShowForm(false); setEditing(null) }}
        />
      )}
    </div>
  )
}

function RecipeForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    category: initial?.category || 'plat',
    selling_price: initial?.selling_price || '',
    cost_price: initial?.cost_price || '',
    popularity: initial?.popularity || 0,
    label: initial?.label || 'star',
    description: initial?.description || '',
    is_active: initial?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  const margin = form.selling_price > 0 ? Math.round((1 - form.cost_price / form.selling_price) * 100) : 0
  const marginColor = margin >= 70 ? 'var(--green)' : margin >= 60 ? 'var(--gold)' : 'var(--red)'

  async function submit(e) {
    e.preventDefault(); setSaving(true)
    await onSave({ ...form, selling_price: parseFloat(form.selling_price), cost_price: parseFloat(form.cost_price), popularity: parseInt(form.popularity) })
    setSaving(false)
  }

  return (
    <Modal title={initial ? 'Modifier le plat' : 'Ajouter un plat'} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Nom du plat"><Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Fish & chips" required /></Field>
        <Field label="Catégorie">
          <Select value={form.category} onChange={e => set('category', e.target.value)}>
            <option value="entree">Entrée</option>
            <option value="plat">Plat</option>
            <option value="dessert">Dessert</option>
            <option value="boisson">Boisson</option>
          </Select>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Prix de vente HT (€)"><Input type="number" step="0.01" value={form.selling_price} onChange={e => set('selling_price', e.target.value)} placeholder="17.50" required /></Field>
          <Field label="Coût matière (€)"><Input type="number" step="0.01" value={form.cost_price} onChange={e => set('cost_price', e.target.value)} placeholder="4.55" required /></Field>
        </div>
        {form.selling_price > 0 && form.cost_price > 0 && (
          <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>Marge brute calculée</span>
            <span style={{ fontWeight: 700, color: marginColor, fontSize: 16 }}>{margin} %</span>
          </div>
        )}
        <Field label="Ventes / mois (estimation)"><Input type="number" value={form.popularity} onChange={e => set('popularity', e.target.value)} placeholder="100" /></Field>
        <Field label="Statut menu engineering">
          <Select value={form.label} onChange={e => set('label', e.target.value)}>
            <option value="star">⭐ Star (forte marge + forte popularité)</option>
            <option value="plowhorse">🐄 Vache à lait (faible marge + forte popularité)</option>
            <option value="puzzle">❓ Énigme (forte marge + faible popularité)</option>
            <option value="dog">🐕 Poids mort (faible marge + faible popularité)</option>
          </Select>
        </Field>
        <Field label="Description (optionnel)">
          <textarea className="input" value={form.description} onChange={e => set('description', e.target.value)} rows={2} placeholder="Description courte du plat…" style={{ resize: 'vertical' }} />
        </Field>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn btn-copper" style={{ flex: 1 }} disabled={saving}>
            {saving ? 'Enregistrement…' : initial ? 'Enregistrer les modifications' : 'Ajouter le plat'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════
// GESTION DES EMPLOYÉS
// ═══════════════════════════════════════════════════════
export function EmployeesManager({ restaurant, toast }) {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('employees').select('*')
      .eq('restaurant_id', restaurant.id).order('last_name')
    setEmployees(data || [])
    setLoading(false)
  }

  async function save(form) {
    const payload = { ...form, restaurant_id: restaurant.id }
    if (editing) {
      await supabase.from('employees').update(payload).eq('id', editing.id)
      toast('Employé modifié ✓')
    } else {
      await supabase.from('employees').insert(payload)
      toast('Employé ajouté ✓')
    }
    setShowForm(false); setEditing(null); load()
  }

  async function setStatus(emp, status) {
    const updates = { is_active: status !== 'arret' && status !== 'inactif' }
    if (status === 'arret') updates.notes = 'Arrêt maladie'
    await supabase.from('employees').update(updates).eq('id', emp.id)
    toast(status === 'arret' ? '🤒 Arrêt maladie enregistré' : status === 'actif' ? '✅ Employé réactivé' : '❌ Employé désactivé')
    load()
  }

  const contractLabel = { cdi: 'CDI', cdd: 'CDD', extra: 'Extra', apprenti: 'Apprenti' }
  const contractColor = { cdi: 'var(--green)', cdd: 'var(--gold)', extra: 'var(--blue)', apprenti: 'var(--copper)' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ fontFamily: "'Fraunces',serif", fontWeight: 650, fontSize: 19, margin: 0 }}>
          Équipe <span style={{ color: 'var(--muted)', fontSize: 12.5, fontFamily: 'Inter', fontWeight: 500, marginLeft: 8 }}>{employees.filter(e => e.is_active).length} actifs</span>
        </h2>
        <button className="btn btn-copper btn-sm" onClick={() => { setEditing(null); setShowForm(true) }}>+ Ajouter un employé</button>
      </div>

      {loading ? <div style={{ color: 'var(--muted)' }}>Chargement…</div> :
        <div className="card">
          {employees.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>Aucun employé — ajoutez le premier.</div> :
            employees.map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '1px dashed var(--line)', opacity: e.is_active ? 1 : .5 }}>
                <div style={{ width: 36, height: 36, borderRadius: 99, background: 'var(--copper)', color: '#14100A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                  {e.first_name[0]}{e.last_name[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>{e.first_name} {e.last_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{e.role} · {e.weekly_hours}h/sem · {e.hourly_rate} €/h</div>
                </div>
                <span className="pill" style={{ background: `rgba(${contractColor[e.contract_type]?.replace('var(--','').replace(')','')},0.15)`, color: contractColor[e.contract_type] }}>
                  {contractLabel[e.contract_type]}
                </span>
                {!e.is_active && <span className="pill pill-red">Inactif</span>}
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(e); setShowForm(true) }}>✏️</button>
                <select className="btn btn-ghost btn-sm" onChange={ev => setStatus(e, ev.target.value)} value={e.is_active ? 'actif' : 'inactif'}
                  style={{ cursor: 'pointer', fontSize: 12 }}>
                  <option value="actif">✅ Actif</option>
                  <option value="arret">🤒 Arrêt maladie</option>
                  <option value="inactif">❌ Inactif</option>
                </select>
              </div>
            ))
          }
        </div>
      }

      {showForm && <EmployeeForm initial={editing} onSave={save} onClose={() => { setShowForm(false); setEditing(null) }} />}
    </div>
  )
}

function EmployeeForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    first_name: initial?.first_name || '',
    last_name: initial?.last_name || '',
    role: initial?.role || '',
    contract_type: initial?.contract_type || 'cdi',
    weekly_hours: initial?.weekly_hours || 35,
    hourly_rate: initial?.hourly_rate || 13.50,
    phone: initial?.phone || '',
    email: initial?.email || '',
    start_date: initial?.start_date || new Date().toISOString().split('T')[0],
    is_active: initial?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function submit(e) {
    e.preventDefault(); setSaving(true)
    await onSave({ ...form, weekly_hours: parseFloat(form.weekly_hours), hourly_rate: parseFloat(form.hourly_rate) })
    setSaving(false)
  }

  return (
    <Modal title={initial ? 'Modifier l\'employé' : 'Ajouter un employé'} onClose={onClose}>
      <form onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Prénom"><Input value={form.first_name} onChange={e => set('first_name', e.target.value)} required /></Field>
          <Field label="Nom"><Input value={form.last_name} onChange={e => set('last_name', e.target.value)} required /></Field>
        </div>
        <Field label="Poste"><Input value={form.role} onChange={e => set('role', e.target.value)} placeholder="Ex: Serveur, Cuisinier, Chef de partie…" required /></Field>
        <Field label="Type de contrat">
          <Select value={form.contract_type} onChange={e => set('contract_type', e.target.value)}>
            <option value="cdi">CDI</option>
            <option value="cdd">CDD</option>
            <option value="extra">Extra / Vacation</option>
            <option value="apprenti">Apprenti</option>
          </Select>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Heures / semaine"><Input type="number" step="0.5" value={form.weekly_hours} onChange={e => set('weekly_hours', e.target.value)} /></Field>
          <Field label="Taux horaire (€)"><Input type="number" step="0.01" value={form.hourly_rate} onChange={e => set('hourly_rate', e.target.value)} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Téléphone"><Input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="06 00 00 00 00" /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={e => set('email', e.target.value)} /></Field>
        </div>
        <Field label="Date d'entrée"><Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} /></Field>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn btn-copper" style={{ flex: 1 }} disabled={saving}>
            {saving ? 'Enregistrement…' : initial ? 'Enregistrer' : 'Ajouter l\'employé'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════
// GESTION DES STOCKS & INGRÉDIENTS
// ═══════════════════════════════════════════════════════
export function StocksManager({ restaurant, toast }) {
  const [ingredients, setIngredients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('ingredients').select('*')
      .eq('restaurant_id', restaurant.id).order('category').order('name')
    setIngredients(data || [])
    setLoading(false)
  }

  async function save(form) {
    const payload = { ...form, restaurant_id: restaurant.id }
    if (editing) {
      await supabase.from('ingredients').update(payload).eq('id', editing.id)
      toast('Ingrédient modifié ✓')
    } else {
      await supabase.from('ingredients').insert(payload)
      toast('Ingrédient ajouté ✓')
    }
    setShowForm(false); setEditing(null); load()
  }

  async function del(id) {
    if (!confirm('Supprimer cet ingrédient ?')) return
    await supabase.from('ingredients').delete().eq('id', id)
    toast('Ingrédient supprimé'); load()
  }

  async function updateStock(id, qty) {
    await supabase.from('ingredients').update({ stock_qty: parseFloat(qty) }).eq('id', id)
    toast('Stock mis à jour ✓'); load()
  }

  const alerts = ingredients.filter(i => i.stock_qty <= i.stock_alert_qty)
  const filtered = filter === 'alert' ? alerts : ingredients.filter(i => filter === 'all' || i.category === filter)
  const cats = [...new Set(ingredients.map(i => i.category))]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ fontFamily: "'Fraunces',serif", fontWeight: 650, fontSize: 19, margin: 0 }}>
          Stocks & ingrédients
          {alerts.length > 0 && <span className="pill pill-red" style={{ marginLeft: 10 }}>⚠️ {alerts.length} alertes</span>}
        </h2>
        <button className="btn btn-copper btn-sm" onClick={() => { setEditing(null); setShowForm(true) }}>+ Ajouter</button>
      </div>

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 10 }}>
        {[['all', 'Tout'], ['alert', `⚠️ Alertes (${alerts.length})`], ...cats.map(c => [c, c])].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            fontSize: 11.5, fontWeight: 600, padding: '6px 11px', borderRadius: 99, cursor: 'pointer',
            border: '1px solid var(--line)',
            background: filter === k ? 'var(--copper-soft)' : 'transparent',
            color: filter === k ? 'var(--copper)' : 'var(--muted)',
            borderColor: filter === k ? 'var(--copper)' : 'var(--line)'
          }}>{l}</button>
        ))}
      </div>

      {loading ? <div style={{ color: 'var(--muted)' }}>Chargement…</div> :
        <div className="card">
          {filtered.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>Aucun ingrédient.</div> :
            filtered.map(i => {
              const isAlert = i.stock_qty <= i.stock_alert_qty
              return (
                <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px dashed var(--line)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{i.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{i.category} · {i.current_price} €/{i.unit}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="number" step="0.1" value={i.stock_qty} onChange={e => updateStock(i.id, e.target.value)}
                      style={{ width: 70, background: 'var(--surface2)', border: `1px solid ${isAlert ? 'var(--red)' : 'var(--line)'}`, borderRadius: 8, padding: '5px 8px', color: isAlert ? 'var(--red)' : 'var(--ink)', fontSize: 13, fontWeight: 600, textAlign: 'center' }} />
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{i.unit}</span>
                  </div>
                  {isAlert && <span className="pill pill-red">Alerte</span>}
                  <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(i); setShowForm(true) }}>✏️</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => del(i.id)}>🗑️</button>
                </div>
              )
            })
          }
        </div>
      }

      {showForm && <IngredientForm initial={editing} onSave={save} onClose={() => { setShowForm(false); setEditing(null) }} />}
    </div>
  )
}

function IngredientForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    unit: initial?.unit || 'kg',
    current_price: initial?.current_price || '',
    category: initial?.category || 'épicerie',
    stock_qty: initial?.stock_qty || 0,
    stock_alert_qty: initial?.stock_alert_qty || 0,
    dlc_days: initial?.dlc_days || '',
  })
  const [saving, setSaving] = useState(false)
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function submit(e) {
    e.preventDefault(); setSaving(true)
    await onSave({ ...form, current_price: parseFloat(form.current_price), stock_qty: parseFloat(form.stock_qty), stock_alert_qty: parseFloat(form.stock_alert_qty), dlc_days: form.dlc_days ? parseInt(form.dlc_days) : null })
    setSaving(false)
  }

  return (
    <Modal title={initial ? 'Modifier l\'ingrédient' : 'Ajouter un ingrédient'} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Nom"><Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Cabillaud frais" required /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Unité">
            <Select value={form.unit} onChange={e => set('unit', e.target.value)}>
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="L">L</option>
              <option value="cl">cl</option>
              <option value="pce">pièce</option>
              <option value="bte">boîte</option>
            </Select>
          </Field>
          <Field label="Prix d'achat (€/unité)"><Input type="number" step="0.01" value={form.current_price} onChange={e => set('current_price', e.target.value)} placeholder="12.50" required /></Field>
        </div>
        <Field label="Catégorie">
          <Select value={form.category} onChange={e => set('category', e.target.value)}>
            {['poisson', 'viande', 'légume', 'épicerie', 'crèmerie', 'boulangerie', 'sauce', 'boisson'].map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Stock actuel"><Input type="number" step="0.1" value={form.stock_qty} onChange={e => set('stock_qty', e.target.value)} /></Field>
          <Field label="Seuil d'alerte"><Input type="number" step="0.1" value={form.stock_alert_qty} onChange={e => set('stock_alert_qty', e.target.value)} /></Field>
        </div>
        <Field label="DLC (jours)" hint="Laisser vide si pas de date limite"><Input type="number" value={form.dlc_days} onChange={e => set('dlc_days', e.target.value)} placeholder="Ex: 3 pour les produits frais" /></Field>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn btn-copper" style={{ flex: 1 }} disabled={saving}>
            {saving ? 'Enregistrement…' : initial ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════
// PARAMÈTRES DU RESTAURANT
// ═══════════════════════════════════════════════════════
export function Settings({ restaurant, toast, onUpdate }) {
  const [form, setForm] = useState({
    name: restaurant.name || '',
    city: restaurant.city || '',
    address: restaurant.address || '',
    phone: restaurant.phone || '',
    email: restaurant.email || '',
    seats: restaurant.seats || 50,
    timezone: restaurant.timezone || 'Europe/Paris',
    plan: restaurant.plan || 'autopilot',
  })
  const [saving, setSaving] = useState(false)
  const [agents, setAgents] = useState([])

  useEffect(() => {
    supabase.from('agent_settings').select('*').eq('restaurant_id', restaurant.id)
      .then(({ data }) => setAgents(data || []))
  }, [])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function saveInfo(e) {
    e.preventDefault(); setSaving(true)
    await supabase.from('restaurants').update(form).eq('id', restaurant.id)
    toast('Informations mises à jour ✓')
    if (onUpdate) onUpdate({ ...restaurant, ...form })
    setSaving(false)
  }

  async function setAuto(agentKey, level) {
    const existing = agents.find(a => a.agent_key === agentKey)
    if (existing) {
      await supabase.from('agent_settings').update({ autonomy_level: level }).eq('id', existing.id)
    } else {
      await supabase.from('agent_settings').insert({ restaurant_id: restaurant.id, agent_key: agentKey, autonomy_level: level })
    }
    setAgents(ag => ag.map(a => a.agent_key === agentKey ? { ...a, autonomy_level: level } : a))
    toast('Autonomie mise à jour ✓')
  }

  const agentList = [
    { key: 'agent_director', name: 'Directeur IA', desc: 'brief quotidien, analyses, alertes' },
    { key: 'agent_reviews', name: 'Agent Avis', desc: 'répond aux avis dans votre ton' },
    { key: 'agent_orders', name: 'Agent Commandes', desc: 'pré-remplit les commandes fournisseurs' },
    { key: 'agent_planning', name: 'Agent Planning', desc: 'génère et optimise les plannings' },
    { key: 'agent_haccp', name: 'Agent HACCP', desc: 'registres et relevés automatiques' },
    { key: 'agent_marketing', name: 'Agent Marketing', desc: 'stories, posts, campagnes' },
  ]

  return (
    <div>
      <h2 style={{ fontFamily: "'Fraunces',serif", fontWeight: 650, fontSize: 19, margin: '0 0 14px' }}>Paramètres</h2>

      {/* Infos restaurant */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 14 }}>🏠 Informations du restaurant</div>
        <form onSubmit={saveInfo}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Nom du restaurant"><Input value={form.name} onChange={e => set('name', e.target.value)} required /></Field>
            <Field label="Ville"><Input value={form.city} onChange={e => set('city', e.target.value)} /></Field>
          </div>
          <Field label="Adresse complète"><Input value={form.address} onChange={e => set('address', e.target.value)} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Téléphone"><Input value={form.phone} onChange={e => set('phone', e.target.value)} /></Field>
            <Field label="Email"><Input type="email" value={form.email} onChange={e => set('email', e.target.value)} /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Nombre de couverts"><Input type="number" value={form.seats} onChange={e => set('seats', e.target.value)} /></Field>
            <Field label="Formule RestOS">
              <Select value={form.plan} onChange={e => set('plan', e.target.value)}>
                <option value="pilot">🟢 Pilot — 99 €/mois</option>
                <option value="autopilot">🔵 Autopilot — 249 €/mois</option>
                <option value="enterprise">🟣 Enterprise — sur devis</option>
              </Select>
            </Field>
          </div>
          <button type="submit" className="btn btn-copper btn-sm" disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </button>
        </form>
      </div>

      {/* Autonomie des agents */}
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 6 }}>🤖 Autonomie des agents IA</div>
        <div style={{ color: 'var(--muted)', fontSize: 12.5, marginBottom: 14 }}>Définissez pour chaque agent ce qu'il peut faire seul.</div>
        {agentList.map(a => {
          const current = agents.find(ag => ag.agent_key === a.key)?.autonomy_level ?? 1
          return (
            <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px dashed var(--line)', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 150 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{a.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{a.desc}</div>
              </div>
              <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                {[['Suggère', 0], ['1 clic', 1], ['Auto', 2]].map(([label, level]) => (
                  <button key={level} onClick={() => setAuto(a.key, level)} style={{
                    padding: '5px 10px', fontSize: 11, fontWeight: 700,
                    background: current === level ? 'var(--copper)' : 'transparent',
                    color: current === level ? '#14100A' : 'var(--muted)',
                    cursor: 'pointer'
                  }}>{label}</button>
                ))}
              </div>
            </div>
          )
        })}
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
          <b>Suggère</b> : l'agent propose, vous décidez · <b>1 clic</b> : prépare tout, vous validez · <b>Auto</b> : agit seul, tracé au Journal
        </div>
      </div>
    </div>
  )
}
