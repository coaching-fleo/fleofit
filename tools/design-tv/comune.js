// Dati finti, sequenza del timer e "telecomando" comuni alle tre proposte della TV.
// Non è codice dell'app: è solo per vedere le proposte vive in localhost.
// Ogni proposta definisce window.disegna(stato) e chiama TV.avvia().

const ICONE = {
  giri: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  audio: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>',
  ruota: '<path d="M20 9V7a2 2 0 0 0-2-2h-6"/><path d="m15 2-3 3 3 3"/><path d="M20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/>',
  fatto: '<path d="M20 6 9 17l-5-5"/>',
  pausa: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
}
const icona = (nome, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONE[nome]}</svg>`

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

// Colore dell'intensità come nella TV di oggi.
const coloreIntensita = (n) => (n <= 3 ? '#4ade80' : n <= 6 ? '#facc15' : n <= 8 ? '#fb923c' : '#f87171')

// Colore della fase del timer (ACCENTO_TEMA di TVDashboardUI).
const TEMI = {
  prep: { colore: '#f1c517', nome: 'Preparazione' },
  base: { colore: '#ffffff', nome: 'Riscaldamento' },
  lavoro: { colore: '#f1c517', nome: 'Lavoro' },
  corsa: { colore: '#0094C6', nome: 'Corsa' },
  riposo: { colore: '#4ade80', nome: 'Riposo' },
  pausa: { colore: '#4ade80', nome: 'Pausa' },
  fine: { colore: '#4ade80', nome: 'Finito' },
}

// Spina del blocco (TYPE_COLORS di blockColors.js).
const SPINE = {
  WarmUp: '#9ca3af', Rest: '#848d9c', 'Cash In': '#d1d5db', 'Cash Out': '#d1d5db',
  EMOM: '#e5e5e5', 'ON/OFF': '#e5e5e5', Riscaldamento: '#fb923c', Ripetute: '#c084fc',
  Defaticamento: '#9ca3af',
}

// ── I due workout ─────────────────────────────────────────────────────────

const HYROX = {
  titolo: 'Hyrox completo · simulazione gara',
  categoria: 'Allenamento Hyrox', colore: '#f1c517', intensita: 9,
  blocchi: [
    { tipo: 'WarmUp', hint: 'Riscaldamento', durata: 480, note: 'Corsa leggera 5 minuti, poi mobilità di anche e spalle.' },
    { tipo: 'Cash In', hint: 'Blocco di apertura', stima: 360, esercizi: [
      { nome: 'SkiErg', q: '1000 m', spec: '1000 m', int: 8 },
      { nome: 'Sled Push', q: '50 m', x: '125 kg', spec: '50 m · 125 kg', int: 9 },
    ] },
    { tipo: 'EMOM', hint: 'Ogni minuto', sotto: '12 minuti', durata: 720, giri: 4, minuti: true, pausaPrima: true, esercizi: [
      { nome: 'Wall Balls', q: '20', x: '9 kg', spec: '20 reps · 9 kg', int: 9 },
      { nome: 'Burpees Broad Jump', q: '10', spec: '10 reps', int: 9 },
      { nome: 'Rowing', q: '250 m', spec: '250 m', int: 8 },
    ] },
    { tipo: 'Rest', hint: 'Recupero', durata: 180, note: 'Bevi e prepara il carry.' },
    { tipo: 'ON/OFF', hint: '45″ lavoro · 15″ riposo', durata: 720, giri: 4, esercizi: [
      { nome: 'Farmers Carry', q: '100 m', x: '2×24 kg', spec: '100 m · 2×24 kg', int: 8 },
      { nome: 'Sandbag Lunges', q: '20 m', x: '20 kg', spec: '20 m · 20 kg', int: 9 },
      { nome: 'Burpees', q: '12', spec: '12 reps', int: 9 },
    ] },
    { tipo: 'Cash Out', hint: 'Blocco di chiusura', stima: 540, giri: 2, pausaPrima: true, esercizi: [
      { nome: 'Rowing', q: '500 m', spec: '500 m', int: 9 },
      { nome: 'Wall Balls', q: '30', x: '9 kg', spec: '30 reps · 9 kg', int: 10 },
    ] },
  ],
}

const CORSA = {
  titolo: 'Ripetute 6×800',
  categoria: 'Allenamento di corsa', colore: '#0094C6', intensita: 8, corsa: true,
  blocchi: [
    { tipo: 'Riscaldamento', durata: 600, esercizi: [{ q: '10 min', nome: 'corsa facile', x: 'Z1', int: 3 }] },
    { tipo: 'Ripetute', durata: 6 * 312, giri: 6, esercizi: [
      { q: '800 m', nome: 'di corsa', x: 'a 4:00 /km', int: 8, etichetta: 'Corsa', colore: '#0094C6' },
      { q: '2 min', nome: 'camminata', int: 2, etichetta: 'Recupero', colore: '#4ade80' },
    ] },
    { tipo: 'Defaticamento', durata: 480, esercizi: [{ q: '8 min', nome: 'corsa lenta', x: 'Z1', int: 2 }] },
  ],
}

// Un workout corto: la lavagna con poco sopra deve venire ENORME.
const BREVE = {
  titolo: 'Hyrox forte · EMOM 40',
  categoria: 'Allenamento Hyrox', colore: '#f1c517', intensita: 8, breve: true,
  blocchi: [
    { tipo: 'WarmUp', hint: 'Riscaldamento', durata: 360, note: 'Corsa leggera e mobilità.' },
    { tipo: 'EMOM', hint: 'Ogni minuto', durata: 2400, giri: 20, minuti: true, esercizi: [
      { nome: 'Wall Balls', q: '20', x: '9 kg', spec: '20 reps · 9 kg', int: 8 },
      { nome: 'Burpees Broad Jump', q: '10', spec: '10 reps', int: 8 },
    ] },
  ],
}

// ── La sequenza del timer (versione semplice di buildTimerSequence) ──────

function sequenza(w) {
  const s = []
  const b = w.blocchi
  if (w.breve) {
    s.push({ b: 0, tema: 'prep', compito: 'Preparati!', poi: 'Riscaldamento', dur: 10 })
    s.push({ b: 0, tema: 'base', compito: 'Riscaldamento libero', poi: 'EMOM · Wall Balls', dur: 360 })
    const e = b[1].esercizi
    for (let m = 0; m < 40; m++) {
      const k = m % 2
      s.push({ b: 1, tema: 'lavoro', etichetta: `Minuto ${m + 1} di 40`, es: k, giro: Math.floor(m / 2) + 1,
        compito: e[k].nome, spec: e[k].spec, poi: m < 39 ? e[(k + 1) % 2].nome : 'Fine', dur: 60 })
    }
  } else if (!w.corsa) {
    s.push({ b: 0, tema: 'prep', compito: 'Preparati!', poi: 'Riscaldamento', dur: 10 })
    s.push({ b: 0, tema: 'base', compito: 'Riscaldamento libero', poi: 'Cash In · SkiErg', dur: 480 })
    s.push({ b: 1, tema: 'lavoro', compito: 'SkiErg, poi Sled Push', poi: 'Pausa, poi EMOM', crono: true, dur: 0 })
    // La pausa dopo il Cash In: si riparte quando il telefono preme Avanti.
    s.push({ b: 2, pausa: true, tema: 'pausa', compito: 'Pausa', spec: 'Si riparte con Avanti sul telefono', poi: 'EMOM · 12 minuti', crono: true, dur: 0 })
    const emom = b[2].esercizi
    for (let m = 0; m < 12; m++) {
      const k = m % 3
      s.push({ b: 2, tema: 'lavoro', etichetta: `Minuto ${m + 1} di 12`, es: k, giro: Math.floor(m / 3) + 1,
        compito: emom[k].nome, spec: emom[k].spec, poi: m < 11 ? emom[(k + 1) % 3].nome : 'Recupero 3:00', dur: 60 })
    }
    s.push({ b: 3, tema: 'riposo', compito: 'Recupera', poi: 'ON/OFF · Farmers Carry', dur: 180, prossimo: 0 })
    const oo = b[4].esercizi
    for (let g = 1; g <= 4; g++) {
      for (let k = 0; k < 3; k++) {
        s.push({ b: 4, tema: 'lavoro', etichetta: `Giro ${g} di 4`, es: k, giro: g, compito: oo[k].nome, spec: oo[k].spec, poi: 'Riposo 0:15', dur: 45 })
        const ultimo = g === 4 && k === 2
        s.push({ b: 4, tema: 'riposo', etichetta: `Giro ${g} di 4`, giro: g, prossimo: ultimo ? null : (k + 1) % 3,
          compito: 'Riposo', poi: ultimo ? 'Pausa, poi Cash Out' : oo[(k + 1) % 3].nome, dur: 15 })
      }
    }
    s.push({ b: 5, pausa: true, tema: 'pausa', compito: 'Pausa', spec: 'Si riparte con Avanti sul telefono', poi: 'Cash Out · 2 giri', crono: true, dur: 0 })
    s.push({ b: 5, tema: 'lavoro', etichetta: 'Giro 1 di 2', giro: 1, compito: 'Rowing, poi Wall Balls', poi: 'Riposo 1:00', crono: true, dur: 0 })
    s.push({ b: 5, tema: 'riposo', etichetta: 'Giro 1 di 2', giro: 1, compito: 'Riposo', poi: 'Giro 2 · Rowing', dur: 60 })
    s.push({ b: 5, tema: 'lavoro', etichetta: 'Giro 2 di 2', giro: 2, compito: 'Rowing, poi Wall Balls', poi: 'Fine', crono: true, dur: 0 })
  } else {
    s.push({ b: 0, tema: 'prep', compito: 'Preparati!', poi: 'Riscaldamento · 10 min Z1', dur: 10 })
    s.push({ b: 0, tema: 'base', es: 0, compito: 'Corsa facile', spec: 'Z1', poi: 'Ripetuta 1 · 800 m', dur: 600 })
    for (let g = 1; g <= 6; g++) {
      s.push({ b: 1, tema: 'corsa', etichetta: `Ripetuta ${g} di 6`, es: 0, giro: g, compito: '800 m', spec: 'a 4:00 /km', poi: 'Recupero · 2 min camminata', crono: true, dur: 0 })
      s.push({ b: 1, tema: 'riposo', etichetta: `Ripetuta ${g} di 6`, es: 1, giro: g, compito: 'Camminata', spec: '2 min', poi: g < 6 ? `Ripetuta ${g + 1} · 800 m` : 'Defaticamento', dur: 120 })
    }
    s.push({ b: 2, tema: 'base', es: 0, compito: 'Defaticamento', spec: 'Z1', poi: 'Fine', dur: 480 })
  }
  s.push({ b: b.length, tema: 'fine', compito: 'Allenamento finito', poi: null, dur: 0, fine: true })
  return s
}

// ── Il telecomando delle proposte ─────────────────────────────────────────

const SCENE = {
  hyrox: { w: HYROX, partenza: 8, t: 38 },   // EMOM, minuto 5
  breve: { w: BREVE, partenza: 8, t: 41 },   // EMOM, minuto 7
  corsa: { w: CORSA, partenza: 4, t: 64 },   // ripetuta 2, corsa
}

const TV = {
  scena: new URLSearchParams(location.search).get('scena') || 'hyrox',
  i: 0, t: 0, inCorsa: true,
  carica(nome) {
    this.scena = nome
    const sc = SCENE[nome]
    this.w = sc.w; this.passi = sequenza(sc.w)
    this.i = Number(new URLSearchParams(location.search).get('passo') ?? sc.partenza); this.t = sc.t
    this.disegna()
  },
  vai(d) {
    this.i = Math.max(0, Math.min(this.passi.length - 1, this.i + d))
    const p = this.passi[this.i]
    this.t = p.crono ? 0 : p.dur
    this.disegna()
  },
  tick() {
    if (!this.inCorsa) return
    const p = this.passi[this.i]
    if (p.fine) return
    if (p.crono) this.t += 1
    else if (--this.t <= 0) return this.vai(1)
    this.disegna()
  },
  stato() {
    const p = this.passi[this.i]
    return {
      w: this.w, passi: this.passi, i: this.i, passo: p, inPausa: !this.inCorsa && !p.fine,
      tempo: mmss(this.t), tema: TEMI[p.tema],
      avanzamento: p.crono || !p.dur ? null : (p.dur - this.t) / p.dur,
    }
  },
  disegna() {
    // Una proposta può gestire il DOM da sola (per animare): allora torna null.
    const html = window.disegna(this.stato())
    if (typeof html === 'string') document.getElementById('tela').innerHTML = html
    window.dopo?.()
    const e = document.getElementById('pos')
    if (e) e.textContent = `${this.i + 1}/${this.passi.length}`
    document.querySelectorAll('[data-scena]').forEach(b => b.toggleAttribute('aria-pressed', b.dataset.scena === this.scena))
  },
  avvia() {
    // Il telecomando sta FUORI dalla TV, in fondo alla finestra.
    document.body.insertAdjacentHTML('beforeend', `
      <div class="telecomando" ${new URLSearchParams(location.search).has('pulita') ? 'hidden' : ''}>
        <a href="index.html">Tutte le proposte</a>
        <span class="sep"></span>
        <button data-scena="hyrox">Hyrox lungo</button><button data-scena="breve">EMOM corto</button><button data-scena="corsa">Corsa</button>
        <span class="sep"></span>
        <button data-v="-1" aria-label="Passo precedente">◀</button><span id="pos" class="num"></span><button data-v="1" aria-label="Passo successivo">▶</button>
        <button data-pausa>Pausa</button>
        ${window.pulsantiExtra || ''}
        <span class="aiuto">← → passi · spazio pausa</span>
      </div>`)
    document.querySelector('.telecomando').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return
      if (b.dataset.scena) this.carica(b.dataset.scena)
      if (b.dataset.v) this.vai(Number(b.dataset.v))
      if (b.dataset.extra) window.suExtra?.(b)
      if (b.hasAttribute('data-pausa')) { this.inCorsa = !this.inCorsa; b.textContent = this.inCorsa ? 'Pausa' : 'Riprendi'; this.disegna() }
    })
    addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') this.vai(1)
      if (e.key === 'ArrowLeft') this.vai(-1)
      if (e.key === ' ') { e.preventDefault(); document.querySelector('[data-pausa]').click() }
    })
    // La tela è sempre 1920×1080 e si scala per stare nella finestra, come la TV vera.
    const scala = () => {
      const pulita = new URLSearchParams(location.search).has('pulita')
      const h = innerHeight - (pulita ? 0 : 56)
      const k = Math.min(innerWidth / 1920, h / 1080)
      const tela = document.getElementById('tela')
      tela.style.transform = `scale(${k})`
      tela.style.left = `${(innerWidth - 1920 * k) / 2}px`
      tela.style.top = `${(h - 1080 * k) / 2}px`
    }
    addEventListener('resize', scala); scala()
    this.carica(this.scena)
    setInterval(() => this.tick(), 1000)
  },
}

// La linguetta della cartellina («file folder label»), come BloccoScheda dell'app.
// Nel blocco in corso dice anche a che giro si è.
function linguetta(blocco, giro, acceso) {
  if (!blocco.giri || blocco.giri < 2) return ''
  const pallini = giro
    ? `<span class="pallini">${Array.from({ length: blocco.giri }, (_, k) => `<i class="${k < giro - 1 ? 'fatto' : k === giro - 1 ? 'ora' : ''}"></i>`).join('')}</span>`
    : ''
  return `<div class="linguetta ${acceso ? 'accesa' : ''}">${icona('giri')}<b class="num">${giro && acceso ? `${giro}/${blocco.giri}` : `${blocco.giri}x`}</b>${acceso ? pallini : ''}</div>`
}

const durataBlocco = (b) => (b.durata ? mmss(b.durata) : b.stima ? `≈${mmss(b.stima)}` : '')

// Una riga della lavagna come la scriverebbe un coach: «20 Wall Balls 9 kg».
const scritta = (e) => `<span class="pz"><span class="q num">${e.q || ''}</span> <span class="nm">${e.nome || ''}</span></span>${e.x ? `<span class="xx num">${e.x}</span>` : ''}`

// I caratteri della lavagna si allargano finché il workout riempie lo spazio,
// senza uscire: un EMOM a due esercizi viene enorme, un Hyrox a sei blocchi
// prende tutto lo schermo. `el` ha font-size in px, tutto dentro è in em.
const nienteTagliato = (el) => [...el.querySelectorAll('.t, h3, .es')].every(x => x.scrollWidth <= x.clientWidth + 1)
function adatta(el, min = 14, max = 140) {
  if (!el) return
  let lo = min, hi = max
  while (hi - lo > 0.5) {
    const m = (lo + hi) / 2
    el.style.fontSize = m + 'px'
    const ok = el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1 && nienteTagliato(el)
    if (ok) lo = m; else hi = m
  }
  el.style.fontSize = lo + 'px'
  return lo
}

// Un blocco scritto sulla lavagna, con la linguetta dei giri e gli stati:
// fatto (spento con la spunta), in corso (ambra), da fare.
function bloccoLavagna(b, k, s, { hint = true } = {}) {
  const { passo } = s
  const acceso = k === passo.b && passo.tema !== 'prep' && !passo.fine
  const stato = passo.fine || k < passo.b ? 'fatto' : acceso ? 'ora' : ''
  let ling = ''
  if (b.giri > 1) {
    const g = acceso ? passo.giro : null
    const pallini = g && b.giri <= 8
      ? `<span class="pallini">${Array.from({ length: b.giri }, (_, j) => `<i class="${j < g - 1 ? 'fatto' : j === g - 1 ? 'ora' : ''}"></i>`).join('')}</span>` : ''
    ling = `<div class="ling">${icona('giri')}<span class="num">${g ? `${g}/${b.giri}` : `${b.giri}x`}</span>${pallini}</div>`
  }
  const es = b.esercizi || []
  const righe = es.length ? es.map((e, i) => {
    const corsa = !!e.etichetta
    const ora = acceso && passo.es === i && (passo.tema !== 'riposo' || corsa)
    const poi = acceso && !ora && passo.tema === 'riposo' && passo.prossimo === i
    const stile = ora && corsa ? `style="background:${e.colore}29;border-color:${e.colore}"` : ''
    const n = corsa ? `<span class="et" style="color:${e.colore}">${e.etichetta}</span>`
      : (b.minuti || b.tipo === 'ON/OFF') ? `<span class="n num">${i + 1}</span>` : ''
    return `<div class="r ${ora ? 'ora' : ''} ${poi ? 'poi' : ''}" ${stile}>${n}<span class="t">${scritta(e)}</span>
      ${e.int ? `<span class="int" style="color:${coloreIntensita(e.int)}">${e.int}/10</span>` : ''}</div>`
  }).join('') : (b.note ? `<p class="nota">${b.note}</p>` : '')
  return `<div class="blocco ${stato}">${ling}
    <div class="carta" style="--spina:${SPINE[b.tipo] || '#9ca3af'}">
      <header><h3>${b.tipo}</h3>${hint && b.hint ? `<span class="hint">${b.hint}</span>` : ''}<span class="dur num">${durataBlocco(b)}</span></header>
      ${righe}
    </div></div>`
}

// La fase del timer scritta per esteso: «Lavoro · Minuto 5 di 12».
function testoFase(s) {
  const { passo, w } = s
  const tema = w.corsa && passo.tema === 'lavoro' ? TEMI.corsa : TEMI[passo.tema]
  const nome = passo.tema === 'prep' ? 'Preparazione' : passo.tema === 'riposo' ? 'Riposo' : tema.nome
  return { testo: passo.etichetta ? `${nome} · ${passo.etichetta}` : nome, colore: tema.colore }
}

// Quanto «pesa» un blocco in altezza, in righe.
const pesoBlocco = (b) => 1.6 + (b.giri > 1 ? 0.9 : 0) + ((b.esercizi || []).length ? b.esercizi.length * 1.2 : 1)

// Divide i blocchi, IN ORDINE, in n colonne con l'altezza più pari possibile.
function dividi(pesi, n) {
  const somma = (a, b) => pesi.slice(a, b).reduce((x, y) => x + y, 0)
  const memo = new Map()
  const vai = (i, c) => {
    const k = i + ',' + c
    if (memo.has(k)) return memo.get(k)
    let r
    if (c === 1) r = { max: somma(i, pesi.length), tagli: [] }
    else {
      r = { max: Infinity, tagli: [] }
      for (let j = i + 1; j <= pesi.length - c + 1; j++) {
        const resto = vai(j, c - 1)
        const m = Math.max(somma(i, j), resto.max)
        if (m < r.max) r = { max: m, tagli: [j, ...resto.tagli] }
      }
    }
    memo.set(k, r); return r
  }
  const { tagli } = vai(0, n)
  const bordi = [0, ...tagli, pesi.length]
  return bordi.slice(0, -1).map((a, i) => [a, bordi[i + 1]])
}

// La lavagna: prova da 1 a `max` colonne e tiene quella coi caratteri più grandi.
function lavagna(el, s, max = 4) {
  if (!el) return
  const bl = s.w.blocchi
  const html = bl.map((b, k) => bloccoLavagna(b, k, s))
  const pesi = bl.map(pesoBlocco)
  const scrivi = (n) => {
    el.innerHTML = dividi(pesi, n).map(([a, b]) => `<div class="colonna">${html.slice(a, b).join('')}</div>`).join('')
    // Ogni colonna larga quanto le serve: misurata a larghezza naturale,
    // poi lo spazio si divide in proporzione.
    const col = [...el.children]
    el.style.fontSize = '30px'
    // Le note vanno a capo: non contano nella larghezza.
    el.querySelectorAll('.nota').forEach(n => { n.style.display = 'none' })
    col.forEach(c => { c.style.flex = 'none'; c.style.width = 'max-content' })
    const larghe = col.map(c => c.getBoundingClientRect().width)
    el.querySelectorAll('.nota').forEach(n => { n.style.display = '' })
    col.forEach((c, i) => { c.style.width = ''; c.style.flex = `${larghe[i]} 1 0` })
  }
  let meglio = { n: 1, px: 0 }
  for (let n = 1; n <= Math.min(max, bl.length); n++) {
    scrivi(n)
    const px = adatta(el)
    if (px > meglio.px + 0.5) meglio = { n, px }
  }
  scrivi(meglio.n)
  adatta(el)
}

// Più persone sfasate (personeTV.js dell'app): chi parte da quale esercizio.
const PERSONE = [
  { nome: 'Marco', colore: '#38bdf8', da: 0 },
  { nome: 'Giulia', colore: '#f472b6', da: 1 },
  { nome: 'Luca', colore: '#a3e635', da: 2 },
]
