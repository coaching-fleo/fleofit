// ─────────────────────────────────────────────────────────────────────────────
// AMBIENTE DI PROVA — un Supabase finto, tutto in memoria.
//
// Perché esiste: il branch `ios-version` parla con il database di PRODUZIONE,
// condiviso con la web app, e non esiste uno staging (CLAUDE.md §1.1). Provare
// una funzione nuova voleva dire o non provarla, o scrivere sui dati veri degli
// atleti — e assegnare fa anche partire una push a una persona vera.
//
// Qui l'intera app gira su dati inventati: si clicca tutto, si assegna, si
// completa, si crea. Niente esce da questo browser.
//
// 🔴 SI ACCENDE SOLO CON `VITE_DEMO=1`, e il controllo sta in
// `src/supabaseClient.js`. `import.meta.env` è sostituito da Vite in fase di
// build, quindi in una build normale il ramo diventa irraggiungibile e questo
// file non entra nel bundle. Verifica dopo un build:
//     grep -c "AMBIENTE DI PROVA" dist/assets/*.js   → deve dare 0
//
// ⚠️ NON è un clone di Postgres: implementa i metodi che l'app usa davvero
// (censiti il 02/09/2026 — 16 metodi di catena, 8 tabelle, due relazioni).
// Se una pagina inizia a usare `.or()` o una relazione nuova, va aggiunta qui:
// il sintomo è una lista vuota, non un errore.
//
// I dati vivono in `localStorage` sotto `fleofit_demo_db`, così quello che si
// fa sopravvive a un ricaricamento. Si azzera con il bottone in pagina oppure
//     localStorage.removeItem('fleofit_demo_db')
// ─────────────────────────────────────────────────────────────────────────────

import { semi, VERSIONE_SEME } from './demoSemi'

const CHIAVE = 'fleofit_demo_db'

/** Le due sole relazioni che l'app chiede nei `select`. */
const RELAZIONI = {
  athlete_workouts: {
    workouts: { chiave: 'workout_id', tabella: 'workouts' },
    athletes: { chiave: 'athlete_id', tabella: 'athletes' },
  },
}

const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
    }))

function caricaDb() {
  try {
    const grezzo = localStorage.getItem(CHIAVE)
    if (grezzo) {
      const db = JSON.parse(grezzo)
      // Un seme più recente del salvataggio vince: così, se cambio i dati di
      // prova, non resta appeso un database vecchio senza spiegazione.
      if (db?.__versione === VERSIONE_SEME) return db
    }
  } catch (e) {
    console.warn('[demo] database illeggibile, riparto dal seme', e)
  }
  const fresco = semi()
  salvaDb(fresco)
  segnaVecchiComeLetti(fresco)
  return fresco
}

function salvaDb(db) {
  try { localStorage.setItem(CHIAVE, JSON.stringify(db)) }
  catch (e) { console.warn('[demo] non riesco a salvare', e) }
}

let DB = null
const db = () => (DB ||= caricaDb())

/**
 * Segna come «già letti» i feedback più vecchi di qualche giorno.
 *
 * ⚠️ Non è cosmesi: una nota che contiene solo il marcatore RPE conta come
 * feedback (`feedbackNuovi` in statisticheCoach.js), quindi un seme con
 * quattro settimane di sedute misurate apre la Home con «35 da leggere» — che
 * è il comportamento giusto dell'app ma non somiglia a nessun coach vero. Qui
 * si parte come se l'arretrato fosse stato smaltito, lasciando indietro solo
 * gli ultimi giorni.
 */
function segnaVecchiComeLetti(base) {
  const soglia = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)
  const vecchi = (base.athlete_workouts || [])
    .filter(a => a.status === 'completed' && a.completed_date < soglia)
    .map(a => a.id)
  try {
    localStorage.setItem(`fleofit_feedback_visti_${UTENTE.id}`, JSON.stringify(vecchi))
  } catch (e) { console.warn('[demo] non riesco a segnare i feedback letti', e) }
}

/** Azzera tutto e ricomincia dal seme. Usato dal pannello in pagina. */
export function azzeraDemo() {
  localStorage.removeItem(CHIAVE)
  localStorage.removeItem(`fleofit_feedback_visti_${UTENTE.id}`)
  DB = null
}

// ── il mini motore di query ─────────────────────────────────────────────────

/** `id, title, workouts (id, title, sections)` → colonne + relazioni chieste. */
function leggiSelezione(testo) {
  const t = String(testo || '*')
  const relazioni = []
  const piatto = t.replace(/([a-z_]+)\s*\(([^)]*)\)/gi, (_, nome, campi) => {
    relazioni.push({ nome, campi: campi.split(',').map(c => c.trim()).filter(Boolean) })
    return ''
  })
  const colonne = piatto.split(',').map(c => c.trim()).filter(Boolean)
  return { colonne, relazioni }
}

function proietta(riga, tabella, selezione) {
  if (!riga) return riga
  const { colonne, relazioni } = selezione
  const fuori = {}

  if (colonne.includes('*') || colonne.length === 0) Object.assign(fuori, riga)
  else for (const c of colonne) if (c in riga) fuori[c] = riga[c]

  for (const rel of relazioni) {
    const def = RELAZIONI[tabella]?.[rel.nome]
    if (!def) { fuori[rel.nome] = null; continue }
    const collegata = db()[def.tabella]?.find(r => r.id === riga[def.chiave]) || null
    if (!collegata) { fuori[rel.nome] = null; continue }
    if (rel.campi.length === 0) { fuori[rel.nome] = { ...collegata }; continue }
    const ridotta = {}
    for (const c of rel.campi) ridotta[c] = collegata[c]
    fuori[rel.nome] = ridotta
  }
  return fuori
}

const confronta = (a, b) => {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  return a < b ? -1 : a > b ? 1 : 0
}

function query(tabella) {
  const filtri = []
  let selezione = leggiSelezione('*')
  let ordinamenti = []
  let limite = null
  let forma = 'lista'        // lista | singolo | forse
  let azione = 'select'
  let dati = null
  let vuoleRisultato = false
  let conflitto = null

  const righeTabella = () => (db()[tabella] ||= [])

  const filtrate = () => righeTabella().filter(r => filtri.every(f => f(r)))

  function esegui() {
    const tab = righeTabella()

    if (azione === 'insert' || azione === 'upsert') {
      const nuove = (Array.isArray(dati) ? dati : [dati]).map(r => ({ id: uuid(), ...r }))
      const inserite = []
      for (const n of nuove) {
        if (azione === 'upsert' && conflitto) {
          const i = tab.findIndex(r => r[conflitto] === n[conflitto])
          if (i >= 0) { tab[i] = { ...tab[i], ...n, id: tab[i].id }; inserite.push(tab[i]); continue }
        }
        tab.push(n); inserite.push(n)
      }
      salvaDb(db())
      return inserite
    }

    if (azione === 'update') {
      const tocca = filtrate()
      for (const r of tocca) Object.assign(r, dati)
      salvaDb(db())
      return tocca
    }

    if (azione === 'delete') {
      const tocca = filtrate()
      const ids = new Set(tocca.map(r => r.id))
      db()[tabella] = tab.filter(r => !ids.has(r.id))
      salvaDb(db())
      return tocca
    }

    let righe = filtrate()
    for (const o of [...ordinamenti].reverse()) {
      righe = righe.sort((a, b) => (o.crescente ? 1 : -1) * confronta(a[o.colonna], b[o.colonna]))
    }
    if (limite != null) righe = righe.slice(0, limite)
    return righe
  }

  const q = {
    select(cols) {
      if (azione === 'select') selezione = leggiSelezione(cols)
      else { vuoleRisultato = true; selezione = leggiSelezione(cols) }
      return q
    },
    insert(v) { azione = 'insert'; dati = v; return q },
    update(v) { azione = 'update'; dati = v; return q },
    upsert(v, opts) { azione = 'upsert'; dati = v; conflitto = opts?.onConflict || null; return q },
    delete() { azione = 'delete'; return q },

    eq(c, v) { filtri.push(r => String(r[c]) === String(v)); return q },
    neq(c, v) { filtri.push(r => String(r[c]) !== String(v)); return q },
    gt(c, v) { filtri.push(r => r[c] != null && r[c] > v); return q },
    gte(c, v) { filtri.push(r => r[c] != null && r[c] >= v); return q },
    lt(c, v) { filtri.push(r => r[c] != null && r[c] < v); return q },
    lte(c, v) { filtri.push(r => r[c] != null && r[c] <= v); return q },
    in(c, vals) { const s = new Set((vals || []).map(String)); filtri.push(r => s.has(String(r[c]))); return q },
    is(c, v) { filtri.push(r => (v === null ? r[c] == null : r[c] === v)); return q },
    like(c, p) { const re = new RegExp(String(p).replace(/%/g, '.*'), 'i'); filtri.push(r => re.test(String(r[c] ?? ''))); return q },
    ilike(c, p) { return q.like(c, p) },

    order(c, opts) { ordinamenti.push({ colonna: c, crescente: opts?.ascending !== false }); return q },
    limit(n) { limite = n; return q },
    range(da, a) { limite = a - da + 1; return q },
    single() { forma = 'singolo'; return q },
    maybeSingle() { forma = 'forse'; return q },

    then(ok, ko) {
      try {
        const grezze = esegui()
        const scrittura = azione !== 'select'
        // Una scrittura senza `.select()` non restituisce righe, come il client vero.
        const proiettate = (scrittura && !vuoleRisultato)
          ? null
          : grezze.map(r => proietta(r, tabella, selezione))

        let data = proiettate
        if (proiettate && forma !== 'lista') {
          data = proiettate[0] ?? null
          if (forma === 'singolo' && data == null) {
            return Promise.resolve({ data: null, error: { message: 'Nessuna riga', code: 'PGRST116' }, count: 0 })
              .then(ok, ko)
          }
        }
        return Promise.resolve({ data, error: null, count: grezze.length, status: 200 }).then(ok, ko)
      } catch (e) {
        console.error('[demo] query fallita su', tabella, e)
        return Promise.resolve({ data: null, error: { message: String(e) }, count: null }).then(ok, ko)
      }
    },
  }
  return q
}

// ── auth, storage, functions, realtime: quanto basta perché l'app giri ──────

// ⚠️ L'email dev'essere una di ADMIN_EMAILS (src/App.jsx) o si entra come
// atleta e metà delle schermate coach non esiste.
const UTENTE = {
  id: '0118e43f-8791-4fd6-8032-bee028334c99',
  email: 'coaching@federicoleo.it',
  user_metadata: { first_name: 'Federico' },
}
const SESSIONE = { user: UTENTE, access_token: 'demo', refresh_token: 'demo' }

const canale = () => {
  const c = {
    on: () => c,
    subscribe: (cb) => { cb?.('SUBSCRIBED'); return c },
    track: async () => {},
    send: async () => {},
    unsubscribe: async () => {},
    presenceState: () => ({}),
  }
  return c
}

export function clientDemo() {
  console.info('%c[FLEOFIT] AMBIENTE DI PROVA — dati finti, nessuna scrittura reale',
    'background:#f1ba17;color:#000;font-weight:bold;padding:2px 6px;border-radius:4px')
  return {
    __demo: true,
    from: (tabella) => query(tabella),
    auth: {
      getSession: async () => ({ data: { session: SESSIONE }, error: null }),
      getUser: async () => ({ data: { user: UTENTE }, error: null }),
      onAuthStateChange: (cb) => {
        // Sincrono come il client vero al primo giro: l'app si aspetta di
        // ricevere la sessione senza attendere un evento.
        setTimeout(() => cb?.('SIGNED_IN', SESSIONE), 0)
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
      signInWithPassword: async () => ({ data: { session: SESSIONE, user: UTENTE }, error: null }),
      signInWithOAuth: async () => ({ data: {}, error: null }),
      signUp: async () => ({ data: { session: SESSIONE, user: UTENTE }, error: null }),
      signOut: async () => ({ error: null }),
      updateUser: async () => ({ data: { user: UTENTE }, error: null }),
      setSession: async () => ({ data: { session: SESSIONE }, error: null }),
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: { path: 'demo' }, error: null }),
        getPublicUrl: (p) => ({ data: { publicUrl: `https://esempio.invalid/${p}` } }),
        remove: async () => ({ data: [], error: null }),
        list: async () => ({ data: [], error: null }),
      }),
    },
    functions: {
      invoke: async (nome, opzioni) => {
        console.info('[demo] Edge Function non chiamata:', nome, opzioni?.body)
        return { data: { ok: true }, error: null }
      },
    },
    channel: canale,
    removeChannel: () => {},
    rpc: async () => ({ data: null, error: null }),
  }
}
