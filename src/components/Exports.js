import { supabase } from '../lib/supabase'

// ═══════════════════════════════════════════════════════
// EXPORT EXCEL (CSV universel — ouvre dans Excel)
// ═══════════════════════════════════════════════════════
function downloadCSV(filename, rows, headers) {
  const BOM = '\uFEFF' // UTF-8 BOM pour Excel français
  const csv = BOM + [headers.join(';'), ...rows.map(r => r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ═══════════════════════════════════════════════════════
// EXPORT PDF (via impression navigateur)
// ═══════════════════════════════════════════════════════
function printPDF(title, htmlContent) {
  const win = window.open('', '_blank')
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Arial', sans-serif; font-size: 12px; color: #1a1a1a; padding: 30px; }
      h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; color: #0F1411; }
      h2 { font-size: 15px; font-weight: 700; margin: 20px 0 10px; border-bottom: 2px solid #D08B3C; padding-bottom: 5px; color: #D08B3C; }
      .meta { color: #666; font-size: 11px; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      th { background: #0F1411; color: #EFEAD9; padding: 8px 10px; text-align: left; font-size: 11px; letter-spacing: .05em; }
      td { padding: 7px 10px; border-bottom: 1px solid #e5e5e5; font-size: 11.5px; }
      tr:nth-child(even) td { background: #f9f9f9; }
      .good { color: #2d7a47; font-weight: 700; }
      .bad  { color: #b94b3a; font-weight: 700; }
      .warn { color: #b87d1a; font-weight: 700; }
      .total td { font-weight: 700; background: #f0f0f0; border-top: 2px solid #ccc; }
      .logo { font-size: 24px; font-weight: 900; color: #D08B3C; margin-bottom: 2px; }
      .footer { margin-top: 30px; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
      @media print { body { padding: 15px; } }
    </style>
  </head><body>${htmlContent}<div class="footer">Généré par RestOS · ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div></body></html>`)
  win.document.close()
  setTimeout(() => { win.print(); win.close() }, 500)
}

// ═══════════════════════════════════════════════════════
// EXPORT PLANNING
// ═══════════════════════════════════════════════════════
export async function exportPlanningExcel(restaurant) {
  const start = new Date()
  const end = new Date(start); end.setDate(end.getDate() + 6)
  const { data: shifts } = await supabase.from('shifts')
    .select('*, employees(first_name, last_name, role, hourly_rate)')
    .eq('restaurant_id', restaurant.id)
    .gte('shift_date', start.toISOString().split('T')[0])
    .lte('shift_date', end.toISOString().split('T')[0])
    .order('shift_date')

  const rows = (shifts || []).map(s => [
    new Date(s.shift_date).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'short' }),
    s.employees?.first_name + ' ' + s.employees?.last_name,
    s.employees?.role,
    s.service,
    s.start_time?.slice(0, 5),
    s.end_time?.slice(0, 5),
    s.status,
    s.employees?.hourly_rate ? (s.employees.hourly_rate * 8).toFixed(2) + ' €' : '—'
  ])

  downloadCSV(
    `RestOS_Planning_${restaurant.name}_${new Date().toISOString().split('T')[0]}.csv`,
    rows,
    ['Date', 'Employé', 'Poste', 'Service', 'Début', 'Fin', 'Statut', 'Coût estimé']
  )
}

export async function exportPlanningPDF(restaurant) {
  const start = new Date()
  const end = new Date(start); end.setDate(end.getDate() + 6)
  const { data: shifts } = await supabase.from('shifts')
    .select('*, employees(first_name, last_name, role)')
    .eq('restaurant_id', restaurant.id)
    .gte('shift_date', start.toISOString().split('T')[0])
    .lte('shift_date', end.toISOString().split('T')[0])
    .order('shift_date')

  const rows = (shifts || []).map(s =>
    `<tr><td>${new Date(s.shift_date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}</td>
    <td>${s.employees?.first_name} ${s.employees?.last_name}</td>
    <td>${s.employees?.role}</td>
    <td>${s.service}</td>
    <td>${s.start_time?.slice(0, 5)} – ${s.end_time?.slice(0, 5)}</td>
    <td>${s.status === 'planned' ? '📅 Planifié' : s.status === 'done' ? '✅ Effectué' : s.status}</td></tr>`
  ).join('')

  printPDF(`Planning ${restaurant.name}`, `
    <div class="logo">RestOS</div>
    <h1>Planning de la semaine</h1>
    <div class="meta">${restaurant.name} · ${restaurant.city} · Semaine du ${start.toLocaleDateString('fr-FR')} au ${end.toLocaleDateString('fr-FR')}</div>
    <table>
      <thead><tr><th>Date</th><th>Employé</th><th>Poste</th><th>Service</th><th>Horaires</th><th>Statut</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `)
}

// ═══════════════════════════════════════════════════════
// EXPORT P&L
// ═══════════════════════════════════════════════════════
export async function exportPnlExcel(restaurant) {
  const { data: pnl } = await supabase.from('daily_pnl').select('*')
    .eq('restaurant_id', restaurant.id)
    .order('report_date', { ascending: false }).limit(30)

  const rows = (pnl || []).map(r => [
    new Date(r.report_date).toLocaleDateString('fr-FR'),
    r.revenue?.toFixed(2),
    r.food_cost?.toFixed(2),
    r.labor_cost?.toFixed(2),
    r.fixed_costs?.toFixed(2),
    r.ebitda?.toFixed(2),
    r.ebitda_pct?.toFixed(1) + ' %'
  ])

  // Totaux
  const total_rev = (pnl || []).reduce((a, r) => a + (r.revenue || 0), 0)
  const total_eb = (pnl || []).reduce((a, r) => a + (r.ebitda || 0), 0)
  rows.push(['TOTAL', total_rev.toFixed(2), '', '', '', total_eb.toFixed(2), (total_eb / total_rev * 100).toFixed(1) + ' %'])

  downloadCSV(
    `RestOS_PnL_${restaurant.name}_${new Date().toISOString().split('T')[0]}.csv`,
    rows,
    ['Date', 'CA (€)', 'Food Cost (€)', 'Masse sal. (€)', 'Charges fixes (€)', 'EBITDA (€)', 'EBITDA %']
  )
}

export async function exportPnlPDF(restaurant) {
  const { data: pnl } = await supabase.from('daily_pnl').select('*')
    .eq('restaurant_id', restaurant.id)
    .order('report_date', { ascending: false }).limit(30)

  const total_rev = (pnl || []).reduce((a, r) => a + (r.revenue || 0), 0)
  const total_eb = (pnl || []).reduce((a, r) => a + (r.ebitda || 0), 0)

  const rows = (pnl || []).map(r => `
    <tr>
      <td>${new Date(r.report_date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}</td>
      <td>${r.revenue?.toLocaleString('fr-FR')} €</td>
      <td>${r.food_cost?.toLocaleString('fr-FR')} €</td>
      <td>${r.labor_cost?.toLocaleString('fr-FR')} €</td>
      <td class="${r.ebitda > 0 ? 'good' : 'bad'}">${r.ebitda?.toLocaleString('fr-FR')} €</td>
      <td class="${r.ebitda_pct > 15 ? 'good' : r.ebitda_pct > 8 ? 'warn' : 'bad'}">${r.ebitda_pct?.toFixed(1)} %</td>
    </tr>`).join('')

  printPDF(`P&L ${restaurant.name}`, `
    <div class="logo">RestOS</div>
    <h1>Compte de résultat — 30 derniers jours</h1>
    <div class="meta">${restaurant.name} · ${restaurant.city} · Généré le ${new Date().toLocaleDateString('fr-FR')}</div>
    <table>
      <thead><tr><th>Date</th><th>CA</th><th>Food Cost</th><th>Masse sal.</th><th>EBITDA</th><th>EBITDA %</th></tr></thead>
      <tbody>${rows}
      <tr class="total">
        <td>TOTAL 30 jours</td>
        <td>${total_rev.toLocaleString('fr-FR')} €</td><td>—</td><td>—</td>
        <td class="${total_eb > 0 ? 'good' : 'bad'}">${total_eb.toLocaleString('fr-FR')} €</td>
        <td class="${(total_eb / total_rev * 100) > 12 ? 'good' : 'warn'}">${(total_eb / total_rev * 100).toFixed(1)} %</td>
      </tr></tbody>
    </table>
  `)
}

// ═══════════════════════════════════════════════════════
// EXPORT FOOD COST
// ═══════════════════════════════════════════════════════
export async function exportFoodCostExcel(restaurant) {
  const { data: recipes } = await supabase.from('recipes').select('*')
    .eq('restaurant_id', restaurant.id).eq('is_active', true).order('category')

  const rows = (recipes || []).map(r => [
    r.name, r.category,
    r.selling_price?.toFixed(2),
    r.cost_price?.toFixed(2),
    r.margin_pct?.toFixed(1) + ' %',
    r.popularity,
    r.label,
    r.margin_pct >= 70 ? 'OK' : r.margin_pct >= 60 ? 'À surveiller' : 'ALERTE'
  ])

  downloadCSV(
    `RestOS_FoodCost_${restaurant.name}_${new Date().toISOString().split('T')[0]}.csv`,
    rows,
    ['Plat', 'Catégorie', 'Prix vente HT (€)', 'Coût matière (€)', 'Marge brute', 'Ventes/mois', 'Statut ME', 'Alerte']
  )
}

export async function exportFoodCostPDF(restaurant) {
  const { data: recipes } = await supabase.from('recipes').select('*')
    .eq('restaurant_id', restaurant.id).eq('is_active', true).order('margin_pct')

  const rows = (recipes || []).map(r => `
    <tr>
      <td><b>${r.name}</b></td>
      <td>${r.category}</td>
      <td>${r.selling_price?.toFixed(2)} €</td>
      <td>${r.cost_price?.toFixed(2)} €</td>
      <td class="${r.margin_pct >= 70 ? 'good' : r.margin_pct >= 60 ? 'warn' : 'bad'}">${r.margin_pct?.toFixed(1)} %</td>
      <td>${r.popularity}</td>
      <td>${r.label}</td>
    </tr>`).join('')

  const avg = (recipes || []).reduce((a, r) => a + (r.margin_pct || 0), 0) / Math.max((recipes || []).length, 1)

  printPDF(`Food Cost ${restaurant.name}`, `
    <div class="logo">RestOS</div>
    <h1>Analyse Food Cost — Fiches techniques</h1>
    <div class="meta">${restaurant.name} · ${restaurant.city} · ${(recipes || []).length} plats · Marge moyenne : ${avg.toFixed(1)} %</div>
    <table>
      <thead><tr><th>Plat</th><th>Catégorie</th><th>Prix vente</th><th>Coût matière</th><th>Marge</th><th>Ventes/mois</th><th>Statut</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `)
}

// ═══════════════════════════════════════════════════════
// EXPORT HACCP
// ═══════════════════════════════════════════════════════
export async function exportHaccpPDF(restaurant) {
  const [{ data: sensors }, { data: readings }, { data: checklists }] = await Promise.all([
    supabase.from('haccp_sensors').select('*').eq('restaurant_id', restaurant.id),
    supabase.from('haccp_readings').select('*, haccp_sensors(name)').eq('restaurant_id', restaurant.id).order('read_at', { ascending: false }).limit(100),
    supabase.from('haccp_checklists').select('*').eq('restaurant_id', restaurant.id).order('check_date', { ascending: false }).limit(30),
  ])

  const sensorRows = (sensors || []).map(s => `
    <tr><td>${s.name}</td><td>${s.type}</td><td>${s.min_temp}°C à ${s.max_temp}°C</td><td>${s.is_active ? '✅ Active' : '❌ Inactive'}</td></tr>`).join('')

  const readingRows = (readings || []).slice(0, 20).map(r => `
    <tr>
      <td>${new Date(r.read_at).toLocaleDateString('fr-FR')} ${new Date(r.read_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
      <td>${r.haccp_sensors?.name}</td>
      <td class="${r.is_alert ? 'bad' : 'good'}">${r.temperature}°C</td>
      <td>${r.is_alert ? '⚠️ ALERTE' : '✅ Normal'}</td>
    </tr>`).join('')

  printPDF(`Registre HACCP ${restaurant.name}`, `
    <div class="logo">RestOS</div>
    <h1>Registre HACCP — Dossier d'audit</h1>
    <div class="meta">${restaurant.name} · ${restaurant.city} · Période : ${new Date(Date.now() - 30 * 86400000).toLocaleDateString('fr-FR')} au ${new Date().toLocaleDateString('fr-FR')}</div>
    <h2>Sondes de température</h2>
    <table>
      <thead><tr><th>Enceinte</th><th>Type</th><th>Plage autorisée</th><th>Statut</th></tr></thead>
      <tbody>${sensorRows}</tbody>
    </table>
    <h2>Relevés de température (20 derniers)</h2>
    <table>
      <thead><tr><th>Date & heure</th><th>Enceinte</th><th>Température</th><th>Conformité</th></tr></thead>
      <tbody>${readingRows}</tbody>
    </table>
    <h2>Déclaration de conformité</h2>
    <p style="margin-top:10px;line-height:1.7">Le présent registre atteste que les contrôles de température ont été effectués conformément au Plan de Maîtrise Sanitaire (PMS) en vigueur dans l'établissement. Les données sont enregistrées automatiquement par le système RestOS et archivées de manière sécurisée.</p>
    <p style="margin-top:16px">Signature du responsable : _____________________________ Date : _____________</p>
  `)
}
