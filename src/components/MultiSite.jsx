import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function MultiSite({ userId, toast }) {
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('restaurant_members')
      .select('role, restaurants(*)')
      .eq('user_id', userId)
      .eq('is_active', true)
    setSites((data || []).map(d => ({ ...d.restaurants, role: d.role })))
    setLoading(false)
  }

  async function addSite(form) {
    const slug = form.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-') + '-' + Date.now()
    const { data: resto } = await supabase.from('restaurants').insert({ ...form, slug }).select().single()
    await supabase.from('restaurant_members').insert({ restaurant_id: resto.id, user_id: userId, role: 'owner' })
    await supabase.from('agent_settings').insert([
      { restaurant_id: resto.id, agent_key: 'agent_director', autonomy_level: 2 },
      { restaurant_id: resto.id, agent_key: 'agent_reviews', autonomy_level: 2 },
      { restaurant_id: resto.id, agent_key: 'agent_planning', autonomy_level: 1 },
      { restaurant_id: resto.id, agent_key: 'agent_haccp', autonomy_level: 2 },
    ])
    toast('Nouveau restaurant ajouté ✓')
    setShowAdd(false)
    load()
  }

  if (loading) return <div style={{ color: 'var(--muted)', padding: 20 }}>Chargement…</div>

  return (
    <div className="animate-pop">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ fontFamily: "'Fraunces',serif", fontWeight: 650, fontSize: 19, margin: 0 }}>
          Console groupe <span style={{ color: 'var(--muted)', fontSize: 12.5, fontFamily: 'Inter', fontWeight: 500, marginLeft: 8 }}>{sites.length} établissement{sites.length > 1 ? 's' : ''}</span>
        </h2>
        <button className="btn btn-copper btn-sm" onClick={() => setShowAdd(true)}>+ Ajouter un site</button>
      </div>

      {/* Benchmark inter-sites */}
      {sites.length > 1 && <BenchmarkPanel sites={sites} />}

      {/* Liste des sites */}
      <div style={{ display: 'grid', gap: 10 }}>
        {sites.map(site => <SiteCard key={site.id} site={site} onSelect={() => setSelected(site)} />)}
      </div>

      {/* Modale d'ajout */}
      {showAdd && <AddSiteModal onSave={addSite} onClose={() => setShowAdd(false)} />}

      {/* Détail d'un site */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,14,11,.75)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, width: 'min(480px,100%)', padding: 24, animation: 'pop .2s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontFamily: "'Fraunces',serif", fontSize: 20, fontWeight: 650 }}>{selected.name}</div>
              <button onClick={() => setSelected(null)} style={{ color: 'var(--muted)', fontSize: 20 }}>✕</button>
            </div>
            <SiteDetail site={selected} />
          </div>
        </div>
      )}
    </div>
  )
}

function SiteCard({ site, onSelect }) {
  const [kpi, setKpi] = useState(null)

  useEffect(() => {
    supabase.from('daily_pnl').select('revenue,ebitda,ebitda_pct').eq('restaurant_id', site.id)
      .order('report_date', { ascending: false }).limit(1).single()
      .then(({ data }) => setKpi(data))
  }, [site.id])

  const planIcon = { pilot: '🟢', autopilot: '🔵', enterprise: '🟣' }[site.plan] || '🔵'

  return (
    <div className="card" style={{ cursor: 'pointer', transition: 'border-color .15s' }} onClick={onSelect}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{site.name}</div>
          <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>{site.city} · {site.seats} couverts</div>
        </div>
        <span className="pill pill-copper">{planIcon} {site.plan}</span>
      </div>
      {kpi ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {[
            { label: 'CA hier', value: `${kpi.revenue?.toLocaleString('fr-FR')} €` },
            { label: 'EBITDA', value: `${kpi.ebitda_pct?.toFixed(1)} %`, color: kpi.ebitda_pct > 12 ? 'var(--green)' : 'var(--gold)' },
            { label: 'EBITDA €', value: `${kpi.ebitda?.toLocaleString('fr-FR')} €`, color: kpi.ebitda > 0 ? 'var(--green)' : 'var(--red)' },
          ].map(k => (
            <div key={k.label} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{k.label}</div>
              <div style={{ fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums', color: k.color || 'var(--ink)', marginTop: 3 }}>{k.value}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: 'var(--muted)', fontSize: 12 }}>Aucune donnée — chargez le seed SQL pour ce site.</div>
      )}
    </div>
  )
}

function BenchmarkPanel({ sites }) {
  const [data, setData] = useState([])

  useEffect(() => {
    Promise.all(sites.map(async site => {
      const { data: pnl } = await supabase.from('daily_pnl').select('revenue,ebitda,ebitda_pct')
        .eq('restaurant_id', site.id).order('report_date', { ascending: false }).limit(7)
      const avg_rev = (pnl || []).reduce((a, r) => a + (r.revenue || 0), 0) / Math.max((pnl || []).length, 1)
      const avg_eb = (pnl || []).reduce((a, r) => a + (r.ebitda_pct || 0), 0) / Math.max((pnl || []).length, 1)
      return { name: site.name, avg_rev, avg_eb }
    })).then(setData)
  }, [sites])

  const best = data.length ? data.reduce((a, b) => a.avg_eb > b.avg_eb ? a : b, data[0]) : null

  return (
    <div className="card" style={{ marginBottom: 14, background: 'var(--surface2)', border: '1px solid var(--copper)' }}>
      <div style={{ fontWeight: 700, marginBottom: 10, color: 'var(--copper)' }}>
        📊 Benchmark inter-sites — 7 derniers jours
      </div>
      {best && (
        <div style={{ background: 'var(--green-soft)', border: '1px solid var(--green)', borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>
          🏆 <b>{best.name}</b> est votre établissement le plus rentable — EBITDA moy. <b style={{ color: 'var(--green)' }}>{best.avg_eb.toFixed(1)} %</b>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(data.length, 3)},1fr)`, gap: 10 }}>
        {data.map(d => (
          <div key={d.name} style={{ textAlign: 'center', background: 'var(--surface)', borderRadius: 10, padding: '10px 8px' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{d.name}</div>
            <div style={{ fontWeight: 700, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>{Math.round(d.avg_rev).toLocaleString('fr-FR')} €</div>
            <div style={{ fontSize: 12, color: d.avg_eb > 12 ? 'var(--green)' : 'var(--gold)', fontWeight: 600 }}>EBITDA {d.avg_eb.toFixed(1)} %</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SiteDetail({ site }) {
  const [pnl, setPnl] = useState([])
  const [recipes, setRecipes] = useState([])

  useEffect(() => {
    supabase.from('daily_pnl').select('*').eq('restaurant_id', site.id).order('report_date', { ascending: false }).limit(7).then(({ data }) => setPnl(data || []))
    supabase.from('recipes').select('name,margin_pct,label').eq('restaurant_id', site.id).eq('is_active', true).limit(5).then(({ data }) => setRecipes(data || []))
  }, [site.id])

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        {pnl.slice(0, 5).map(r => (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--line)', fontSize: 13 }}>
            <span style={{ color: 'var(--muted)' }}>{new Date(r.report_date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
            <span>{r.revenue?.toLocaleString('fr-FR')} €</span>
            <span style={{ color: r.ebitda > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{r.ebitda_pct?.toFixed(1)} %</span>
          </div>
        ))}
      </div>
      {recipes.length > 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          <b style={{ color: 'var(--ink)' }}>Top carte :</b> {recipes.map(r => r.name).join(', ')}
        </div>
      )}
    </div>
  )
}

function AddSiteModal({ onSave, onClose }) {
  const [form, setForm] = useState({ name: '', city: '', seats: 50, plan: 'autopilot' })
  const [saving, setSaving] = useState(false)
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function submit(e) {
    e.preventDefault(); setSaving(true)
    await onSave({ ...form, seats: parseInt(form.seats) })
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,14,11,.75)', backdropFilter: 'blur(4px)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, width: 'min(440px,100%)', padding: 24, animation: 'pop .2s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: 19, fontWeight: 650 }}>Ajouter un restaurant</div>
          <button onClick={onClose} style={{ color: 'var(--muted)', fontSize: 20 }}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Nom</label>
            <input className="input" style={{ width: '100%' }} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: La Salicorne" required />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Ville</label>
            <input className="input" style={{ width: '100%' }} value={form.city} onChange={e => set('city', e.target.value)} placeholder="Mont Saint-Michel" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Couverts</label>
              <input className="input" style={{ width: '100%' }} type="number" value={form.seats} onChange={e => set('seats', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Formule</label>
              <select className="input" style={{ width: '100%' }} value={form.plan} onChange={e => set('plan', e.target.value)}>
                <option value="pilot">🟢 Pilot</option>
                <option value="autopilot">🔵 Autopilot</option>
                <option value="enterprise">🟣 Enterprise</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-copper" style={{ flex: 1 }} disabled={saving}>
              {saving ? 'Création…' : 'Créer le restaurant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
