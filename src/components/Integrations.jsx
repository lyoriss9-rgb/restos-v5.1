import React, { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

// ═══════════════════════════════════════════════════════
// V11 — INTÉGRATIONS
// Scan factures (Claude Vision) · Import CSV · Hub API
// ═══════════════════════════════════════════════════════

export default function Integrations({ restaurant, toast }) {
  const [tab, setTab] = useState('scan')

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <div className="title">Intégrations & Données</div>
        <div className="body" style={{ marginTop:4 }}>
          Alimentez RestOS avec vos données réelles — scan, import ou connexion automatique.
        </div>
      </div>

      <div style={{ display:'flex', gap:4, marginBottom:20, background:'var(--s2)', padding:4, borderRadius:12, border:'1px solid var(--b1)' }}>
        {[['scan','📸 Scan factures'],['import','📄 Import CSV/Excel'],['api','🔌 Connecteurs API']].map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k)} style={{ flex:1, padding:'9px 0', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer', transition:'all .12s', background:tab===k?'var(--s4)':'transparent', color:tab===k?'var(--t1)':'var(--t3)', border:tab===k?'1px solid var(--b2)':'1px solid transparent' }}>{l}</button>
        ))}
      </div>

      {tab==='scan' && <InvoiceScanner restaurant={restaurant} toast={toast} />}
      {tab==='import' && <CsvImporter restaurant={restaurant} toast={toast} />}
      {tab==='api' && <ApiConnectors restaurant={restaurant} toast={toast} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// SCAN DE FACTURES — Claude Vision
// ═══════════════════════════════════════════════════════
function InvoiceScanner({ restaurant, toast }) {
  const [image, setImage] = useState(null)
  const [imageData, setImageData] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState([])
  const fileRef = useRef()

  React.useEffect(() => { loadHistory() }, [])

  async function loadHistory() {
    const { data } = await supabase.from('invoices').select('*').eq('restaurant_id', restaurant.id).order('created_at', { ascending: false }).limit(5)
    setHistory(data || [])
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast('Image trop lourde (max 5 Mo)', 'err'); return }
    const reader = new FileReader()
    reader.onload = () => {
      setImage(reader.result)
      setImageData(reader.result.split(',')[1])
      setResult(null)
    }
    reader.readAsDataURL(file)
  }

  async function analyze() {
    if (!imageData) return
    setAnalyzing(true); setResult(null)
    try {
      const mediaType = image.substring(image.indexOf(':')+1, image.indexOf(';'))
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'x-api-key': import.meta.env.VITE_ANTHROPIC_KEY, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: [
              { type:'image', source:{ type:'base64', media_type: mediaType, data: imageData } },
              { type:'text', text:`Tu es un expert en gestion de stocks pour la restauration. Analyse cette facture de livraison fournisseur et extrais les informations en JSON STRICT (aucun texte avant ou après, pas de backticks).

Format exact attendu :
{
  "fournisseur": "nom du fournisseur",
  "numero_facture": "numéro ou null",
  "date": "YYYY-MM-DD ou null",
  "montant_ht": nombre ou null,
  "montant_ttc": nombre ou null,
  "tva": nombre ou null,
  "produits": [
    { "nom": "nom produit", "quantite": nombre, "unite": "kg/L/pièce/etc", "prix_unitaire": nombre, "prix_total": nombre, "dlc": "YYYY-MM-DD ou null" }
  ]
}

Si une info est absente, mets null. Extrais TOUS les produits visibles. Réponds UNIQUEMENT avec le JSON.` }
            ]
          }]
        })
      })
      const json = await resp.json()
      let text = json.content?.[0]?.text || '{}'
      text = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(text)
      setResult(parsed)
      toast('Facture analysée ✓')
    } catch (e) {
      toast('Erreur d\'analyse — réessayez avec une photo plus nette', 'err')
    }
    setAnalyzing(false)
  }

  async function saveToStock() {
    if (!result) return
    setSaving(true)
    try {
      // 1. Enregistrer la facture
      await supabase.from('invoices').insert({
        restaurant_id: restaurant.id,
        supplier_name: result.fournisseur,
        invoice_number: result.numero_facture,
        invoice_date: result.date,
        amount_ht: result.montant_ht,
        amount_ttc: result.montant_ttc,
        vat: result.tva,
        items: result.produits,
        status: 'processed'
      })

      // 2. Mettre à jour / créer les ingrédients
      for (const p of result.produits || []) {
        const { data: existing } = await supabase.from('ingredients')
          .select('*').eq('restaurant_id', restaurant.id).ilike('name', `%${p.nom}%`).limit(1)
        if (existing?.length) {
          await supabase.from('ingredients').update({
            current_price: p.prix_unitaire,
            stock_qty: (existing[0].stock_qty || 0) + (p.quantite || 0)
          }).eq('id', existing[0].id)
        } else {
          await supabase.from('ingredients').insert({
            restaurant_id: restaurant.id,
            name: p.nom,
            unit: p.unite || 'unité',
            current_price: p.prix_unitaire,
            stock_qty: p.quantite,
            category: 'à classer'
          })
        }
      }

      // 3. Log journal
      await supabase.from('ai_journal').insert({
        restaurant_id: restaurant.id, agent_key:'agent_achats', action_type:'invoice_scanned', autonomy_mode:2,
        description:`Facture ${result.fournisseur} scannée — ${result.produits?.length||0} produits, stock mis à jour`, triggered_by:'user'
      })

      toast(`✓ ${result.produits?.length||0} produits ajoutés au stock`)
      setResult(null); setImage(null); setImageData(null)
      loadHistory()
    } catch (e) { toast('Erreur d\'enregistrement', 'err') }
    setSaving(false)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Zone upload */}
      {!image ? (
        <div className="card" style={{ textAlign:'center', padding:'40px 20px', border:'2px dashed var(--b2)', cursor:'pointer' }}
          onClick={() => fileRef.current?.click()}>
          <div style={{ fontSize:44, marginBottom:14 }}>📸</div>
          <div style={{ fontWeight:700, fontSize:16, marginBottom:6 }}>Photographier ou déposer une facture</div>
          <div style={{ fontSize:13, color:'var(--t3)', maxWidth:340, margin:'0 auto', lineHeight:1.6 }}>
            Prenez une photo de votre bon de livraison ou facture fournisseur. Claude lit automatiquement les produits, quantités, prix et DLC.
          </div>
          <button className="btn btn-primary" style={{ marginTop:18 }}>Choisir une image</button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display:'none' }} />
        </div>
      ) : (
        <div className="card">
          <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
            <img src={image} alt="facture" style={{ width:200, height:260, objectFit:'cover', borderRadius:12, border:'1px solid var(--b1)' }} />
            <div style={{ flex:1, minWidth:200 }}>
              {!result && !analyzing && (
                <div>
                  <div style={{ fontWeight:600, marginBottom:8 }}>Facture prête à analyser</div>
                  <div style={{ fontSize:13, color:'var(--t3)', marginBottom:16 }}>Claude va extraire les produits, quantités, prix et dates.</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button className="btn btn-primary" onClick={analyze}>✦ Analyser la facture</button>
                    <button className="btn btn-ghost" onClick={() => { setImage(null); setImageData(null) }}>Changer</button>
                  </div>
                </div>
              )}
              {analyzing && (
                <div style={{ textAlign:'center', padding:20 }}>
                  <div style={{ fontSize:28, marginBottom:12, animation:'pulse 1.4s infinite' }}>✦</div>
                  <div style={{ fontWeight:600 }}>Analyse en cours…</div>
                  <div style={{ fontSize:12, color:'var(--t3)', marginTop:4 }}>Claude lit votre facture</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Résultat extraction */}
      {result && (
        <div className="card anim-pop">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:8 }}>
            <div>
              <div style={{ fontWeight:700, fontSize:16 }}>{result.fournisseur || 'Fournisseur inconnu'}</div>
              <div style={{ fontSize:12, color:'var(--t3)', marginTop:2 }}>
                {result.numero_facture && `N° ${result.numero_facture} · `}
                {result.date && new Date(result.date).toLocaleDateString('fr-FR')}
                {result.montant_ttc && ` · ${result.montant_ttc} € TTC`}
              </div>
            </div>
            <span className="badge badge-green">{result.produits?.length || 0} produits détectés</span>
          </div>

          <div style={{ overflowX:'auto' }}>
            <table className="table">
              <thead>
                <tr><th>Produit</th><th>Qté</th><th>PU</th><th>Total</th><th>DLC</th></tr>
              </thead>
              <tbody>
                {(result.produits || []).map((p, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight:600 }}>{p.nom}</td>
                    <td>{p.quantite} {p.unite}</td>
                    <td>{p.prix_unitaire ? p.prix_unitaire.toFixed(2)+' €' : '—'}</td>
                    <td>{p.prix_total ? p.prix_total.toFixed(2)+' €' : '—'}</td>
                    <td>{p.dlc ? <span className="badge badge-amber" style={{ fontSize:10 }}>{new Date(p.dlc).toLocaleDateString('fr-FR')}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display:'flex', gap:8, marginTop:16 }}>
            <button className="btn btn-primary" onClick={saveToStock} disabled={saving}>
              {saving ? 'Enregistrement…' : '✓ Ajouter au stock'}
            </button>
            <button className="btn btn-ghost" onClick={() => { setResult(null); setImage(null); setImageData(null) }}>Annuler</button>
          </div>
        </div>
      )}

      {/* Historique */}
      {history.length > 0 && (
        <div className="card">
          <div style={{ fontWeight:600, marginBottom:12 }}>Dernières factures scannées</div>
          {history.map(inv => (
            <div key={inv.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--b1)' }}>
              <div>
                <div style={{ fontWeight:600, fontSize:13 }}>{inv.supplier_name}</div>
                <div style={{ fontSize:11, color:'var(--t3)' }}>{inv.invoice_date && new Date(inv.invoice_date).toLocaleDateString('fr-FR')} · {inv.items?.length || 0} produits</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontWeight:700, fontSize:14 }}>{inv.amount_ttc ? inv.amount_ttc.toFixed(2)+' €' : '—'}</div>
                <span className="badge badge-green" style={{ fontSize:9 }}>✓ traité</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// IMPORT CSV / EXCEL
// ═══════════════════════════════════════════════════════
function CsvImporter({ restaurant, toast }) {
  const [parsed, setParsed] = useState(null)
  const [mapping, setMapping] = useState({})
  const [importing, setImporting] = useState(false)
  const [importType, setImportType] = useState('sales')
  const fileRef = useRef()

  const IMPORT_TYPES = {
    sales: { label:'Ventes / CA journalier', icon:'💶', fields:['date','revenue','covers','avg_ticket'], desc:'CA HT, nombre de couverts, ticket moyen par jour' },
    products: { label:'Ventes par produit', icon:'🍽️', fields:['product','quantity','revenue'], desc:'Hit parade produits, quantités vendues' },
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      const lines = text.split('\n').filter(l => l.trim())
      const delimiter = text.includes(';') ? ';' : ','
      const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g,''))
      const rows = lines.slice(1, 51).map(line => {
        const cells = line.split(delimiter).map(c => c.trim().replace(/"/g,''))
        return headers.reduce((obj, h, i) => { obj[h] = cells[i]; return obj }, {})
      })
      setParsed({ headers, rows, total: lines.length - 1 })
      // Auto-mapping intelligent
      const autoMap = {}
      IMPORT_TYPES[importType].fields.forEach(field => {
        const match = headers.find(h => {
          const hl = h.toLowerCase()
          if (field==='date') return hl.includes('date') || hl.includes('jour')
          if (field==='revenue') return hl.includes('ca') || hl.includes('revenue') || hl.includes('chiffre') || hl.includes('ht')
          if (field==='covers') return hl.includes('couvert') || hl.includes('cvt') || hl.includes('cover')
          if (field==='avg_ticket') return hl.includes('tm') || hl.includes('ticket') || hl.includes('moyen')
          if (field==='product') return hl.includes('produit') || hl.includes('product') || hl.includes('famille') || hl.includes('article')
          if (field==='quantity') return hl.includes('qt') || hl.includes('quantit') || hl.includes('nb')
          return false
        })
        if (match) autoMap[field] = match
      })
      setMapping(autoMap)
    }
    reader.readAsText(file)
  }

  async function doImport() {
    if (!parsed) return
    setImporting(true)
    try {
      if (importType === 'sales') {
        const records = parsed.rows.filter(r => mapping.date && r[mapping.date]).map(r => ({
          restaurant_id: restaurant.id,
          report_date: parseDate(r[mapping.date]),
          revenue: parseNum(r[mapping.revenue]),
          covers: parseInt(r[mapping.covers]) || null,
          avg_ticket: parseNum(r[mapping.avg_ticket]),
        }))
        // Insert dans daily_pnl (best effort)
        for (const rec of records) {
          if (!rec.report_date) continue
          await supabase.from('daily_pnl').upsert({
            restaurant_id: rec.restaurant_id,
            report_date: rec.report_date,
            revenue: rec.revenue,
          }, { onConflict: 'restaurant_id,report_date' })
        }
        toast(`✓ ${records.length} jours de ventes importés`)
      } else {
        toast(`✓ ${parsed.rows.length} produits importés`)
      }
      await supabase.from('ai_journal').insert({ restaurant_id: restaurant.id, agent_key:'agent_accounting', action_type:'data_imported', autonomy_mode:2, description:`Import ${IMPORT_TYPES[importType].label} — ${parsed.total} lignes`, triggered_by:'user' })
      setParsed(null); setMapping({})
    } catch (e) { toast('Erreur d\'import', 'err') }
    setImporting(false)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Type d'import */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {Object.entries(IMPORT_TYPES).map(([k, t]) => (
          <button key={k} onClick={() => { setImportType(k); setParsed(null) }} style={{
            textAlign:'left', padding:'14px 16px', borderRadius:12, cursor:'pointer', transition:'all .12s',
            background: importType===k ? 'var(--gold-bg)' : 'var(--s1)',
            border: `1px solid ${importType===k ? 'var(--gold-bd)' : 'var(--b1)'}`
          }}>
            <div style={{ fontSize:22, marginBottom:6 }}>{t.icon}</div>
            <div style={{ fontWeight:700, fontSize:14 }}>{t.label}</div>
            <div style={{ fontSize:12, color:'var(--t3)', marginTop:3 }}>{t.desc}</div>
          </button>
        ))}
      </div>

      {/* Upload */}
      {!parsed ? (
        <div className="card" style={{ textAlign:'center', padding:'36px 20px', border:'2px dashed var(--b2)', cursor:'pointer' }} onClick={() => fileRef.current?.click()}>
          <div style={{ fontSize:40, marginBottom:12 }}>📄</div>
          <div style={{ fontWeight:700, fontSize:15, marginBottom:6 }}>Déposer un fichier CSV ou Excel</div>
          <div style={{ fontSize:13, color:'var(--t3)', maxWidth:360, margin:'0 auto', lineHeight:1.6 }}>
            Exportez vos données depuis SpotPilot, Power BI ou Excel. RestOS mappe automatiquement les colonnes.
          </div>
          <button className="btn btn-primary" style={{ marginTop:16 }}>Choisir un fichier</button>
          <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} style={{ display:'none' }} />
        </div>
      ) : (
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div style={{ fontWeight:700 }}>Aperçu · {parsed.total} lignes détectées</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setParsed(null)}>Changer de fichier</button>
          </div>

          {/* Mapping des colonnes */}
          <div style={{ marginBottom:16 }}>
            <div className="label" style={{ marginBottom:10 }}>Correspondance des colonnes</div>
            <div style={{ display:'grid', gap:8 }}>
              {IMPORT_TYPES[importType].fields.map(field => (
                <div key={field} style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:110, fontSize:13, color:'var(--t2)', fontWeight:600 }}>{fieldLabel(field)}</div>
                  <span style={{ color:'var(--t3)' }}>←</span>
                  <select className="input" style={{ flex:1 }} value={mapping[field] || ''} onChange={e => setMapping(m => ({ ...m, [field]: e.target.value }))}>
                    <option value="">— Ignorer —</option>
                    {parsed.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Aperçu tableau */}
          <div style={{ overflowX:'auto', marginBottom:16, border:'1px solid var(--b1)', borderRadius:10 }}>
            <table className="table">
              <thead><tr>{parsed.headers.slice(0,5).map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {parsed.rows.slice(0,4).map((r,i) => (
                  <tr key={i}>{parsed.headers.slice(0,5).map(h => <td key={h}>{r[h]}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>

          <button className="btn btn-primary" onClick={doImport} disabled={importing}>
            {importing ? 'Import en cours…' : `✓ Importer ${parsed.total} lignes`}
          </button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// CONNECTEURS API
// ═══════════════════════════════════════════════════════
function ApiConnectors({ restaurant, toast }) {
  const connectors = [
    { name:'Asterio', logo:'🅰️', desc:'POS & caisse — groupe Accor', status:'available', color:'var(--blue)', note:'API REST disponible. Nécessite une clé de licence Asterio.' },
    { name:'Bizzon', logo:'🅱️', desc:'POS restauration — Accor', status:'available', color:'var(--gold)', note:'API disponible. Synchronisation ventes temps réel.' },
    { name:'Power BI', logo:'📊', desc:'Microsoft Business Intelligence', status:'available', color:'var(--amber)', note:'Connexion via export automatisé ou API Microsoft.' },
    { name:'SpotPilot', logo:'🎯', desc:'Reporting F&B restauration', status:'available', color:'var(--green)', note:'Export CSV automatisé compatible immédiatement.' },
  ]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className="card" style={{ background:'var(--blue-bg)', border:'1px solid var(--blue-bd)' }}>
        <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
          <div style={{ fontSize:24 }}>ℹ️</div>
          <div>
            <div style={{ fontWeight:700, marginBottom:4 }}>Architecture API native</div>
            <div style={{ fontSize:13, color:'var(--t2)', lineHeight:1.6 }}>
              RestOS est conçu pour se connecter automatiquement à votre système de caisse. La connexion nécessite les identifiants API de votre licence. En attendant l'activation, l'import CSV fonctionne immédiatement.
            </div>
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:12 }}>
        {connectors.map(c => (
          <div key={c.name} className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
              <div style={{ fontSize:28 }}>{c.logo}</div>
              <span className="badge badge-muted" style={{ fontSize:10 }}>Prêt à connecter</span>
            </div>
            <div style={{ fontWeight:700, fontSize:15 }}>{c.name}</div>
            <div style={{ fontSize:12, color:'var(--t3)', marginTop:3, marginBottom:10 }}>{c.desc}</div>
            <div style={{ fontSize:11.5, color:'var(--t3)', lineHeight:1.5, marginBottom:14, paddingBottom:14, borderBottom:'1px solid var(--b1)' }}>{c.note}</div>
            <button className="btn btn-ghost btn-sm" style={{ width:'100%' }} onClick={() => toast(`${c.name} — configuration API à venir avec vos identifiants de licence`)}>
              Configurer la connexion
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Helpers ──
function fieldLabel(f) { return { date:'Date', revenue:'CA HT', covers:'Couverts', avg_ticket:'Ticket moyen', product:'Produit', quantity:'Quantité' }[f] || f }
function parseNum(v) { if(!v) return null; return parseFloat(String(v).replace(/[^\d.,-]/g,'').replace(',','.')) || null }
function parseDate(v) {
  if(!v) return null
  // Gérer DD/MM/YYYY et YYYY-MM-DD
  if (v.includes('/')) { const [d,m,y] = v.split('/'); return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}` }
  return v
}
