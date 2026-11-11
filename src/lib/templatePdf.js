// Il template del PDF della scheda: il nome del coach in testa e le sue «note
// aggiuntive» in fondo, uguali in tutti i suoi PDF (tabella `pdf_coach`,
// supabase/schema/pdf_coach_2026-11-11.sql; spec in
// docs/superpowers/specs/2026-11-11-template-pdf-design.md).
//
// Di chi è il template: del coach che ha CREATO il workout (`workouts.creato_da`),
// chiunque esporti. Se quella riga non si legge (un admin che ha scritto il
// workout di un atleta non suo, o un workout autonomo vecchio senza autore) si
// usa quella di chi esporta. Senza nessuna delle due: solo FLEOFIT, nessuna
// nota. Mai un nome inventato.
//
// 🔴 Il PDF si esporta SEMPRE: tabella assente (migrazione non applicata),
// errore o rete giù tornano «niente template», mai un'eccezione.
//
// ⚠️ Niente jspdf qui: `scriviNoteAggiuntive` riceve il doc già creato da chi
// ha caricato la libreria (WorkoutDetail, `caricaPdf`).

export const LIMITI_PDF = Object.freeze({ nome: 60, note: 600 })

const NIENTE = Object.freeze({ nome: null, note: null })
const tabellaAssente = (error) => !!error && (error.code === '42P01' || error.code === 'PGRST205')

const pulito = (testo, limite) => {
  const t = typeof testo === 'string' ? testo.trim() : ''
  return t ? t.slice(0, limite) : null
}

/** I valori da salvare: spazi tolti, vuoti = null, limiti come nel database. */
export function pulisciTemplate({ nome, note } = {}) {
  return {
    nome_firma: pulito(nome, LIMITI_PDF.nome),
    note_finali: pulito(note, LIMITI_PDF.note),
  }
}

/** Il template da usare per un PDF: quello del creatore, se no quello di chi esporta. */
export async function leggiTemplatePdf(supabase, { creatoDa, utente } = {}) {
  const ids = [...new Set([creatoDa, utente].filter(Boolean))]
  if (!ids.length) return NIENTE
  try {
    const { data, error } = await supabase
      .from('pdf_coach').select('coach_id, nome_firma, note_finali').in('coach_id', ids)
    if (error || !Array.isArray(data)) {
      if (error && !tabellaAssente(error)) console.error('Template PDF, lettura fallita:', error)
      return NIENTE
    }
    const riga = data.find(r => r.coach_id === creatoDa) || data.find(r => r.coach_id === utente)
    if (!riga) return NIENTE
    const { nome_firma, note_finali } = pulisciTemplate({ nome: riga.nome_firma, note: riga.note_finali })
    return { nome: nome_firma, note: note_finali }
  } catch (e) {
    console.error('Template PDF, lettura fallita:', e)
    return NIENTE
  }
}

/**
 * Per le Impostazioni: la riga del coach `uid`, e se la lettura è FALLITA.
 * Il foglio non deve aprirsi vuoto su una rete che cade: salvare il solo nome
 * cancellerebbe le note già salvate. Tabella assente non è un errore (il foglio
 * si apre, e il salvataggio dirà che manca).
 */
export async function leggiMioTemplatePdf(supabase, uid) {
  try {
    const { data, error } = await supabase
      .from('pdf_coach').select('coach_id, nome_firma, note_finali').in('coach_id', [uid])
    if (error) return { ...NIENTE, errore: !tabellaAssente(error) }
    const riga = (data || []).find(r => r.coach_id === uid)
    if (!riga) return { ...NIENTE, errore: false }
    const { nome_firma, note_finali } = pulisciTemplate({ nome: riga.nome_firma, note: riga.note_finali })
    return { nome: nome_firma, note: note_finali, errore: false }
  } catch {
    return { ...NIENTE, errore: true }
  }
}

/** Salva il template del coach `uid`. Torna `{ errore }`, null se è andata. */
export async function salvaTemplatePdf(supabase, uid, valori) {
  try {
    const { error } = await supabase.from('pdf_coach').upsert(
      { coach_id: uid, ...pulisciTemplate(valori), aggiornato_at: new Date().toISOString() },
      { onConflict: 'coach_id' },
    )
    if (!error) return { errore: null }
    if (tabellaAssente(error)) return { errore: 'Funzione non ancora attiva: manca la tabella nel database.' }
    // La RLS rifiuta: è demo@fleofit.it (il revisore App Store), che non scrive.
    if (error.code === '42501') return { errore: 'Questo account non può modificare il PDF delle schede.' }
    return { errore: error.message || 'Salvataggio non riuscito.' }
  } catch (e) {
    return { errore: e?.message || 'Salvataggio non riuscito.' }
  }
}

/** Quello che segue «FLEOFIT» in testa al PDF: « - Coach Mario Rossi», o niente. */
export function intestazioneCoach(nome) {
  const n = typeof nome === 'string' ? nome.trim() : ''
  return n ? ` - Coach ${n}` : ''
}

// Il glossario del PDF parte a y 240 mm (buildPDFDoc): la y restituita (fine del
// riquadro, aria compresa) non deve superarlo.
const FINE_UTILE = 240
// Le righe che stanno su una pagina nuova: 20 + 6 + righe × 5 + 6 ≤ 240. Oltre,
// il testo si tronca con «…» (600 caratteri con tanti a-capo sono ~300 righe).
const MAX_RIGHE = 41

/**
 * Disegna «NOTE AGGIUNTIVE» sul doc a partire da `y` e torna la nuova y.
 * Se non entra prima del glossario, va su una pagina nuova (scura come le altre).
 */
export function scriviNoteAggiuntive(doc, y, note) {
  const testo = typeof note === 'string' ? note.trim() : ''
  if (!testo) return y
  // Si spezza alla dimensione con cui si scrive: prima andava con quella
  // lasciata dal corpo, e le righe a 10 uscivano dal margine.
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  let righe = doc.splitTextToSize(testo, 165)
  if (righe.length > MAX_RIGHE) righe = [...righe.slice(0, MAX_RIGHE - 1), '…']
  // linea + titolo (6 + 6), le righe, l'aria finale (6): è la y che si restituisce.
  const altezza = 6 + 6 + righe.length * 5 + 6
  if (y + altezza > FINE_UTILE) {
    doc.addPage()
    doc.setFillColor(23, 23, 23)
    doc.rect(0, 0, 210, 297, 'F')
    y = 20
  } else {
    doc.setDrawColor(60, 60, 60)
    doc.line(20, y, 190, y)
    y += 6
  }
  doc.setTextColor(241, 186, 23)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('NOTE AGGIUNTIVE', 20, y)
  y += 6
  doc.setTextColor(200, 200, 200)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(righe, 20, y)
  return y + righe.length * 5 + 6
}
