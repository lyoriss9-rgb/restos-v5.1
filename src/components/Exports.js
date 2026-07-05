import { supabase } from '../lib/supabase'

// ─── jsPDF chargé depuis CDN (pas de popup, vrai fichier .pdf) ───
async function getJsPDF() {
  if (window.jspdf) return window.jspdf.jsPDF
  await new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    s.onload = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
  return window.jspdf.jsPDF
}

// ─── Utilitaires PDF ───────────────────────────────────────────
function pdfHeader(doc, title, restaurant) {
  // Fond header
  doc.setFillColor(15, 20, 17)
  doc.rect(0, 0, 210, 28, 'F')
  // Logo RestOS
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(255, 255, 255)
  doc.text('Rest', 14, 17)
  doc.setTextColor(208, 139, 60)
  doc.text('OS', 33, 17)
  // Titre
  doc.setFontSize(13)
  doc.setTextColor(255, 255, 255)
  doc.text(title, 55, 17)
  // Restaurant + date
  doc.setFontSize(9)
  doc.setTextColor(152, 164, 145)
  doc.text(`${restaurant.name} · ${restaurant.city} · ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`, 14, 24)
  return 36 // y de départ
}

function pdfFooter(doc, pageH) {
  doc.setFillColor(240, 240, 240)
  doc.rect(0, pageH - 10, 210, 10, 'F')
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text(`Généré par RestOS · ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`, 14, pageH - 3)
  doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, 196, pageH - 3, { align: 'right' })
}

function tableRow(doc, y, cols, widths, isHeader = false, isEven = false) {
  const rowH = 8
  if (isHeader) {
    doc.setFillColor(15, 20, 17)
    doc.rect(14, y - 5, 182, rowH, 'F')
    doc.setTextColor(239, 234, 217)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
  } else {
    if (isEven) { doc.setFillColor(248, 248, 248); doc.rect(14, y - 5, 182, rowH, 'F') }
    doc.setTextColor(30, 30, 30)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
  }
  let x = 14
  cols.forEach((col, i) => {
    doc.text(String(col ?? '—'), x + 2, y, { maxWidth: widths[i] - 4 })
    x += widths[i]
  })
  return y + rowH
}

function download(doc, filename) {
  doc.save(filename)
}

// ═══════════════════════════════════════════════════════
// EXPORT CSV (Excel)
// ═══════════════════════════════════════════════════════
export function downloadCSV(filename, rows, headers) {
  const BOM = '\uFEFF'
  const csv = BOM + [headers.join(';'), ...rows.map(r =>
    r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';')
  )].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ═══════════════════════════════════════════════════════
// PLANNING — PDF & Excel
// ═══════════════════════════════════════════════════════
export async function exportPlanningPDF(restaurant) {
  const start = new Date()
  const end = new Date(start); end.setDate(end.getDate() + 6)
  const { data: shifts } = await supabase.from('shifts')
    .select('*, employees(first_name, last_name, role, hourly_rate)')
    .eq('restaurant_id', restaurant.id)
    .gte('shift_date', start.toISOString().split('T')[0])
    .lte('shift_date', end.toISOString().split('T')[0])
    .order('shift_date')

  const JsPDF = await getJsPDF()
  const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = 297, pageH = 210
  let y = pdfHeader(doc, 'Planning de la semaine', restaurant)

  // Période
  doc.setFontSize(10); doc.setTextColor(80, 80, 80); doc.setFont('helvetica', 'normal')
  doc.text(`Semaine du ${start.toLocaleDateString('fr-FR')} au ${end.toLocaleDateString('fr-FR')}`, 14, y)
  y += 10

  // Tableau
  const cols = ['Date', 'Employé', 'Poste', 'Service', 'Début', 'Fin', 'Statut', 'Coût estimé']
  const widths = [38, 42, 35, 25, 22, 22, 25, 30]
  y = tableRow(doc, y, cols, widths, true)

  if (!shifts || shifts.length === 0) {
    doc.setFontSize(10); doc.setTextColor(150, 150, 150)
    doc.text('Aucun shift planifié cette semaine.', 14, y + 6)
  } else {
    shifts.forEach((s, i) => {
      if (y > pageH - 20) { doc.addPage(); y = 20 }
      const emp = s.employees
      const heures = s.start_time && s.end_time
        ? (new Date(`2000-01-01T${s.end_time}`) - new Date(`2000-01-01T${s.start_time}`)) / 3600000
        : 8
      const cout = emp?.hourly_rate ? (emp.hourly_rate * heures).toFixed(2) + ' €' : '—'
      const statusLabel = { planned: '📅 Planifié', confirmed: '✅ Confirmé', done: '✔ Effectué', absent: '❌ Absent' }[s.status] || s.status
      y = tableRow(doc, y, [
        new Date(s.shift_date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' }),
        emp ? `${emp.first_name} ${emp.last_name}` : '—',
        emp?.role || '—',
        s.service || '—',
        s.start_time?.slice(0, 5) || '—',
        s.end_time?.slice(0, 5) || '—',
        statusLabel,
        cout
      ], widths, false, i % 2 === 0)
    })
  }

  // Total masse salariale
  if (shifts?.length) {
    const total = shifts.reduce((a, s) => {
      const h = s.start_time && s.end_time
        ? (new Date(`2000-01-01T${s.end_time}`) - new Date(`2000-01-01T${s.start_time}`)) / 3600000 : 8
      return a + (s.employees?.hourly_rate || 0) * h
    }, 0)
    y += 4
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(208, 139, 60)
    doc.text(`Coût total estimé de la semaine : ${total.toFixed(2)} €`, 14, y)
  }

  pdfFooter(doc, pageH)
  download(doc, `RestOS_Planning_${restaurant.name}_${start.toISOString().split('T')[0]}.pdf`)
}

export async function exportPlanningExcel(restaurant) {
  const start = new Date()
  const end = new Date(start); end.setDate(end.getDate() + 6)
  const { data: shifts } = await supabase.from('shifts')
    .select('*, employees(first_name, last_name, role, hourly_rate)')
    .eq('restaurant_id', restaurant.id)
    .gte('shift_date', start.toISOString().split('T')[0])
    .lte('shift_date', end.toISOString().split('T')[0])
    .order('shift_date')

  const rows = (shifts || []).map(s => {
    const h = s.start_time && s.end_time
      ? (new Date(`2000-01-01T${s.end_time}`) - new Date(`2000-01-01T${s.start_time}`)) / 3600000 : 8
    return [
      new Date(s.shift_date).toLocaleDateString('fr-FR'),
      s.employees ? `${s.employees.first_name} ${s.employees.last_name}` : '',
      s.employees?.role || '',
      s.service || '',
      s.start_time?.slice(0, 5) || '',
      s.end_time?.slice(0, 5) || '',
      s.status || '',
      s.employees?.hourly_rate ? (s.employees.hourly_rate * h).toFixed(2) + ' €' : '—'
    ]
  })
  downloadCSV(`RestOS_Planning_${restaurant.name}_${new Date().toISOString().split('T')[0]}.csv`, rows,
    ['Date', 'Employé', 'Poste', 'Service', 'Début', 'Fin', 'Statut', 'Coût estimé'])
}

// ═══════════════════════════════════════════════════════
// P&L — PDF & Excel
// ═══════════════════════════════════════════════════════
export async function exportPnlPDF(restaurant) {
  const { data: pnl } = await supabase.from('daily_pnl').select('*')
    .eq('restaurant_id', restaurant.id).order('report_date', { ascending: false }).limit(30)

  const JsPDF = await getJsPDF()
  const doc = new JsPDF({ unit: 'mm', format: 'a4' })
  const pageH = 297
  let y = pdfHeader(doc, 'Compte de résultat — 30 derniers jours', restaurant)

  const cols = ['Date', 'CA (€)', 'Food Cost (€)', 'Masse sal. (€)', 'Charges (€)', 'EBITDA (€)', 'EBITDA %']
  const widths = [30, 28, 30, 30, 28, 28, 28]
  y = tableRow(doc, y, cols, widths, true)

  const total_rev = (pnl || []).reduce((a, r) => a + (r.revenue || 0), 0)
  const total_eb = (pnl || []).reduce((a, r) => a + (r.ebitda || 0), 0)

  ;(pnl || []).forEach((r, i) => {
    if (y > pageH - 20) { doc.addPage(); y = 20 }
    const isGood = r.ebitda > 0
    doc.setTextColor(isGood ? 45 : 185, isGood ? 122 : 75, isGood ? 71 : 63)
    y = tableRow(doc, y, [
      new Date(r.report_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      r.revenue?.toLocaleString('fr-FR') || '0',
      r.food_cost?.toLocaleString('fr-FR') || '0',
      r.labor_cost?.toLocaleString('fr-FR') || '0',
      r.fixed_costs?.toLocaleString('fr-FR') || '0',
      r.ebitda?.toLocaleString('fr-FR') || '0',
      (r.ebitda_pct?.toFixed(1) || '0') + ' %'
    ], widths, false, i % 2 === 0)
    doc.setTextColor(30, 30, 30)
  })

  y += 6
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
  doc.setFillColor(208, 139, 60, 0.2)
  doc.setTextColor(208, 139, 60)
  doc.text(`TOTAL 30 jours — CA : ${total_rev.toLocaleString('fr-FR')} € · EBITDA : ${total_eb.toLocaleString('fr-FR')} € (${(total_eb / total_rev * 100).toFixed(1)} %)`, 14, y)

  pdfFooter(doc, pageH)
  download(doc, `RestOS_PnL_${restaurant.name}_${new Date().toISOString().split('T')[0]}.pdf`)
}

export async function exportPnlExcel(restaurant) {
  const { data: pnl } = await supabase.from('daily_pnl').select('*')
    .eq('restaurant_id', restaurant.id).order('report_date', { ascending: false }).limit(30)
  const rows = (pnl || []).map(r => [
    new Date(r.report_date).toLocaleDateString('fr-FR'),
    r.revenue?.toFixed(2), r.food_cost?.toFixed(2), r.labor_cost?.toFixed(2),
    r.fixed_costs?.toFixed(2), r.ebitda?.toFixed(2), r.ebitda_pct?.toFixed(1) + ' %'
  ])
  const total_rev = (pnl || []).reduce((a, r) => a + (r.revenue || 0), 0)
  const total_eb = (pnl || []).reduce((a, r) => a + (r.ebitda || 0), 0)
  rows.push(['TOTAL', total_rev.toFixed(2), '', '', '', total_eb.toFixed(2), (total_eb / total_rev * 100).toFixed(1) + ' %'])
  downloadCSV(`RestOS_PnL_${restaurant.name}_${new Date().toISOString().split('T')[0]}.csv`, rows,
    ['Date', 'CA (€)', 'Food Cost (€)', 'Masse sal. (€)', 'Charges fixes (€)', 'EBITDA (€)', 'EBITDA %'])
}

// ═══════════════════════════════════════════════════════
// FOOD COST — PDF & Excel
// ═══════════════════════════════════════════════════════
export async function exportFoodCostPDF(restaurant) {
  const { data: recipes } = await supabase.from('recipes').select('*')
    .eq('restaurant_id', restaurant.id).eq('is_active', true).order('margin_pct')

  const JsPDF = await getJsPDF()
  const doc = new JsPDF({ unit: 'mm', format: 'a4' })
  const pageH = 297
  let y = pdfHeader(doc, 'Analyse Food Cost — Fiches techniques', restaurant)

  const avg = (recipes || []).reduce((a, r) => a + (r.margin_pct || 0), 0) / Math.max((recipes || []).length, 1)
  doc.setFontSize(10); doc.setTextColor(80, 80, 80); doc.setFont('helvetica', 'normal')
  doc.text(`${(recipes || []).length} plats actifs · Marge moyenne : ${avg.toFixed(1)} %`, 14, y); y += 10

  const cols = ['Plat', 'Catégorie', 'Prix vente HT', 'Coût matière', 'Marge', 'Ventes/mois', 'Statut']
  const widths = [48, 28, 28, 28, 22, 26, 22]
  y = tableRow(doc, y, cols, widths, true)

  ;(recipes || []).forEach((r, i) => {
    if (y > pageH - 20) { doc.addPage(); y = 20 }
    const m = r.margin_pct || 0
    const color = m >= 70 ? [45, 122, 71] : m >= 60 ? [184, 125, 26] : [185, 75, 63]
    doc.setTextColor(...color)
    const statusLabel = { star: '⭐ Star', plowhorse: '🐄 Vache', puzzle: '❓ Énigme', dog: '⚠️ Alerte' }[r.label] || r.label
    y = tableRow(doc, y, [
      r.name, r.category,
      r.selling_price?.toFixed(2) + ' €',
      r.cost_price?.toFixed(2) + ' €',
      m.toFixed(1) + ' %',
      String(r.popularity || 0),
      statusLabel
    ], widths, false, i % 2 === 0)
    doc.setTextColor(30, 30, 30)
  })

  pdfFooter(doc, pageH)
  download(doc, `RestOS_FoodCost_${restaurant.name}_${new Date().toISOString().split('T')[0]}.pdf`)
}

export async function exportFoodCostExcel(restaurant) {
  const { data: recipes } = await supabase.from('recipes').select('*')
    .eq('restaurant_id', restaurant.id).eq('is_active', true).order('category')
  const rows = (recipes || []).map(r => [
    r.name, r.category,
    r.selling_price?.toFixed(2), r.cost_price?.toFixed(2),
    r.margin_pct?.toFixed(1) + ' %', r.popularity,
    r.label, r.margin_pct >= 70 ? 'OK' : r.margin_pct >= 60 ? 'À surveiller' : 'ALERTE'
  ])
  downloadCSV(`RestOS_FoodCost_${restaurant.name}_${new Date().toISOString().split('T')[0]}.csv`, rows,
    ['Plat', 'Catégorie', 'Prix vente HT (€)', 'Coût matière (€)', 'Marge brute', 'Ventes/mois', 'Statut ME', 'Alerte'])
}

// ═══════════════════════════════════════════════════════
// HACCP — PDF
// ═══════════════════════════════════════════════════════
export async function exportHaccpPDF(restaurant) {
  const [{ data: sensors }, { data: readings }] = await Promise.all([
    supabase.from('haccp_sensors').select('*').eq('restaurant_id', restaurant.id),
    supabase.from('haccp_readings').select('*, haccp_sensors(name)').eq('restaurant_id', restaurant.id)
      .order('read_at', { ascending: false }).limit(50),
  ])

  const JsPDF = await getJsPDF()
  const doc = new JsPDF({ unit: 'mm', format: 'a4' })
  const pageH = 297
  let y = pdfHeader(doc, 'Registre HACCP — Dossier d\'audit', restaurant)

  doc.setFontSize(10); doc.setTextColor(80, 80, 80); doc.setFont('helvetica', 'normal')
  doc.text(`Période : ${new Date(Date.now() - 30 * 86400000).toLocaleDateString('fr-FR')} au ${new Date().toLocaleDateString('fr-FR')}`, 14, y); y += 10

  // Sondes
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(208, 139, 60)
  doc.text('Enceintes frigorifiques', 14, y); y += 6
  const sCols = ['Enceinte', 'Type', 'Plage autorisée', 'Statut']
  const sWidths = [65, 40, 50, 27]
  y = tableRow(doc, y, sCols, sWidths, true)
  ;(sensors || []).forEach((s, i) => {
    y = tableRow(doc, y, [s.name, s.type, `${s.min_temp}°C à ${s.max_temp}°C`, s.is_active ? '✅ Active' : '❌ Inactive'], sWidths, false, i % 2 === 0)
  })

  y += 8
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(208, 139, 60)
  doc.text('Relevés de température', 14, y); y += 6
  const rCols = ['Date & heure', 'Enceinte', 'Température', 'Conformité']
  const rWidths = [52, 60, 35, 35]
  y = tableRow(doc, y, rCols, rWidths, true)
  ;(readings || []).slice(0, 20).forEach((r, i) => {
    if (y > pageH - 20) { doc.addPage(); y = 20 }
    const isAlert = r.is_alert
    doc.setTextColor(isAlert ? 185 : 45, isAlert ? 75 : 122, isAlert ? 63 : 71)
    y = tableRow(doc, y, [
      new Date(r.read_at).toLocaleDateString('fr-FR') + ' ' + new Date(r.read_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      r.haccp_sensors?.name || '—',
      r.temperature + '°C',
      isAlert ? '⚠️ HORS NORME' : '✅ Conforme'
    ], rWidths, false, i % 2 === 0)
    doc.setTextColor(30, 30, 30)
  })

  // Déclaration
  y += 12
  if (y > pageH - 40) { doc.addPage(); y = 20 }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(208, 139, 60)
  doc.text('Déclaration de conformité', 14, y); y += 7
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 60, 60)
  const declaration = "Le présent registre atteste que les contrôles de température ont été effectués conformément au Plan de Maîtrise Sanitaire (PMS) en vigueur dans l'établissement. Les données sont enregistrées automatiquement par le système RestOS et archivées de manière sécurisée."
  const lines = doc.splitTextToSize(declaration, 182)
  doc.text(lines, 14, y); y += lines.length * 5 + 10
  doc.text(`Signature du responsable : _____________________________     Date : _______________`, 14, y)

  pdfFooter(doc, pageH)
  download(doc, `RestOS_HACCP_${restaurant.name}_${new Date().toISOString().split('T')[0]}.pdf`)
}

// ═══════════════════════════════════════════════════════
// DEVIS FOURNISSEUR — PDF
// ═══════════════════════════════════════════════════════
export async function exportDevisPDF(restaurant, devis) {
  // devis = { supplier, items: [{name, qty, unit, unit_price}], notes, valid_until }
  const JsPDF = await getJsPDF()
  const doc = new JsPDF({ unit: 'mm', format: 'a4' })
  const pageH = 297
  let y = pdfHeader(doc, 'Demande de devis', restaurant)

  // Infos fournisseur
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30)
  doc.text('Fournisseur', 14, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(80, 80, 80)
  doc.text(devis.supplier?.name || '—', 14, y + 6)
  if (devis.supplier?.email) doc.text(devis.supplier.email, 14, y + 12)
  if (devis.supplier?.phone) doc.text(devis.supplier.phone, 14, y + 18)

  // Numéro de devis + date
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(208, 139, 60)
  const num = `DEV-${Date.now().toString().slice(-6)}`
  doc.text(`Devis n° ${num}`, 130, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 80, 80)
  doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, 130, y + 7)
  if (devis.valid_until) doc.text(`Valide jusqu'au : ${new Date(devis.valid_until).toLocaleDateString('fr-FR')}`, 130, y + 13)
  y += 28

  // Tableau des articles
  const cols = ['Désignation', 'Quantité', 'Unité', 'Prix unitaire HT', 'Total HT']
  const widths = [70, 25, 22, 35, 30]
  y = tableRow(doc, y, cols, widths, true)

  let totalHT = 0
  ;(devis.items || []).forEach((item, i) => {
    const total = (item.qty || 0) * (item.unit_price || 0)
    totalHT += total
    y = tableRow(doc, y, [
      item.name, String(item.qty), item.unit,
      item.unit_price?.toFixed(2) + ' €',
      total.toFixed(2) + ' €'
    ], widths, false, i % 2 === 0)
  })

  // Total
  y += 4
  doc.setFillColor(15, 20, 17)
  doc.rect(130, y - 4, 66, 12, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(239, 234, 217)
  doc.text('TOTAL HT', 133, y + 3)
  doc.setTextColor(208, 139, 60)
  doc.text(totalHT.toFixed(2) + ' €', 192, y + 3, { align: 'right' })
  y += 18

  // TVA
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100, 100, 100)
  doc.text('TVA (10 %) : ' + (totalHT * 0.1).toFixed(2) + ' €', 130, y)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 30, 30)
  doc.text('TOTAL TTC : ' + (totalHT * 1.1).toFixed(2) + ' €', 130, y + 7)
  y += 20

  // Notes
  if (devis.notes) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(80, 80, 80)
    doc.text('Notes :', 14, y); y += 6
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    const lines = doc.splitTextToSize(devis.notes, 182)
    doc.text(lines, 14, y); y += lines.length * 5 + 6
  }

  // Conditions
  y += 4
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(150, 150, 150)
  doc.text(`Conditions de paiement : ${restaurant.payment_terms || 30} jours · Livraison souhaitée : dès accord`, 14, y)

  pdfFooter(doc, pageH)
  download(doc, `RestOS_Devis_${devis.supplier?.name || 'fournisseur'}_${num}.pdf`)
  return num // retourne le numéro de devis
}
