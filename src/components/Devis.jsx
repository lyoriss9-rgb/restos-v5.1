import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { exportDevisPDF } from './Exports'
import { Modal } from './Forms'

export default function DevisManager({ restaurant, toast }) {
  const [suppliers, setSuppliers] = useState([])
  const [devisList, setDevisList] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: s }, { data: d }] = await Promise.all([
      supabase.from('suppliers').select('*').eq('restaurant_id', restaurant.id).order('name'),
      supabase.from('invoices').select('*, suppliers(name)').eq('restaurant_id', restaurant.id)
        .eq('status', 'pending').order('created_at', { ascending: false }).limit(20)
    ])
    setSuppliers(s || [])
    setDevisList(d || [])
    setLoading(false)
  }

  async function saveDevis(form) {
    // Enregistrer en base comme facture en attente
    const { data: invoice } = await supabase.from('invoices').insert({
      restaurant_id: restaurant.id,
      supplier_id: form.supplierId,
      invoice_date: new Date().toISOString().split('T')[0],
      total_amount: form.items.reduce((a, i) => a + (i.qty * i.unit_price), 0),
      status: 'pending',
      items: form.items,
      notes: form.notes
    }).select().single()

    // Générer le PDF
    const supplier = suppliers.find(s => s.id === form.supplierId)
    const num = await exportDevisPDF(restaurant, {
      supplier,
      items: form.items,
      notes: form.notes,
      valid_until: form.valid_until
    })

    toast(`Devis ${num} généré et téléchargé ✓`)
    setShowForm(false)
    loadAll()
  }

  return (
    <div className="animate-pop">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ fontFamily: "'Fraunces',serif", fontWeight: 650, fontSize: 19, margin: 0 }}>
          Devis fournisseurs
        </h2>
        <button className="btn btn-copper btn-sm" onClick={() => setShowForm(true)}>+ Créer un devis</button>
      </div>

      {loading ? <div style={{ color: 'var(--muted)' }}>Chargement…</div> :
        devisList.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 30 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Aucun devis en cours</div>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>Créez votre premier devis fournisseur — il sera généré en PDF automatiquement.</div>
            <button className="btn btn-copper btn-sm" onClick={() => setShowForm(true)}>Créer un devis</button>
          </div>
        ) : (
          <div className="card">
            {devisList.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px dashed var(--line)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{d.suppliers?.name || 'Fournisseur inconnu'}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {new Date(d.invoice_date).toLocaleDateString('fr-FR')} · {d.total_amount?.toFixed(2)} € HT
                  </div>
                  {d.notes && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, fontStyle: 'italic' }}>{d.notes}</div>}
                </div>
                <span className="pill pill-gold">En attente</span>
                <button className="btn btn-ghost btn-sm" onClick={async () => {
                  const supplier = suppliers.find(s => s.id === d.supplier_id)
                  await exportDevisPDF(restaurant, { supplier, items: d.items || [], notes: d.notes })
                  toast('Devis re-téléchargé ✓')
                }}>📄 Re-télécharger</button>
              </div>
            ))}
          </div>
        )
      }

      {showForm && (
        <DevisForm
          suppliers={suppliers}
          onSave={saveDevis}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}

function DevisForm({ suppliers, onSave, onClose }) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '')
  const [items, setItems] = useState([{ name: '', qty: 1, unit: 'kg', unit_price: 0 }])
  const [notes, setNotes] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [saving, setSaving] = useState(false)

  function addItem() { setItems(i => [...i, { name: '', qty: 1, unit: 'kg', unit_price: 0 }]) }
  function removeItem(i) { setItems(items => items.filter((_, idx) => idx !== i)) }
  function setItem(i, k, v) { setItems(items => items.map((item, idx) => idx === i ? { ...item, [k]: v } : item)) }

  const total = items.reduce((a, i) => a + (parseFloat(i.qty) || 0) * (parseFloat(i.unit_price) || 0), 0)

  async function submit(e) {
    e.preventDefault(); setSaving(true)
    await onSave({ supplierId, items, notes, valid_until: validUntil })
    setSaving(false)
  }

  return (
    <Modal title="Créer un devis fournisseur" onClose={onClose}>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Fournisseur</label>
          <select className="input" style={{ width: '100%' }} value={supplierId} onChange={e => setSupplierId(e.target.value)} required>
            {suppliers.length === 0 && <option value="">— Aucun fournisseur configuré —</option>}
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>Articles</label>
          <button type="button" className="btn btn-ghost btn-sm" onClick={addItem}>+ Ajouter un article</button>
        </div>

        {items.map((item, i) => (
          <div key={i} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px', marginBottom: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 70px 28px', gap: 8, alignItems: 'center' }}>
              <input className="input" placeholder="Désignation" value={item.name} onChange={e => setItem(i, 'name', e.target.value)} required style={{ width: '100%', fontSize: 13 }} />
              <input className="input" type="number" step="0.1" placeholder="Qté" value={item.qty} onChange={e => setItem(i, 'qty', e.target.value)} style={{ width: '100%', fontSize: 13, textAlign: 'center' }} />
              <select className="input" value={item.unit} onChange={e => setItem(i, 'unit', e.target.value)} style={{ width: '100%', fontSize: 12 }}>
                {['kg', 'g', 'L', 'cl', 'pce', 'bte', 'carton'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <input className="input" type="number" step="0.01" placeholder="Prix/u" value={item.unit_price} onChange={e => setItem(i, 'unit_price', e.target.value)} style={{ width: '100%', fontSize: 13, textAlign: 'right' }} />
              <button type="button" onClick={() => removeItem(i)} style={{ color: 'var(--red)', fontSize: 16 }}>✕</button>
            </div>
            {item.qty > 0 && item.unit_price > 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6, textAlign: 'right' }}>
                Total : <b style={{ color: 'var(--copper)' }}>{(parseFloat(item.qty) * parseFloat(item.unit_price)).toFixed(2)} € HT</b>
              </div>
            )}
          </div>
        ))}

        {/* Total */}
        <div style={{ background: 'var(--copper-soft)', border: '1px solid var(--copper)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>Total HT</span>
          <span style={{ fontWeight: 700, color: 'var(--copper)', fontSize: 16 }}>{total.toFixed(2)} €</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Validité du devis</label>
            <input className="input" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} style={{ width: '100%' }} />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Notes / conditions particulières</label>
          <textarea className="input" value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Ex: livraison souhaitée mardi avant 8h, qualité AOP obligatoire..." style={{ resize: 'vertical', width: '100%' }} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn btn-copper" style={{ flex: 1 }} disabled={saving || items.length === 0 || !supplierId}>
            {saving ? 'Génération du PDF…' : '📄 Générer le devis PDF'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
