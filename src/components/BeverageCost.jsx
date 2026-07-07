import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ═══════════════════════════════════════════════════════
// V11 — BEVERAGE COST
// Cave, bar, boissons — analyse séparée du food cost
// ═══════════════════════════════════════════════════════

const CATEGORIES = {
  vin:        { label:'Vins',        icon:'🍷', color:'#8B3A4E' },
  biere:      { label:'Bières',      icon:'🍺', color:'#C89A3C' },
  spiritueux: { label:'Spiritueux',  icon:'🥃', color:'#A0632D' },
  soft:       { label:'Softs',       icon:'🥤', color:'#4A8FBF' },
  chaud:      { label:'Boissons chaudes', icon:'☕', color:'#6B4A32' },
}

export default function BeverageCost({ restaurant, toast }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editItem, setEditItem] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => { load() }, [restaurant.id])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('beverages').select('*').eq('restaurant_id', restaurant.id).order('category')
    setItems(data || [])
    setLoading(false)
  }

  async function saveItem(form) {
    const margin = form.selling_price > 0 ? Math.round((1 - form.cost_price / form.selling_price) * 100) : 0
    const payload = { ...form, restaurant_id: restaurant.id, margin_pct: margin }
    if (editItem?.id) await supabase.from('beverages').update(payload).eq('id', editItem.id)
    else await supabase.from('beverages').insert(payload)
    toast('Boisson enregistrée ✓')
    setEditItem(null)
    load()
  }

  async function deleteItem(id) {
    await supabase.from('beverages').delete().eq('id', id)
    toast('Supprimé')
    load()
  }

  const filtered = filter === 'all' ? items : items.filter(i => i.category === filter)

  // Stats
  const avgMargin = items.length ? Math.round(items.reduce((a,i) => a + (i.margin_pct||0), 0) / items.length) : 0
  const totalValue = items.reduce((a,i) => a + (i.cost_price||0) * (i.stock_qty||0), 0)
  const lowMargin = items.filter(i => i.margin_pct < 70).length

  // Répartition par catégorie
  const byCategory = Object.keys(CATEGORIES).map(cat => {
    const catItems = items.filter(i => i.category === cat)
    return { cat, count: catItems.length, avgMargin: catItems.length ? Math.round(catItems.reduce((a,i)=>a+(i.margin_pct||0),0)/catItems.length) : 0, value: catItems.reduce((a,i)=>a+(i.cost_price||0)*(i.stock_qty||0),0) }
  }).filter(c => c.count > 0)

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div className="title">Beverage Cost</div>
          <div className="body" style={{ marginTop:4 }}>Cave, bar et boissons — marge et valorisation séparées.</div>
        </div>
        <button className="btn btn-primary" onClick={() => setEditItem({ _new: true })}>+ Ajouter une boisson</button>
      </div>

      {/* KPIs */}
      <div className="kpi-grid kpi-grid-4" style={{ marginBottom:16 }}>
        <div className="kpi">
          <div className="kpi-label">Marge moyenne</div>
          <div className="kpi-value" style={{ color: avgMargin>=72 ? 'var(--green)' : 'var(--amber)', fontSize:24 }}>{avgMargin} %</div>
          <div className="kpi-delta">{avgMargin>=72 ? '✓ objectif' : 'cible ≥ 72 %'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Références</div>
          <div className="kpi-value" style={{ fontSize:24 }}>{items.length}</div>
          <div className="kpi-delta">{byCategory.length} catégories</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Valeur stock</div>
          <div className="kpi-value" style={{ fontSize:24 }}>{totalValue.toFixed(0)} €</div>
          <div className="kpi-delta">au prix d'achat</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">À optimiser</div>
          <div className="kpi-value" style={{ color: lowMargin>0 ? 'var(--amber)' : 'var(--green)', fontSize:24 }}>{lowMargin}</div>
          <div className="kpi-delta">marge &lt; 70 %</div>
        </div>
      </div>

      {/* Répartition catégories */}
      {byCategory.length > 0 && (
        <div className="card" style={{ marginBottom:16 }}>
          <div style={{ fontWeight:600, marginBottom:14 }}>Répartition par catégorie</div>
          <div style={{ display:'grid', gridTemplateColumns:`repeat(${byCategory.length},1fr)`, gap:10 }}>
            {byCategory.map(c => (
              <div key={c.cat} style={{ background:'var(--s2)', borderRadius:12, padding:'12px 14px' }}>
                <div style={{ fontSize:20, marginBottom:6 }}>{CATEGORIES[c.cat].icon}</div>
                <div style={{ fontWeight:700, fontSize:13 }}>{CATEGORIES[c.cat].label}</div>
                <div style={{ fontSize:11, color:'var(--t3)', marginTop:4 }}>{c.count} réf · marge {c.avgMargin} %</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginBottom:14 }}>
        <button onClick={() => setFilter('all')} style={filterStyle(filter==='all')}>Tout</button>
        {Object.entries(CATEGORIES).map(([k,c]) => (
          <button key={k} onClick={() => setFilter(k)} style={filterStyle(filter===k)}>{c.icon} {c.label}</button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="card" style={{ textAlign:'center', padding:40, color:'var(--t3)' }}>Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:40 }}>
          <div style={{ fontSize:32, marginBottom:12 }}>🍷</div>
          <div style={{ fontWeight:700, marginBottom:6 }}>Aucune boisson</div>
          <div style={{ color:'var(--t3)', fontSize:13, marginBottom:16 }}>Ajoutez vos vins, bières, spiritueux et softs pour suivre leur marge.</div>
          <button className="btn btn-primary" onClick={() => setEditItem({ _new:true })}>+ Ajouter la première</button>
        </div>
      ) : (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table className="table">
              <thead>
                <tr><th>Boisson</th><th>Catégorie</th><th>Achat</th><th>Vente</th><th>Marge</th><th>Stock</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight:600 }}>{item.name}</td>
                    <td><span className="badge badge-muted" style={{ fontSize:10 }}>{CATEGORIES[item.category]?.icon} {CATEGORIES[item.category]?.label}</span></td>
                    <td>{item.cost_price?.toFixed(2)} €</td>
                    <td>{item.selling_price?.toFixed(2)} €</td>
                    <td><span style={{ fontWeight:700, color: item.margin_pct>=72 ? 'var(--green)' : item.margin_pct>=60 ? 'var(--amber)' : 'var(--red)' }}>{item.margin_pct} %</span></td>
                    <td>{item.stock_qty || 0}</td>
                    <td style={{ textAlign:'right', whiteSpace:'nowrap' }}>
                      <button onClick={() => setEditItem(item)} style={{ fontSize:12, color:'var(--t3)', padding:'3px 6px', cursor:'pointer' }}>✏</button>
                      <button onClick={() => deleteItem(item.id)} style={{ fontSize:12, color:'var(--red)', padding:'3px 6px', cursor:'pointer' }}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editItem && <BeverageModal item={editItem} onSave={saveItem} onClose={() => setEditItem(null)} />}
    </div>
  )
}

function BeverageModal({ item, onSave, onClose }) {
  const [form, setForm] = useState({
    name: item.name || '', category: item.category || 'vin',
    cost_price: item.cost_price || '', selling_price: item.selling_price || '',
    stock_qty: item.stock_qty || '', unit: item.unit || 'bouteille'
  })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }))
  const margin = form.selling_price > 0 ? Math.round((1 - form.cost_price / form.selling_price) * 100) : 0

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div style={{ fontWeight:700, fontSize:16 }}>{item._new ? 'Ajouter une boisson' : 'Modifier'}</div>
          <button onClick={onClose} style={{ color:'var(--t3)', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom:14 }}>
            <div className="label" style={{ marginBottom:6 }}>Nom</div>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Sancerre blanc 2022" />
          </div>
          <div style={{ marginBottom:14 }}>
            <div className="label" style={{ marginBottom:6 }}>Catégorie</div>
            <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
              {Object.entries(CATEGORIES).map(([k,c]) => <option key={k} value={k}>{c.icon} {c.label}</option>)}
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
            <div><div className="label" style={{ marginBottom:6 }}>Prix d'achat €</div><input className="input" type="number" step="0.01" value={form.cost_price} onChange={e => set('cost_price', parseFloat(e.target.value)||'')} /></div>
            <div><div className="label" style={{ marginBottom:6 }}>Prix de vente €</div><input className="input" type="number" step="0.01" value={form.selling_price} onChange={e => set('selling_price', parseFloat(e.target.value)||'')} /></div>
          </div>
          {form.cost_price > 0 && form.selling_price > 0 && (
            <div style={{ background: margin>=72?'var(--green-bg)':'var(--amber-bg)', border:`1px solid ${margin>=72?'var(--green-bd)':'var(--amber-bd)'}`, borderRadius:10, padding:'10px 14px', marginBottom:14, display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:13, color:'var(--t2)' }}>Marge calculée</span>
              <span style={{ fontWeight:700, color: margin>=72?'var(--green)':'var(--amber)' }}>{margin} %</span>
            </div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div><div className="label" style={{ marginBottom:6 }}>Stock</div><input className="input" type="number" value={form.stock_qty} onChange={e => set('stock_qty', parseFloat(e.target.value)||'')} /></div>
            <div><div className="label" style={{ marginBottom:6 }}>Unité</div>
              <select className="input" value={form.unit} onChange={e => set('unit', e.target.value)}>
                <option value="bouteille">Bouteille</option><option value="verre">Verre</option><option value="fût">Fût</option><option value="canette">Canette</option><option value="L">Litre</option>
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={saving||!form.name} onClick={async () => { setSaving(true); await onSave(form); setSaving(false) }}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

function filterStyle(active) {
  return {
    fontSize:12, fontWeight:600, padding:'6px 12px', borderRadius:99, cursor:'pointer', transition:'all .12s',
    background: active ? 'var(--gold-bg)' : 'transparent',
    color: active ? 'var(--gold)' : 'var(--t3)',
    border: `1px solid ${active ? 'var(--gold-bd)' : 'var(--b1)'}`
  }
}
