import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Copilote({ restaurant, toast, onOpenChat }) {
  const [savings, setSavings] = useState(0)
  const [reviews, setReviews] = useState([])
  const [forecasts, setForecasts] = useState([])
  const [actions, setActions] = useState({ t1:false, t2:false, t3:false, t4:false })

  useEffect(() => {
    // Compteur animé
    let start = 0; const target = 2847
    const iv = setInterval(() => {
      start += Math.ceil((target - start) / 8)
      setSavings(Math.min(start, target))
      if (start >= target) clearInterval(iv)
    }, 50)
    loadData()
    return () => clearInterval(iv)
  }, [])

  async function loadData() {
    const { data: rv } = await supabase.from('reviews').select('rating,content,author_name').eq('restaurant_id', restaurant.id).is('replied_at', null).limit(3)
    setReviews(rv || [])
    const { data: fc } = await supabase.from('forecasts').select('forecast_date,predicted_value').eq('restaurant_id', restaurant.id).eq('forecast_type','revenue').gte('forecast_date', new Date().toISOString().split('T')[0]).limit(3)
    setForecasts(fc || [])
  }

  function doAction(key, msg) {
    setActions(a => ({ ...a, [key]: true }))
    toast(msg)
  }

  const tickets = [
    { key:'t1', icon:'🌡️', bg:'var(--red-soft)', title:'Chambre froide n°2 : dérive détectée', sub:'5,1 °C cette nuit (seuil 4 °C). Gambas et crème à risque.', gain:'-420 €', gainColor:'var(--red)', btnLabel:'Déclencher l\'intervention', msg:'Technicien contacté — intervention 11h30. Registre HACCP mis à jour ✓' },
    { key:'t2', icon:'📦', bg:'var(--gold-soft)', title:'Beurre AOP +12 % chez Metro', sub:'Impact : 6 recettes, -310 €/mois. Alternative Transgourmet identifiée à -9 %.', gain:'-310 €/mois', gainColor:'var(--gold)', btnLabel:'Demander le devis', msg:'Devis Transgourmet demandé par l\'agent Achats ✓' },
    { key:'t3', icon:'📅', bg:'var(--green-soft)', title:'Samedi : pic prévu +18 %', sub:'Festival Vieux-Port + météo 26°C. Sous-staffing salle 19h–22h détecté.', gain:'+780 €', gainColor:'var(--green)', btnLabel:'Ajouter le renfort', msg:'Renfort Léa (extra) ajouté — planning republié à l\'équipe ✓' },
    { key:'t4', icon:'🍽️', bg:'var(--copper-soft)', title:'Risotto gambas : marge à 58 %', sub:'Cible 70 %. Deux options chiffrées disponibles dans Food Cost.', gain:'+250 €/mois', gainColor:'var(--copper)', btnLabel:'Voir l\'analyse', msg:'Ouverture de l\'analyse Food Cost…' },
  ]

  return (
    <div className="animate-pop">
      {/* Compteur */}
      <div className="counter">
        <div className="counter-label">Économies attribuées à RestOS — ce mois</div>
        <div className="counter-value">{savings.toLocaleString('fr-FR')} €</div>
        <div className="counter-sub">soit <b>+4,1 pts de marge</b> vs juin N-1 · abonnement remboursé <b>27×</b></div>
      </div>

      {/* Déjà fait cette nuit */}
      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ fontWeight:600, marginBottom:6, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span>Fait cette nuit par vos agents</span>
          <span className="pill pill-blue">{restaurant.plan}</span>
        </div>
        <div style={{ fontSize:13, color:'var(--muted)', lineHeight:1.7 }}>
          ✓ P&L d'hier clôturé &nbsp;·&nbsp; ✓ {reviews.length} avis répondus &nbsp;·&nbsp; ✓ Story Instagram publiée &nbsp;·&nbsp; ✓ Dérive CF2 consignée
        </div>
      </div>

      {/* Prévision rapide */}
      {forecasts.length > 0 && (
        <div className="card" style={{ marginBottom:14 }}>
          <div style={{ fontWeight:600, marginBottom:8 }}>Prévision CA — 3 prochains jours</div>
          <div style={{ display:'flex', gap:8 }}>
            {forecasts.map((f,i) => (
              <div key={i} style={{ flex:1, background:'var(--surface2)', borderRadius:10, padding:'10px 12px', textAlign:'center' }}>
                <div style={{ fontSize:11, color:'var(--muted)', marginBottom:3 }}>
                  {new Date(f.forecast_date).toLocaleDateString('fr-FR',{weekday:'short'})}
                </div>
                <div style={{ fontWeight:700, fontSize:16, fontVariantNumeric:'tabular-nums' }}>
                  {(f.predicted_value/1000).toFixed(1).replace('.',',')} k€
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Brief du matin */}
      <h2 style={{ fontFamily:"'Fraunces',serif", fontWeight:650, fontSize:19, margin:'22px 0 10px' }}>
        Brief du matin <span style={{ color:'var(--muted)', fontSize:12.5, fontFamily:'Inter', fontWeight:500, marginLeft:8 }}>4 décisions · 3 min</span>
      </h2>

      {tickets.map(tk => (
        <div key={tk.key} className="card" style={{ marginBottom:10 }}>
          <div className="ticket">
            <div className="ticket-icon" style={{ background: tk.bg }}>{tk.icon}</div>
            <div className="ticket-body">
              <div className="ticket-title">{tk.title}</div>
              <div className="ticket-sub">
                {tk.sub} <span style={{ fontWeight:700, color: tk.gainColor }}>{tk.gain}</span>
              </div>
              {!actions[tk.key] ? (
                <div className="actions">
                  <button className="btn btn-copper btn-sm" onClick={() => doAction(tk.key, tk.msg)}>{tk.btnLabel}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => doAction(tk.key, 'Reporté — rappel programmé.')}>Plus tard</button>
                </div>
              ) : (
                <div className="done-badge">✓ {tk.msg}</div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* CTA Directeur */}
      <div className="card" style={{ textAlign:'center', padding:'20px 16px', marginTop:8 }}>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:17, marginBottom:6 }}>Une question sur votre restaurant ?</div>
        <div style={{ color:'var(--muted)', fontSize:13, marginBottom:14 }}>Le Directeur IA répond avec vos vraies données Supabase en temps réel.</div>
        <button className="btn btn-copper" onClick={onOpenChat}>🎩 Parler au Directeur</button>
      </div>
    </div>
  )
}
