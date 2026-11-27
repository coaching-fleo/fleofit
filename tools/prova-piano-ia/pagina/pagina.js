// Pagina di prova SOLO LOCALE del piano IA (fase 0). Usa la logica vera di
// src/lib/pianoIA e i programmi INVENTATI del banco: nessuna IA, nessun dato vero.

import { validaRisposte, controlloSicurezza, profiloPerIA, DOMANDE_SICUREZZA } from '../../../src/lib/pianoIA/questionario.js'
import { scegliProgramma } from '../../../src/lib/pianoIA/programmi.js'
import { validaSeduta } from '../../../src/lib/pianoIA/validaSeduta.js'
import { riassuntoFeedback, allarmi } from '../../../src/lib/pianoIA/riassunto.js'
import { PROGRAMMI } from '../programmi.mjs'
import { CASI } from '../casi.mjs'

const oggi = new Date()
const iso = (d) => d.toISOString().slice(0, 10)
const giorniFa = (n) => iso(new Date(oggi.getTime() - n * 86400000))
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

const STAZIONI = ['SkiErg', 'Sled Push', 'Sled Pull', 'Burpees Broad Jumps', 'Rowing', 'Farmers Carry', 'Sandbag Lunges', 'Wall Balls']
const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
const FASI = { base: 'Base', costruzione: 'Costruzione', scarico: 'Scarico', specifico: 'Specifico', gara: 'Gara' }
const LIVELLI = { principiante: 'Principiante', intermedio: 'Intermedio', avanzato: 'Avanzato' }

// ── Il questionario ─────────────────────────────────────────────────────────

const pillola = (tipo, nome, valore, testo, spunta = false) =>
  `<label class="pillola"><input type="${tipo}" name="${nome}" value="${esc(valore)}" ${spunta ? 'checked' : ''}><span>${esc(testo)}</span></label>`
const numeroCampo = (nome, testo, extra = '') =>
  `<label class="campo">${testo}<input type="number" name="${nome}" ${extra}></label>`

document.getElementById('questionario').innerHTML = `
  <h2>Il questionario <span class="grigio">— 11 domande</span></h2>
  <fieldset><legend>1 · Obiettivo</legend><div class="riga">
    ${pillola('radio', 'obiettivo', 'prima_gara', 'La mia prima Hyrox')}
    ${pillola('radio', 'obiettivo', 'migliorare', 'Migliorare il tempo', true)}
    ${pillola('radio', 'obiettivo', 'senza_gara', 'Allenarmi senza gara')}
  </div></fieldset>
  <fieldset id="campoGara"><legend>2 · La gara</legend><div class="riga">
    <label class="campo">Data<input type="date" name="garaData"></label>
  </div></fieldset>
  <fieldset><legend>3 · Categoria</legend><div class="riga">
    ${pillola('radio', 'divisione', 'open', 'Open', true)}${pillola('radio', 'divisione', 'pro', 'Pro')}
    ${pillola('radio', 'formato', 'singolo', 'Singolo', true)}${pillola('radio', 'formato', 'doppio', 'Doppio')}${pillola('radio', 'formato', 'staffetta', 'Staffetta')}
    ${pillola('radio', 'sesso', 'uomo', 'Uomo', true)}${pillola('radio', 'sesso', 'donna', 'Donna')}
  </div></fieldset>
  <fieldset><legend>4 · Tempi Hyrox <small>(facoltativi, minuti)</small></legend><div class="riga">
    ${numeroCampo('tempoObiettivoMin', 'Obiettivo', 'min="40" max="200"')}
    ${numeroCampo('ultimoTempoHyroxMin', 'Ultima gara', 'min="40" max="200"')}
  </div></fieldset>
  <fieldset><legend>5 · Corsa: 5 km recente <small>(minuti, vuoto = «non so»)</small></legend><div class="riga">
    ${numeroCampo('tempo5kMin', '5 km in', 'min="12" max="60" step="0.5"')}
  </div></fieldset>
  <fieldset><legend>6 · Da quanti anni ti alleni</legend><div class="riga">
    ${numeroCampo('anniAllenamento', 'Anni', 'min="0" max="40" step="0.5"')}
  </div></fieldset>
  <fieldset><legend>7 · Stazioni deboli</legend><div class="riga">
    ${STAZIONI.map(s => pillola('checkbox', 'stazioniDeboli', s, s)).join('')}
  </div></fieldset>
  <fieldset><legend>8 · Disponibilità</legend>
    <div class="riga" style="margin-bottom:8px">${[2, 3, 4, 5, 6].map(n => pillola('radio', 'sedute', n, `${n} sedute`, n === 4)).join('')}</div>
    <div class="riga" style="margin-bottom:8px">${GIORNI.map((g, i) => pillola('checkbox', 'giorni', i + 1, g)).join('')}</div>
    <div class="riga">${numeroCampo('minutiSeduta', 'Minuti per seduta', 'min="20" max="180" value="70"')}</div>
  </fieldset>
  <fieldset><legend>9 · Attrezzatura</legend>
    <div class="riga" style="margin-bottom:8px">
      ${pillola('radio', 'luogo', 'hyrox', 'Palestra Hyrox completa', true)}${pillola('radio', 'luogo', 'palestra', 'Palestra normale')}${pillola('radio', 'luogo', 'casa', 'Casa')}
    </div>
    <div class="riga">
      ${pillola('checkbox', 'attrezzi', 'skierg', 'SkiErg')}${pillola('checkbox', 'attrezzi', 'rower', 'Rower')}${pillola('checkbox', 'attrezzi', 'slitta', 'Slitta')}${pillola('checkbox', 'attrezzi', 'wallBall', 'Wall ball')}
    </div>
  </fieldset>
  <fieldset><legend>10 · Dati fisici</legend><div class="riga">
    ${numeroCampo('eta', 'Età', 'min="10" max="90" value="32"')}
    ${numeroCampo('pesoKg', 'Peso kg', 'min="35" max="200"')}
  </div></fieldset>
  <fieldset><legend>11 · Salute e esercizi da evitare</legend>
    <div class="sicurezza">${DOMANDE_SICUREZZA.map(d => `<label><input type="checkbox" name="sicurezza" value="${d.id}"> ${esc(d.testo)}</label>`).join('')}</div>
    <div class="riga" style="margin-top:8px">${[...STAZIONI, 'Burpees', 'Run'].map(s => pillola('checkbox', 'esclusioni', s, `No ${s}`)).join('')}</div>
  </fieldset>
`

const form = document.getElementById('questionario')
const tutti = (nome) => [...form.querySelectorAll(`[name="${nome}"]:checked`)].map(i => i.value)
const uno = (nome) => form.querySelector(`[name="${nome}"]:checked`)?.value ?? null
// Un campo vuoto è null, MAI 0 (Number('') === 0: è l'errore corretto in revisione).
const num = (nome) => { const v = form.elements[nome].value.trim(); return v === '' ? null : Number(v) }

function risposte() {
  const obiettivo = uno('obiettivo')
  const attrezzi = tutti('attrezzi')
  const luogo = uno('luogo')
  const tutto = luogo === 'hyrox'
  const cinque = num('tempo5kMin')
  return {
    obiettivo,
    gara: obiettivo === 'senza_gara' || !form.elements.garaData.value ? null : { data: form.elements.garaData.value, nome: 'gara inventata' },
    categoria: { divisione: uno('divisione'), formato: uno('formato'), sesso: uno('sesso') },
    tempoObiettivoMin: num('tempoObiettivoMin'), ultimoTempoHyroxMin: num('ultimoTempoHyroxMin'),
    tempo5kSec: cinque === null ? null : Math.round(cinque * 60),
    anniAllenamento: num('anniAllenamento'),
    stazioniDeboli: tutti('stazioniDeboli'),
    sedute: Number(uno('sedute')), giorni: tutti('giorni').map(Number), minutiSeduta: num('minutiSeduta'),
    attrezzatura: { luogo, skierg: tutto || attrezzi.includes('skierg'), rower: tutto || attrezzi.includes('rower'), slitta: tutto || attrezzi.includes('slitta'), wallBall: tutto || attrezzi.includes('wallBall') },
    eta: num('eta'), pesoKg: num('pesoKg'),
    sicurezza: Object.fromEntries(DOMANDE_SICUREZZA.map(d => [d.id, tutti('sicurezza').includes(d.id)])),
    esclusioni: tutti('esclusioni'), salute: null,
  }
}

function riempi(r) {
  form.reset()
  const spunta = (nome, valori) => form.querySelectorAll(`[name="${nome}"]`).forEach(i => { i.checked = valori.map(String).includes(i.value) })
  spunta('obiettivo', [r.obiettivo])
  form.elements.garaData.value = r.gara?.data ?? ''
  spunta('divisione', [r.categoria.divisione]); spunta('formato', [r.categoria.formato]); spunta('sesso', [r.categoria.sesso])
  const metti = (nome, v) => { form.elements[nome].value = v ?? '' }
  metti('tempoObiettivoMin', r.tempoObiettivoMin); metti('ultimoTempoHyroxMin', r.ultimoTempoHyroxMin)
  metti('tempo5kMin', r.tempo5kSec ? r.tempo5kSec / 60 : null); metti('anniAllenamento', r.anniAllenamento)
  spunta('stazioniDeboli', r.stazioniDeboli); spunta('sedute', [r.sedute]); spunta('giorni', r.giorni)
  metti('minutiSeduta', r.minutiSeduta); spunta('luogo', [r.attrezzatura.luogo])
  // In una palestra Hyrox c'è tutto: le spunte servono solo per palestra normale e casa.
  spunta('attrezzi', r.attrezzatura.luogo === 'hyrox' ? [] : Object.entries(r.attrezzatura).filter(([k, v]) => k !== 'luogo' && v === true).map(([k]) => k))
  metti('eta', r.eta); metti('pesoKg', r.pesoKg)
  spunta('sicurezza', Object.entries(r.sicurezza).filter(([, v]) => v).map(([k]) => k))
  spunta('esclusioni', r.esclusioni)
}

// ── Il piano ────────────────────────────────────────────────────────────────

const NOMI_ERRORI = { sedute: 'quante sedute', giorni: 'giorni (almeno quanti le sedute)', minutiSeduta: 'minuti per seduta (almeno 20)', gara: 'la data della gara', obiettivo: "l'obiettivo" }
let settimanaScelta = 0
let ultimaScelta = null

function esercizio(e) {
  const pezzi = [e.reps && e.reps !== '-' ? e.reps : null, e.meters && e.meters !== '-' ? e.meters : null, e.kg ? `${e.kg} kg` : null].filter(Boolean)
  return `${esc(e.name)}${pezzi.length ? ` <span class="num">${esc(pezzi.join(' · '))}</span>` : ''}`
}
function parametri(b) {
  const p = b.params || {}
  if (b.type === 'EMOM') return `${p.rounds} × ${p.interval}`
  if (b.type === 'For Time') return `time cap ${p.timecap}`
  return p.duration ?? ''
}
function contenuto(sections) {
  if (sections.blocks) {
    return sections.blocks.map(b => `<p class="blocco"><b>${esc(b.type)}</b> ${esc(parametri(b))}${b.exercises?.length ? ' — ' + b.exercises.map(esercizio).join(', ') : ''}</p>`).join('')
  }
  return (sections.steps || []).map(s => s.type === 'repeat'
    ? `<p class="blocco"><b>Ripetute</b> ${esc(s.rounds)} × (${esc(s.runDuration)} ${esc(s.runPace)} + ${esc(s.recDuration)} ${esc(s.recPace)})</p>`
    : `<p class="blocco"><b>${esc({ warmup: 'Riscaldamento', run: 'Corsa', cooldown: 'Defaticamento', recover: 'Recupero' }[s.type] ?? s.type)}</b> ${esc(s.duration)} ${esc(s.pace)}</p>`).join('')
}
function problema(e) {
  if (e.tipo === 'attrezzatura') return `<b>${esc(e.dettaglio)}</b>: con la tua attrezzatura non c'è → l'IA lo sostituisce`
  if (e.tipo === 'esclusione') return `<b>${esc(e.dettaglio)}</b>: l'hai escluso → l'IA lo sostituisce`
  if (e.tipo === 'durata') return `Durata: ${esc(e.dettaglio)} → l'IA la sistema`
  if (e.tipo === 'nome') return `Esercizio fuori dalla lista: ${esc(e.dettaglio)}`
  return esc(e.dettaglio)
}

function disegnaPiano() {
  const r = risposte()
  const el = document.getElementById('piano')
  document.getElementById('campoGara').style.display = r.obiettivo === 'senza_gara' ? 'none' : ''
  const stop = controlloSicurezza(r)
  if (stop.stop) {
    ultimaScelta = null
    el.innerHTML = `<h2>Il tuo piano</h2><div class="avviso stop"><h3>Il piano si ferma qui</h3>${stop.motivo === 'eta'
      ? "Sotto i 18 anni l'app non crea un piano."
      : "Con una risposta «sì» alle domande di salute l'app non crea un piano: chiede di sentire prima un medico. Nessuna IA viene chiamata."}</div>`
    disegnaAnalisi()
    return
  }
  const v = validaRisposte(r)
  const profilo = profiloPerIA(r, oggi)
  const scelta = v.ok ? scegliProgramma(PROGRAMMI, profilo) : null
  if (scelta?.programma.id !== ultimaScelta?.programma.id) settimanaScelta = 0
  ultimaScelta = scelta
  const dati = `<div class="dati">
    <div class="dato"><b>${esc(LIVELLI[profilo.livello])}</b><span>livello stimato</span></div>
    <div class="dato"><b>${profilo.settimaneAllaGara ?? '—'}</b><span>settimane alla gara</span></div>
    <div class="dato"><b>${esc(profilo.fasciaEta ?? '—')}</b><span>fascia d'età (all'IA va solo questa)</span></div>
    <div class="dato"><b>${profilo.tempo5kSec ? `${Math.floor(profilo.tempo5kSec / 60)}:${String(profilo.tempo5kSec % 60).padStart(2, '0')}` : '—'}</b><span>5 km</span></div>
  </div>`
  if (!v.ok) {
    el.innerHTML = `<h2>Il tuo piano</h2>${dati}<div class="avviso giallo-av"><h3>Manca qualcosa</h3>Da sistemare: ${v.errori.map(e => esc(NOMI_ERRORI[e] ?? e)).join(', ')}.</div>`
    disegnaAnalisi()
    return
  }
  if (!scelta) {
    el.innerHTML = `<h2>Il tuo piano</h2>${dati}<div class="avviso giallo-av"><h3>Nessun programma del team va bene</h3>
      Nessuno dei 4 programmi d'esempio arriva a ${SOGLIA_TESTO}: qui entrerebbe la <b>rete di sicurezza</b> (scheletro + regole del team, l'IA riempie le sedute). Arriva con la fase 2: oggi non c'è.</div>`
    disegnaAnalisi()
    return
  }
  const usate = scelta.settimaneUsate.map(i => scelta.programma.settimane[i])
  const sett = usate[settimanaScelta]
  const sedute = sett.sedute.map(s => {
    const esito = validaSeduta(s.sections, { minutiPrevisti: s.minuti, attrezzatura: r.attrezzatura, esclusioni: r.esclusioni })
    return `<article class="seduta">
      <header><h3>${esc(GIORNI[(r.giorni[s.posto] ?? 1) - 1] ?? '')} · ${esc(s.focus)}${s.dura ? ' · dura' : ''}</h3>
      <span class="cat ${esc(s.sections.category)}">${esc(s.sections.category === 'Running' ? 'Corsa' : s.sections.category)} · ~${s.minuti} min</span></header>
      ${contenuto(s.sections)}
      ${esito.ok
        ? '<p class="esito ok">✓ Va bene così: l\'IA può lasciarla com\'è (o ritoccare i carichi)</p>'
        : `<div class="esito no">Da adattare prima di mostrarla:<ul>${esito.errori.map(e => `<li>${problema(e)}</li>`).join('')}</ul></div>`}
    </article>`
  }).join('')
  el.innerHTML = `<h2>Il tuo piano</h2>${dati}
    <div class="avviso ok"><h3>Programma del team: ${esc(scelta.programma.nome)}</h3>
      Punteggio ${scelta.punteggio}/100 · ${usate.length} settimane${usate.length !== scelta.programma.settimane.length ? ` (il programma ne ha ${scelta.programma.settimane.length}: ${usate.length > scelta.programma.settimane.length ? 'allungato ripetendo la base' : 'accorciato'} per arrivare alla gara)` : ''}.
      <br><span class="grigio">Il codice sceglie, l'IA adatta, il codice verifica.</span></div>
    <div class="settimane" role="group" aria-label="Settimane">${usate.map((w, i) => `<button type="button" class="sett ${w.fase}" data-i="${i}" aria-pressed="${i === settimanaScelta}">Sett. ${i + 1}<small>${FASI[w.fase]} · ${w.minuti}′</small></button>`).join('')}</div>
    ${sedute}`
  el.querySelectorAll('.sett').forEach(b => b.addEventListener('click', () => { settimanaScelta = Number(b.dataset.i); disegnaPiano() }))
  disegnaAnalisi()
}
const SOGLIA_TESTO = '60 punti su 100'

// ── Dopo l'allenamento ──────────────────────────────────────────────────────

const fb = document.getElementById('feedback')
const scala = (nome, testo) => `<label class="campo">${testo}<select name="${nome}"><option value="">saltata</option>${[1, 2, 3, 4, 5].map(n => `<option ${n === 4 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`
fb.innerHTML = `
  <h3>Simula l'ultima seduta</h3>
  <fieldset><legend>Com'è andata</legend><div class="riga">
    ${pillola('radio', 'stato', 'fatta', 'Fatta ieri', true)}${pillola('radio', 'stato', 'saltate', 'Saltate le ultime due')}
  </div></fieldset>
  <fieldset><legend>Quanto è stata dura (RPE)</legend><div class="riga">
    <select name="rpe"><option value="">non detto</option>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<option ${n === 7 ? 'selected' : ''}>${n}</option>`).join('')}</select>
  </div></fieldset>
  <fieldset><legend>Hai usato i chili indicati? <small>(il tocco nuovo)</small></legend><div class="riga">
    ${pillola('radio', 'carichi', '', 'Sì', true)}${pillola('radio', 'carichi', 'meno', 'Meno')}${pillola('radio', 'carichi', 'piu', 'Di più')}
  </div></fieldset>
  <fieldset><legend>La nota</legend><textarea name="nota" placeholder="Es. «tutto normale» oppure «mi fa male il ginocchio»"></textarea></fieldset>
  <fieldset><legend>Come stai oggi <small>(ieri e oggi uguale; 5 = bene)</small></legend><div class="riga">
    ${scala('sonno', 'Sonno')}${scala('energia', 'Energia')}${scala('dolori', 'Dolori')}${scala('stress', 'Stress')}
  </div></fieldset>`

const SPIEGA = {
  come_stai_basso: '«Come stai» molto basso per due giorni di fila → la prossima seduta diventa leggera o di recupero',
  due_saltate: 'Due sedute saltate di fila → la prossima si alleggerisce e si riparte con calma',
  rpe_alto: 'RPE 9–10 su una seduta pensata al massimo 7 → la prossima si alleggerisce',
  dolore: 'La nota parla di dolore → l\'app chiede «Hai dolore? Dove?» e, se sì, toglie gli esercizi che lo caricano. Mai una diagnosi',
}

function disegnaAnalisi() {
  const el = document.getElementById('analisi')
  const f = fb.elements
  const blocchi = ultimaScelta?.programma.settimane[ultimaScelta.settimaneUsate[settimanaScelta]].sedute.find(s => s.sections.blocks)?.sections.blocks ?? []
  const saltate = fb.querySelector('[name=stato]:checked').value === 'saltate'
  const carichi = fb.querySelector('[name=carichi]:checked').value || null
  const note = `${f.rpe.value ? `[RPE: ${f.rpe.value}/10]\n` : ''}${f.nota.value}`
  const sedute = saltate
    ? [{ data: giorniFa(4), status: 'pending', notes: null, blocks: blocchi, carichi: null }, { data: giorniFa(1), status: 'pending', notes: null, blocks: blocchi, carichi: null }]
    : [{ data: giorniFa(1), status: 'completed', notes: note, blocks: blocchi, carichi }]
  const voce = (k) => (f[k].value === '' ? null : Number(f[k].value))
  const riga = (data) => ({ data, sonno: voce('sonno'), energia: voce('energia'), dolori: voce('dolori'), stress: voce('stress') })
  const comeStai = [riga(giorniFa(1)), riga(giorniFa(0))].filter(c => [c.sonno, c.energia, c.dolori, c.stress].some(v => v !== null))
  const ctx = { sedute, comeStai, oggi }
  const r = riassuntoFeedback(ctx)
  const a = allarmi(ctx)
  const pct = (x) => (x === null ? '—' : `${Math.round(x * 100)}%`)
  el.innerHTML = `<h3>Cosa vede il codice</h3>
    <div class="dati">
      <div class="dato"><b>${pct(r.aderenza7)}</b><span>aderenza 7 giorni</span></div>
      <div class="dato"><b>${r.rpeScarto === null ? '—' : (r.rpeScarto > 0 ? '+' : '') + r.rpeScarto}</b><span>RPE dichiarato − previsto</span></div>
      <div class="dato"><b>${r.comeStaiMedia ?? '—'}</b><span>«Come stai» medio</span></div>
      <div class="dato"><b>${r.carichi.meno} / ${r.carichi.piu}</b><span>carichi meno / di più (28 gg)</span></div>
    </div>
    <h3>Allarmi</h3>
    ${a.length ? a.map(x => `<div class="allarme">⚠️ <span>${esc(SPIEGA[x] ?? x)}</span></div>`).join('') : '<p class="nessuno">Nessun allarme: l\'IA ritocca le prossime sedute solo se i numeri lo giustificano.</p>'}
    <h3 style="margin-top:16px">Il riassunto che arriva all'IA <span class="grigio">(numeri, non la nota intera)</span></h3>
    <pre>${esc(JSON.stringify(r, null, 2))}</pre>`
}

// ── Avvio ───────────────────────────────────────────────────────────────────

const sel = document.getElementById('caso')
sel.innerHTML = '<option value="">— scegli —</option>' + CASI.map(c => `<option value="${c.id}">${c.id} · ${c.risposte.obiettivo.replace('_', ' ')} · ${c.risposte.sedute} sedute · ${c.risposte.attrezzatura.luogo}${c.risposte.esclusioni.length ? ' · no ' + c.risposte.esclusioni.join(', ') : ''}</option>`).join('')
sel.addEventListener('change', () => { const c = CASI.find(x => x.id === sel.value); if (c) { riempi(c.risposte); disegnaPiano() } })
form.addEventListener('input', disegnaPiano)
form.addEventListener('change', disegnaPiano)
fb.addEventListener('input', disegnaAnalisi)
fb.addEventListener('change', disegnaAnalisi)

riempi(CASI[0].risposte)
sel.value = CASI[0].id
disegnaPiano()
