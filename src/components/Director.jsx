import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SUGGESTIONS = [
  "Pourquoi mon food cost a baissé ?",
  "Où puis-je économiser 1 000 € ce mois-ci ?",
  "Et si j'ouvrais le dimanche soir ?",
  "Que fais-tu automatiquement sans me demander ?",
]

export default function Director({ restaurant, onClose }) {
  const [msgs, setMsgs] = useState([
    { role:'assistant', content:`Bonjour 👋 Je suis votre directeur d'exploitation virtuel pour **${restaurant.name}**. Posez-moi n'importe quelle question sur votre restaurant.` }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState(null)
  const msgsRef = useRef(null)

  useEffect(() => { loadContext() }, [])
  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight
  }, [msgs])

  async function loadContext() {
    const rid = restaurant.id
    const [pnl, recipes, reviews] = await Promise.all([
      supabase.from('daily_pnl').select('report_date,revenue,ebitda,ebitda_pct').eq('restaurant_id',rid).order('report_date',{ascending:false}).limit(7),
      supabase.from('recipes').select('name,selling_price,cost_price,margin_pct,popularity,label').eq('restaurant_id',rid),
      supabase.from('reviews').select('rating,content,sentiment').eq('restaurant_id',rid).limit(5),
    ])
    setContext({
      restaurant: { name: restaurant.name, city: restaurant.city, seats: restaurant.seats, plan: restaurant.plan },
      pnl: pnl.data || [],
      recipes: recipes.data || [],
      reviews: reviews.data || [],
    })
  }

  async function send(text) {
    if (!text.trim() || loading) return
    setMsgs(m => [...m, { role:'user', content: text }])
    setInput('')
    setLoading(true)
    setMsgs(m => [...m, { role:'assistant', content:'' }])

    try {
      const systemPrompt = `Tu es le Directeur d'exploitation virtuel de ${restaurant.name} à ${restaurant.city}. Réponds en français, de façon concise et chiffrée. Max 150 mots.
DONNÉES : ${context ? JSON.stringify(context) : 'chargement...'}`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 400,
          stream: true,
          system: systemPrompt,
          messages: msgs.concat({ role:'user', content:text }).map(m => ({ role:m.role, content:m.content }))
        })
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.delta?.text) {
              full += data.delta.text
              setMsgs(m => m.map((msg,i) => i===m.length-1 ? {...msg, content:full} : msg))
            }
          } catch {}
        }
      }
    } catch {
      setMsgs(m => m.map((msg,i) => i===m.length-1 ? {...msg, content:'⚠️ Erreur IA. Vérifiez votre clé Anthropic dans Vercel.'} : msg))
    }
    setLoading(false)
  }

  function renderContent(text) {
    return text.split('**').map((p,i) => i%2===1 ? <b key={i}>{p}</b> : p)
  }

  return (
    <div onClick={e => e.target===e.currentTarget && onClose()} style={{
      position:'fixed', inset:0, background:'rgba(10,14,11,.7)', backdropFilter:'blur(4px)',
      zIndex:30, display:'flex', alignItems:'flex-end', justifyContent:'center'
    }}>
      <div style={{
        background:'var(--surface)', border:'1px solid var(--line)',
        borderRadius:'18px 18px 0 0', width:'100%', maxWidth:560, maxHeight:'82vh',
        display:'flex', flexDirection:'column', animation:'slideup .25s ease'
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 18px', borderBottom:'1px solid var(--line)' }}>
          <div>
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:650 }}>Le Directeur</div>
            <div style={{ color:'var(--muted)', fontSize:11.5 }}>IA réelle · {context ? `${context.recipes.length} plats · ${context.pnl.length}j d'historique` : 'Chargement…'}</div>
          </div>
          <button onClick={onClose} style={{ fontSize:20, color:'var(--muted)' }}>✕</button>
        </div>

        <div ref={msgsRef} style={{ flex:1, overflowY:'auto', padding:'16px 18px', display:'flex', flexDirection:'column', gap:10 }}>
          {msgs.map((m,i) => (
            <div key={i} className={`msg ${m.role==='user'?'msg-user':'msg-bot'}`} style={{ alignSelf:m.role==='user'?'flex-end':'flex-start' }}>
              {loading && i===msgs.length-1 && !m.content ? <span className="cursor"/> : renderContent(m.content)}
            </div>
          ))}
        </div>

        {msgs.length === 1 && (
          <div style={{ padding:'0 18px 10px', display:'flex', gap:7, flexWrap:'wrap' }}>
            {SUGGESTIONS.map((s,i) => (
              <button key={i} onClick={() => send(s)} style={{
                border:'1px solid var(--line)', background:'var(--surface2)', color:'var(--ink)',
                borderRadius:99, padding:'7px 12px', fontSize:12.5, fontWeight:500, cursor:'pointer'
              }}>{s}</button>
            ))}
          </div>
        )}

        <div style={{ padding:'10px 18px 16px', borderTop:'1px solid var(--line)', display:'flex', gap:8 }}>
          <input className="input" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key==='Enter' && send(input)}
            placeholder="Posez une question…" disabled={loading} style={{ flex:1 }} />
          <button className="btn btn-copper" onClick={() => send(input)} disabled={loading || !input.trim()}>
            {loading ? '…' : '→'}
          </button>
        </div>
      </div>
    </div>
  )
}
