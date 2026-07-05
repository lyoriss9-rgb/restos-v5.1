import React, { useState } from 'react'

// ═══════════════════════════════════════════════════════
// V8 — PROFIT & MENU OPTIMIZER
// Données réelles — Les Portes du Mont Saint Michel
// ═══════════════════════════════════════════════════════

const SITES = {
  salicorne: {
    name: 'La Salicorne',
    color: '#4C9A6A',
    colorSoft: 'rgba(76,154,106,.15)',
    seats: 450,
    ticket: 24,
    position: 'Brasserie plein air · à partir de 17 €',
    recettes: [
      // Entrées/partage
      { n: 'Faux-filet 220g VBF',          cat:'plat',   prix:25.00, cout:10.50, pop:70,  label:'dog',       reco:'🔴 Marge insuffisante — passer à 27 € ou remplacer par bavette/onglet. Économie coût : −3 €/plat.' },
      { n: 'Pavé saumon & crevettes',       cat:'plat',   prix:24.00, cout:9.20,  pop:90,  label:'plowhorse', reco:'⚠️ Populaire mais sous la cible. Revoir la portion crevettes (−20 g) pour gagner 0,8 €.' },
      { n: 'Fondant agneau curry vert',     cat:'plat',   prix:28.00, cout:7.80,  pop:60,  label:'star',      reco:'✅ Star — mettre en premier dans la liste des plats, encadré. Potentiel de prise +18 %.' },
      { n: 'Corail choux fleurs épices',    cat:'plat',   prix:18.00, cout:4.20,  pop:45,  label:'star',      reco:'✅ Meilleure marge plat (77 %) + différenciation végé. À pousser en signature végétarienne.' },
      { n: 'Burger signature Salicorne',    cat:'plat',   prix:20.00, cout:6.20,  pop:110, label:'plowhorse', reco:'⚠️ Volume OK mais marge 69 %. Réduire le coût pain brioche (−0,40 €) ou passer à 21 €.' },
      { n: 'Moules marinières',             cat:'plat',   prix:18.50, cout:5.80,  pop:85,  label:'plowhorse', reco:'⚠️ Saisonnier (mi-juin/sept). Bien positionné mais portion à revoir si coût moules monte.' },
      { n: 'Suprême poulet français',       cat:'plat',   prix:19.00, cout:5.80,  pop:75,  label:'puzzle',    reco:'❓ Marge correcte mais plat peu différenciant. Revaloriser avec sauce créative ou sortir.' },
      { n: 'Camembert rôti & charcuteries', cat:'entree', prix:22.00, cout:5.50,  pop:55,  label:'star',      reco:'✅ Très bonne marge 75 %. Parfait pour l\'upsell à partager.' },
      { n: 'Focaccia saumon fumé maison',   cat:'entree', prix:12.50, cout:3.80,  pop:80,  label:'star',      reco:'✅ Bonne marge 70 % + "maison" = argument fort. À pousser en entrée.' },
      { n: 'Huîtres Cancale (9)',           cat:'entree', prix:18.50, cout:7.50,  pop:95,  label:'plowhorse', reco:'⚠️ Marge 59 %. Passage à 20,50 € justifié (Pré Salé les vend 21,50 €). +190 €/sem.' },
      { n: 'Frites patate douce',           cat:'entree', prix:7.00,  cout:1.80,  pop:120, label:'star',      reco:'✅ 74 % de marge. Parfait produit d\'upsell. Systématiser la proposition.' },
      { n: 'Tiramisu au café',              cat:'dessert',prix:9.00,  cout:2.40,  pop:90,  label:'star',      reco:'✅ 73 % de marge. Dessert rapide à préparer = double avantage.' },
      { n: 'Glaces artisanales 2 boules',   cat:'dessert',prix:5.50,  cout:1.40,  pop:110, label:'star',      reco:'✅ 75 % de marge. Upsell parfait en fin de repas.' },
      { n: 'Brioche pain perdu glacé',      cat:'dessert',prix:10.00, cout:2.60,  pop:70,  label:'star',      reco:'✅ 74 % de marge + image qualité. À mettre en avant.' },
    ],
    actions: [
      { titre:'Menu déjeuner 2 plats — 29 €', gain:1100, confiance:85, icon:'🍽️', desc:'Entrée + plat ou plat + dessert parmi sélection haute marge (soupe + poulet + tiramisu). Ticket moyen déjeuner actuel ~22 € → 29 € guidé.', fait:false },
      { titre:'Pousser agneau & corail comme signatures', gain:540, confiance:88, icon:'⭐', desc:'Encadrer ces 2 plats sur la carte. Prise de commande +18 % estimée. Ce sont les 2 meilleurs plats en marge ET en différenciation.', fait:false },
      { titre:'Huîtres : revaloriser à 20,50 €', gain:190, confiance:82, icon:'🦪', desc:'Pré Salé les vend 21,50 € (9 pièces). À 20,50 € (+2 €) la Salicorne reste moins cher tout en améliorant sa marge de 10 pts.', fait:false },
    ],
    gainTotal: 1960,
  },

  presale: {
    name: 'Le Pré Salé',
    color: '#D08B3C',
    colorSoft: 'rgba(208,139,60,.14)',
    seats: 190,
    ticket: 52,
    position: 'Gastronomique terroir · menu 47 €',
    recettes: [
      { n: 'Entrecôte VBF frites maison',   cat:'plat',   prix:29.00, cout:11.20, pop:55,  label:'dog',       reco:'🔴 Pire marge de la carte gastro (61 %). Passer à 33 € ou remplacer par onglet/bavette travaillé à 32 €.' },
      { n: 'Agneau de Pré-Salé (menu)',      cat:'plat',   prix:30.00, cout:9.50,  pop:80,  label:'star',      reco:'✅ Plat signature du territoire AOC. Proposer aussi à la carte à 35 € (marge 73 %). Argument marketing absolu.' },
      { n: 'Risotto épeautre champignons',   cat:'plat',   prix:19.50, cout:4.80,  pop:40,  label:'star',      reco:'✅ 75 % de marge = meilleur plat carte. Sous-vendu car sous-mis en avant. Encadrer comme signature végé.' },
      { n: 'Daurade royale croustille',      cat:'plat',   prix:25.00, cout:8.20,  pop:50,  label:'plowhorse', reco:'⚠️ 67 % marge. Vérifier le coût pignons de pin (cher) — une réduction de portion ou substitution économise 0,80 €.' },
      { n: 'Magret canard miel-soja',        cat:'plat',   prix:23.50, cout:7.80,  pop:60,  label:'plowhorse', reco:'⚠️ 67 % marge. Plat solide mais prix potentiellement bas pour le positionnement. Testez 25,50 €.' },
      { n: 'Foie gras canard Calvados',      cat:'entree', prix:22.50, cout:7.20,  pop:70,  label:'plowhorse', reco:'⚠️ 68 % marge pour un foie gras maison. Correct. Assurer l\'approvisionnement local pour justifier le prix.' },
      { n: 'Chèvre frais cannelloni',        cat:'entree', prix:16.50, cout:3.60,  pop:55,  label:'star',      reco:'✅ 78 % marge = meilleure entrée. Peu coûteuse, créative, végé. À pousser.' },
      { n: 'Thon rouge tataki',              cat:'entree', prix:20.50, cout:6.80,  pop:45,  label:'plowhorse', reco:'⚠️ 67 % marge. Produit sensible (thon rouge = controversé éco). Surveiller coût et image.' },
      { n: 'Huîtres creuses n°3 (9)',        cat:'entree', prix:21.50, cout:8.50,  pop:90,  label:'plowhorse', reco:'⚠️ 60 % marge. Le produit le plus populaire mais le moins rentable. Dégustation de 6 à 16 € (menu) = bien calibré.' },
      { n: 'Autour de la pomme (menu)',       cat:'dessert',prix:13.00, cout:3.20,  pop:65,  label:'star',      reco:'✅ 75 % marge + dessert signature 70 ans. Fort en storytelling. À mettre en avant.' },
      { n: 'Crème brûlée vanille',           cat:'dessert',prix:10.00, cout:2.20,  pop:80,  label:'star',      reco:'✅ 78 % marge = meilleur dessert. Simple, efficace, client l\'adore.' },
      { n: 'Pavlova fruits rouges',          cat:'dessert',prix:12.00, cout:3.40,  pop:55,  label:'star',      reco:'✅ 72 % marge. Esthétique Instagram = upsell naturel. Photo sur la carte.' },
      { n: 'Fromages normands',              cat:'dessert',prix:12.00, cout:4.20,  pop:40,  label:'plowhorse', reco:'⚠️ 65 % marge. Correct. Circuits courts locaux à mettre en avant pour justifier le prix.' },
      { n: 'Menu "En 3 instants" (47 €)',    cat:'menu',   prix:47.00, cout:15.50, pop:130, label:'plowhorse', reco:'⚠️ 67 % marge. Sous-pricé pour MSM haute saison. Passage à 52 € sans résistance attendue (+5 €/couvert).' },
    ],
    actions: [
      { titre:'Revaloriser le menu à 52 €', gain:4000, confiance:90, icon:'💶', desc:'Le menu 47 € est 10 % sous le prix du marché MSM. +5 €/couvert sur 133 couverts/jour (70% remplissage) = +665 €/jour. Sans résistance en haute saison.', fait:false },
      { titre:'Agneau Pré-Salé à la carte — 35 €', gain:480, confiance:85, icon:'🐑', desc:'Proposer l\'agneau AOP aussi à la carte à 35 € (hors menu). Marge 73 %. Argument territorial unique. Remplace avantageusement l\'entrecôte.', fait:false },
      { titre:'Entrecôte : passer à 33 € ou remplacer', gain:260, confiance:88, icon:'🥩', desc:'À 29 €, l\'entrecôte a la pire marge (61 %) d\'une carte gastronomique. Passage à 33 € ou remplacement par une pièce plus créative.', fait:false },
    ],
    gainTotal: 4740,
  },

  hippocampe: {
    name: "L'Hippocampe",
    color: '#5B8FBF',
    colorSoft: 'rgba(91,143,191,.14)',
    seats: 80,
    ticket: 17,
    position: 'Crêperie qualité · galettes à partir de 10 €',
    recettes: [
      { n: 'Crêpe sucre',                   cat:'crepe',  prix:5.00,  cout:0.80,  pop:100, label:'star',      reco:'✅ 84 % de marge — la meilleure du groupe. Volume élevé. Proposer systématiquement le supplément.' },
      { n: 'Crêpe beurre sucre',            cat:'crepe',  prix:6.00,  cout:1.00,  pop:90,  label:'star',      reco:'✅ 83 % de marge. Star absolue. Systématiser : "Avec une chantilly maison ?"' },
      { n: 'Crêpe caramel beurre salé',     cat:'crepe',  prix:7.00,  cout:1.40,  pop:80,  label:'star',      reco:'✅ 80 % marge + "maison" = argument fort. Mettre en premier dans la liste desserts.' },
      { n: 'Crêpe chocolat maison',         cat:'crepe',  prix:7.00,  cout:1.50,  pop:75,  label:'star',      reco:'✅ 79 % marge. Excellent.' },
      { n: 'Supplément chantilly',          cat:'extra',  prix:2.50,  cout:0.40,  pop:40,  label:'star',      reco:'✅ 84 % marge = meilleur upsell de tout le groupe. Proposer systématiquement à chaque crêpe sucrée.' },
      { n: 'Supplément glace',              cat:'extra',  prix:2.50,  cout:0.70,  pop:35,  label:'star',      reco:'✅ 72 % marge. À systématiser. "Une boule de glace pour accompagner ?"' },
      { n: 'Galette Hippocampe Signature',  cat:'galette',prix:16.00, cout:4.80,  pop:65,  label:'star',      reco:'✅ 70 % marge + "saumon fumé maison" = justifie 18 €. +2 € = +3,2 k€/an à 25 ventes/j.' },
      { n: 'La Végétale',                   cat:'galette',prix:13.00, cout:3.20,  pop:55,  label:'star',      reco:'✅ 75 % marge = meilleure galette. Bien positionnée. Pousser pour la clientèle végé croissante.' },
      { n: 'La Normande',                   cat:'galette',prix:14.00, cout:3.80,  pop:70,  label:'star',      reco:'✅ 73 % marge. Andouille de Vire = produit local = argument qualitatif à mettre en avant.' },
      { n: 'La Complète Spianata',          cat:'galette',prix:12.00, cout:3.40,  pop:60,  label:'star',      reco:'✅ 72 % marge. Charcuterie italienne = originalité. Bien.' },
      { n: 'La Complète',                   cat:'galette',prix:10.00, cout:2.60,  pop:80,  label:'star',      reco:'✅ 74 % marge. Le plat le plus accessible = volume. Parfait pour les familles.' },
      { n: 'Supplément frites/salade',      cat:'extra',  prix:4.00,  cout:0.80,  pop:50,  label:'star',      reco:'✅ 80 % marge. Proposer systématiquement avec les galettes complètes.' },
      { n: 'Salade saumon fumé maison',     cat:'salade', prix:14.00, cout:4.60,  pop:40,  label:'plowhorse', reco:'⚠️ 67 % marge. Correct mais le saumon coûte cher. Surveiller le grammage.' },
      { n: 'Coupe 2 boules',               cat:'glace',  prix:5.00,  cout:1.30,  pop:45,  label:'star',      reco:'✅ 74 % marge. Proposer avec toutes les crêpes sucrées.' },
    ],
    actions: [
      { titre:'Script upsell suppléments systématique', gain:210, confiance:95, icon:'💬', desc:'"Avec une chantilly maison ?" sur chaque crêpe sucrée. Taux de prise estimé : 20 % → 45 %. Sur 60 crêpes sucrées/jour = +12 suppl. à 2,50 € = +30 €/jour.', fait:false },
      { titre:"Galette Signature à 18 € (+2 €)", gain:350, confiance:82, icon:'⬆️', desc:'Saumon fumé maison + recette signature = justifie 18 € (vs 16 € actuel). +2 € sur 25 ventes/jour = +50 €/jour = +350 €/semaine.', fait:false },
      { titre:'Menu crêperie 19 € (galette + crêpe + café)', gain:320, confiance:88, icon:'🍽️', desc:'Galette signature + crêpe sucrée + café = 19 € (valeur perçue 23 €). Ticket moyen actuel ~17 € → guidé à 19 €. Marge 69 %.', fait:false },
    ],
    gainTotal: 880,
  },
}

function marge(prix, cout) { return Math.round((1 - cout / prix) * 100) }
function labelColor(l) { return { star:'var(--green)', plowhorse:'var(--gold)', puzzle:'var(--blue)', dog:'var(--red)' }[l] || 'var(--muted)' }
function labelBg(l) { return { star:'var(--green-soft)', plowhorse:'var(--gold-soft)', puzzle:'var(--blue-soft)', dog:'var(--red-soft)' }[l] || 'var(--surface2)' }
function labelName(l) { return { star:'⭐ STAR', plowhorse:'🐄 OK', puzzle:'❓ ÉNIGME', dog:'🔴 ALERTE' }[l] || l }

export default function ProfitOptimizer({ toast }) {
  const [activeSite, setActiveSite] = useState('salicorne')
  const [activeTab, setActiveTab] = useState('carte')   // carte | actions | multisite | simulation
  const [openPlat, setOpenPlat] = useState(null)
  const [validated, setValidated] = useState({})
  const [filterCat, setFilterCat] = useState('all')

  const site = SITES[activeSite]
  const totalGain = Object.values(SITES).reduce((a, s) => a + s.gainTotal, 0)

  const cats = [...new Set(site.recettes.map(r => r.cat))]
  const filtered = filterCat === 'all' ? site.recettes : site.recettes.filter(r => r.cat === filterCat)

  function doAction(key, msg) {
    setValidated(v => ({ ...v, [key]: true }))
    toast(msg + ' ✓')
  }

  return (
    <div className="animate-pop">

      {/* ── Header ── */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontFamily: "'Fraunces',serif", fontWeight: 650, fontSize: 22, margin: '0 0 4px' }}>
          Profit & Menu Optimizer <span style={{ fontSize: 14, color: 'var(--copper)', fontFamily: 'Inter', fontWeight: 600 }}>V8</span>
        </h2>
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>Les Portes du Mont Saint Michel · données cartes réelles juillet 2026</div>
      </div>

      {/* ── Impact global ── */}
      <div style={{ background: 'linear-gradient(160deg,var(--surface2),var(--surface))', border:'1px solid var(--line)', borderRadius:16, padding:'16px 20px', marginBottom:14, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(420px 120px at 85% -20%,var(--copper-soft),transparent 70%)', pointerEvents:'none' }} />
        <div style={{ fontSize:11, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--muted)' }}>Impact potentiel estimé — groupe</div>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:44, fontWeight:650, color:'var(--copper)', lineHeight:1.15, fontVariantNumeric:'tabular-nums' }}>
          +{totalGain.toLocaleString('fr-FR')} €<span style={{ fontSize:22 }}>/semaine</span>
        </div>
        <div style={{ fontSize:12.5, color:'var(--muted)', marginTop:4 }}>
          soit <b style={{ color:'var(--green)' }}>+{(totalGain * 52 / 1000).toFixed(0)} k€/an</b> · ROI RestOS Enterprise : <b style={{ color:'var(--green)' }}>22×</b>
        </div>
        <div style={{ display:'flex', gap:16, marginTop:10, flexWrap:'wrap' }}>
          {Object.entries(SITES).map(([k, s]) => (
            <div key={k} style={{ fontSize:12.5 }}>
              <span style={{ fontWeight:700, color:s.color }}>{s.name}</span>
              <span style={{ color:'var(--muted)' }}> +{s.gainTotal.toLocaleString('fr-FR')} €/sem</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sélecteur de site ── */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        {Object.entries(SITES).map(([k, s]) => (
          <button key={k} onClick={() => { setActiveSite(k); setOpenPlat(null); setFilterCat('all') }} style={{
            flex:1, minWidth:110, padding:'11px 14px', borderRadius:12, fontWeight:700, fontSize:13.5,
            cursor:'pointer', transition:'all .15s', textAlign:'left',
            background: activeSite===k ? s.color : 'var(--surface)',
            color: activeSite===k ? '#fff' : 'var(--muted)',
            border: `1px solid ${activeSite===k ? s.color : 'var(--line)'}`
          }}>
            <div>{s.name}</div>
            <div style={{ fontSize:10.5, fontWeight:400, marginTop:2, opacity:.85 }}>{s.position}</div>
          </button>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display:'flex', background:'var(--surface)', border:'1px solid var(--line)', borderRadius:12, padding:3, marginBottom:14, gap:3 }}>
        {[['carte','🗺 Analyse carte'],['actions','⚡ Actions prioritaires'],['multisite','🏢 Multisite'],['simulation','📊 Simulation CA']].map(([k,l]) => (
          <button key={k} onClick={() => setActiveTab(k)} style={{
            flex:1, padding:'8px 0', borderRadius:9, fontSize:12.5, fontWeight:600, cursor:'pointer', transition:'all .15s',
            background: activeTab===k ? 'var(--copper)' : 'transparent',
            color: activeTab===k ? '#14100A' : 'var(--muted)'
          }}>{l}</button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB : ANALYSE CARTE */}
      {activeTab === 'carte' && (
        <div>
          {/* KPIs site */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:14 }}>
            {[
              { l:'Capacité', v:`${site.seats} couverts` },
              { l:'Ticket moyen', v:`~${site.ticket} €` },
              { l:'CA potentiel/j', v:`${(site.seats*0.75*site.ticket).toLocaleString('fr-FR')} €` },
            ].map(k => (
              <div key={k.l} style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:14, padding:'12px 14px' }}>
                <div style={{ fontSize:10.5, letterSpacing:'.1em', textTransform:'uppercase', color:'var(--muted)' }}>{k.l}</div>
                <div style={{ fontSize:18, fontWeight:700, marginTop:4 }}>{k.v}</div>
              </div>
            ))}
          </div>

          {/* Filtre catégories */}
          <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginBottom:10 }}>
            {['all', ...cats].map(c => (
              <button key={c} onClick={() => setFilterCat(c)} style={{
                fontSize:11.5, fontWeight:600, padding:'5px 11px', borderRadius:99, cursor:'pointer',
                background: filterCat===c ? 'var(--copper-soft)' : 'transparent',
                color: filterCat===c ? 'var(--copper)' : 'var(--muted)',
                border: `1px solid ${filterCat===c ? 'var(--copper)' : 'var(--line)'}`
              }}>{c === 'all' ? 'Tout' : c}</button>
            ))}
          </div>

          {/* Liste des plats */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:16, overflow:'hidden' }}>
            {filtered.map((r, i) => {
              const m = marge(r.prix, r.cout)
              const isOpen = openPlat === i
              return (
                <div key={i}>
                  <button onClick={() => setOpenPlat(isOpen ? null : i)} style={{
                    display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
                    width:'100%', textAlign:'left', cursor:'pointer',
                    borderBottom: isOpen ? 'none' : '1px dashed var(--line)',
                    background: isOpen ? 'var(--surface2)' : 'transparent',
                    transition:'background .15s'
                  }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:14 }}>{r.n}</div>
                      <div style={{ fontSize:12, color:'var(--muted)' }}>
                        Coût {r.cout.toFixed(2)} € · Vente {r.prix.toFixed(2)} € · {r.pop} ventes/sem estimées
                      </div>
                    </div>
                    <span style={{ fontSize:10.5, fontWeight:700, padding:'3px 9px', borderRadius:99, background:labelBg(r.label), color:labelColor(r.label), whiteSpace:'nowrap' }}>
                      {labelName(r.label)}
                    </span>
                    <span style={{ fontWeight:700, fontVariantNumeric:'tabular-nums', width:50, textAlign:'right', color: m>=70?'var(--green)':m>=63?'var(--gold)':'var(--red)', fontSize:15 }}>
                      {m} %
                    </span>
                    <span style={{ color:'var(--muted)', fontSize:14 }}>{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && (
                    <div style={{ padding:'14px 16px', background:'var(--surface2)', borderBottom:'1px dashed var(--line)', animation:'pop .15s ease' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:12 }}>
                        {[
                          ['Prix vente', `${r.prix.toFixed(2)} €`],
                          ['Coût matière', `${r.cout.toFixed(2)} €`],
                          ['Marge brute', `${m} %`],
                        ].map(([l,v]) => (
                          <div key={l} style={{ background:'var(--surface)', borderRadius:10, padding:'10px 12px' }}>
                            <div style={{ fontSize:10.5, color:'var(--muted)' }}>{l}</div>
                            <div style={{ fontSize:17, fontWeight:700, marginTop:3 }}>{v}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ background:`${labelBg(r.label)}`, border:`1px solid ${labelColor(r.label)}30`, borderLeft:`3px solid ${labelColor(r.label)}`, borderRadius:'0 10px 10px 0', padding:'10px 12px', fontSize:13, lineHeight:1.6 }}>
                        {r.reco}
                      </div>
                      <div style={{ marginTop:10, fontSize:12.5, color:'var(--muted)' }}>
                        Impact annuel si optimisé : <b style={{ color:'var(--green)' }}>+{Math.round(r.pop * 52 * (r.prix * 0.05)).toLocaleString('fr-FR')} €</b> estimés
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB : ACTIONS PRIORITAIRES */}
      {activeTab === 'actions' && (
        <div>
          <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:16, padding:'14px 16px', marginBottom:14 }}>
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:650, marginBottom:14 }}>
              ⚡ 3 actions prioritaires — {site.name}
            </div>
            {site.actions.map((a, i) => {
              const key = `${activeSite}_${i}`
              return (
                <div key={i} style={{ padding:'14px 0', borderBottom: i < site.actions.length-1 ? '1px dashed var(--line)' : 'none' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, marginBottom:8 }}>
                    <div style={{ fontWeight:700, fontSize:14.5 }}>{a.icon} {a.titre}</div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontWeight:700, color:'var(--green)', fontSize:15, fontVariantNumeric:'tabular-nums' }}>+{a.gain.toLocaleString('fr-FR')} €/sem</div>
                      <div style={{ fontSize:11, color:'var(--muted)' }}>confiance {a.confiance} %</div>
                    </div>
                  </div>
                  <div style={{ fontSize:13, color:'var(--muted)', lineHeight:1.6, marginBottom:10 }}>{a.desc}</div>
                  {!validated[key] ? (
                    <div style={{ display:'flex', gap:8 }}>
                      <button className="btn btn-green btn-sm" onClick={() => doAction(key, `${a.titre} — validé pour ${site.name}`)}>
                        ✔ Valider cette action
                      </button>
                      <button className="btn btn-ghost btn-sm">Modifier</button>
                    </div>
                  ) : (
                    <div style={{ color:'var(--green)', fontWeight:600, fontSize:13 }}>✅ Action validée — programmée</div>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ background:'var(--green-soft)', border:'1px solid rgba(76,154,106,.4)', borderRadius:14, padding:'14px 16px' }}>
            <div style={{ fontWeight:700, marginBottom:4 }}>Gain total si les 3 actions sont appliquées</div>
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:28, fontWeight:650, color:'var(--green)', fontVariantNumeric:'tabular-nums' }}>
              +{site.gainTotal.toLocaleString('fr-FR')} €/semaine
            </div>
            <div style={{ fontSize:12.5, color:'var(--muted)', marginTop:4 }}>soit +{(site.gainTotal * 52 / 1000).toFixed(0)} k€/an pour {site.name} seul</div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB : MULTISITE */}
      {activeTab === 'multisite' && (
        <div>
          <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:16, padding:'14px 16px', marginBottom:14 }}>
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:650, marginBottom:14 }}>Comparaison des 3 sites</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
              {Object.entries(SITES).map(([k, s]) => {
                const avgMarge = Math.round(s.recettes.reduce((a, r) => a + marge(r.prix, r.cout), 0) / s.recettes.length)
                const stars = s.recettes.filter(r => r.label === 'star').length
                const dogs = s.recettes.filter(r => r.label === 'dog').length
                return (
                  <div key={k} style={{ background: activeSite===k ? s.colorSoft : 'var(--surface2)', border:`1px solid ${activeSite===k ? s.color : 'var(--line)'}`, borderRadius:12, padding:'12px' }}>
                    <div style={{ fontWeight:700, color:s.color, marginBottom:10 }}>{s.name}</div>
                    {[
                      ['Marge moy.', `${avgMarge} %`],
                      ['Stars ⭐', `${stars} plats`],
                      ['Alertes 🔴', `${dogs} plat${dogs>1?'s':''}`],
                      ['Gain potentiel', `+${s.gainTotal.toLocaleString('fr-FR')} €`],
                      ['Ticket moyen', `~${s.ticket} €`],
                    ].map(([l, v]) => (
                      <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'3px 0', borderBottom:'1px dashed var(--line)' }}>
                        <span style={{ color:'var(--muted)' }}>{l}</span>
                        <span style={{ fontWeight:700 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Intelligence croisée */}
          <div style={{ background:'var(--copper-soft)', border:'1px solid rgba(208,139,60,.35)', borderRadius:14, padding:'14px 16px', marginBottom:10 }}>
            <div style={{ fontWeight:700, color:'var(--copper)', marginBottom:10 }}>🧠 Intelligence croisée — transferts recommandés</div>
            {[
              { de:"L'Hippocampe", vers:'La Salicorne', pratique:'Script upsell suppléments', gain:'+180 €/sem', desc:'La Salicorne peut systématiser "Un dessert pour finir ?" à chaque service. Taux de prise estimé +12 %.' },
              { de:'Le Pré Salé', vers:'La Salicorne', pratique:'Mise en avant du plat signature', gain:'+320 €/sem', desc:'L\'agneau au curry vert mérite le même traitement que l\'agneau de Pré-Salé : encadré, en tête de liste, storytelling.' },
              { de:"L'Hippocampe", vers:'Tout le groupe', pratique:'Communication circuits courts', gain:'Image', desc:'L\'Hippocampe communique sur Moulin de Moidrey, œufs Label Rouge. Les 2 autres sites doivent faire pareil (viandes françaises, produits normands).' },
            ].map((t, i) => (
              <div key={i} style={{ padding:'10px 0', borderBottom: i<2 ? '1px dashed rgba(208,139,60,.3)' : 'none' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <div style={{ fontWeight:600, fontSize:13.5 }}>{t.pratique}</div>
                  <span style={{ fontSize:12.5, color:'var(--green)', fontWeight:700 }}>{t.gain}</span>
                </div>
                <div style={{ fontSize:12, color:'var(--muted)', marginBottom:4 }}><b style={{ color:'var(--ink)' }}>{t.de}</b> → <b style={{ color:'var(--ink)' }}>{t.vers}</b></div>
                <div style={{ fontSize:12.5, color:'var(--ink)' }}>{t.desc}</div>
              </div>
            ))}
          </div>

          {/* Incohérence pricing */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:14, padding:'14px 16px' }}>
            <div style={{ fontWeight:700, marginBottom:10 }}>⚠️ Incohérences de pricing groupe</div>
            {[
              { plat:'Huîtres de Cancale (9 pièces)', salicorne:'18,50 €', presale:'21,50 €', action:'Salicorne → passer à 20,50 € (+190 €/sem)' },
              { plat:'Sélection fromages', salicorne:'12,00 €', presale:'12,00 €', action:'✓ Cohérent' },
              { plat:'Plat enfant', salicorne:'—', presale:'13,00 €', hippocampe:'10,00 €', action:'✓ Cohérent avec le positionnement' },
            ].map((p, i) => (
              <div key={i} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:8, padding:'8px 0', borderBottom:'1px dashed var(--line)', fontSize:12.5 }}>
                <span style={{ fontWeight:600 }}>{p.plat}</span>
                <span style={{ color:'var(--muted)' }}>Salicorne : {p.salicorne || '—'} · Pré Salé : {p.presale || '—'}</span>
                <span style={{ color: p.action.startsWith('✓') ? 'var(--green)' : 'var(--copper)', fontWeight:600 }}>{p.action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB : SIMULATION CA */}
      {activeTab === 'simulation' && (
        <div>
          <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:16, padding:'14px 16px', marginBottom:14 }}>
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:650, marginBottom:14 }}>Simulation CA groupe — juillet 2026 (pleine saison)</div>
            <div style={{ background:'var(--gold-soft)', border:'1px solid rgba(224,177,76,.4)', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:13 }}>
              📍 <b>Mont Saint Michel — juillet</b> : taux de remplissage estimé 85 % (site touristique majeur). Grande marée = +20 à +40 % de fréquentation ponctuellement.
            </div>
            {[
              { ...SITES.salicorne, key:'salicorne', fill:0.85, ticketActuel:24, ticketOpti:25.5, label:'La Salicorne' },
              { ...SITES.presale,  key:'presale',  fill:0.75, ticketActuel:52, ticketOpti:57, label:'Le Pré Salé' },
              { ...SITES.hippocampe, key:'hippocampe', fill:0.80, ticketActuel:17, ticketOpti:19, label:"L'Hippocampe" },
            ].map(s => {
              const couvJ = Math.round(s.seats * s.fill)
              const caActJ = couvJ * s.ticketActuel
              const caOptiJ = couvJ * s.ticketOpti
              const gainJ = caOptiJ - caActJ
              return (
                <div key={s.key} style={{ padding:'14px 0', borderBottom:'1px dashed var(--line)' }}>
                  <div style={{ fontWeight:700, color:s.color, fontSize:15, marginBottom:8 }}>{s.label}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:8 }}>
                    {[
                      ['Couverts/jour', `${couvJ} (${Math.round(s.fill*100)} %)`],
                      ['CA/jour actuel', `${caActJ.toLocaleString('fr-FR')} €`],
                      ['CA/jour optimisé', `${caOptiJ.toLocaleString('fr-FR')} €`],
                    ].map(([l,v]) => (
                      <div key={l} style={{ background:'var(--surface2)', borderRadius:10, padding:'10px 12px' }}>
                        <div style={{ fontSize:10.5, color:'var(--muted)' }}>{l}</div>
                        <div style={{ fontWeight:700, fontSize:14, marginTop:3 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize:13, color:'var(--green)', fontWeight:600 }}>
                    Gain journalier après optimisation : +{gainJ.toLocaleString('fr-FR')} € · soit +{(gainJ*7).toLocaleString('fr-FR')} €/semaine
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ background:'var(--green-soft)', border:'1px solid rgba(76,154,106,.4)', borderRadius:14, padding:'16px 18px' }}>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:8 }}>Récapitulatif groupe — semaine type juillet</div>
            {[
              ['CA groupe actuel (semaine)', '~132 000 €'],
              ['CA groupe après optimisations', '~140 000 €'],
              ['Gain hebdomadaire', '+8 000 €'],
              ['Gain annualisé', '+416 000 €'],
              ['Coût RestOS Enterprise/an', '~18 000 €'],
              ['ROI net', '+398 000 € · ratio 22×'],
            ].map(([l,v]) => (
              <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px dashed rgba(76,154,106,.3)', fontSize:13.5 }}>
                <span style={{ color:'var(--muted)' }}>{l}</span>
                <span style={{ fontWeight:700, color: l.includes('ROI') || l.includes('Gain') ? 'var(--green)' : 'var(--ink)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
