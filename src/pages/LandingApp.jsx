import { useEffect, useRef, useState } from 'react'
import { addDays, format, startOfWeek } from 'date-fns'
import { it } from 'date-fns/locale'
import {
  Home as IconaHome, Dumbbell, CalendarDays, Users, Bell, Search, ChevronLeft, ChevronRight,
  Sparkles, Plus, Repeat2, Check, X, Undo2, Send, AlertTriangle, TrendingUp, Mic,
} from 'lucide-react'
import './LandingApp.css'

/* ─────────────────────────────────────────────────────────────────────────
   L'app FINTA dentro il telefono della landing: si tocca come quella vera,
   ma non parla con nessuno. Niente Supabase, niente rete: stato in memoria,
   dati di esempio inventati, e tutto torna com'era ricaricando la pagina.
   Disegnata in pixel a 402×874 (un iPhone) e poi scalata sullo schermo.
   ───────────────────────────────────────────────────────────────────────── */

const LARGO = 402

const CAT = {
  hyrox: { nome: 'Hyrox', colore: '#f1ba17' },
  corsa: { nome: 'Running', colore: '#0094C6' },
  gym: { nome: 'Gym', colore: '#14B8A6' },
}

// Atleti di esempio: nessuno esiste davvero.
const ATLETI = [
  { id: 'sara', nome: 'Sara Villa', oggi: { titolo: 'Hyrox forte · EMOM 40', cat: 'hyrox', fatto: true, rpe: 8, nota: 'Ultimi due giri al limite, ma ci sono' }, aderenza: 92, carico: [310, 345, 380, 410] },
  { id: 'luca', nome: 'Luca Bianchi', oggi: { titolo: 'Ripetute 6 × 800 m', cat: 'corsa', fatto: true, rpe: 8, nota: 'Gambe a pezzi dopo il viaggio di ieri' }, aderenza: 78, carico: [280, 300, 290, 495], avviso: 'Carico salito del 70% in una settimana' },
  { id: 'giulia', nome: 'Giulia Neri', oggi: { titolo: 'Hyrox medio · sled', cat: 'hyrox', fatto: true, rpe: 7, nota: 'Più dura di quanto sembrava' }, aderenza: 100, carico: [330, 350, 340, 365] },
  { id: 'marco', nome: 'Marco Rossi', oggi: { titolo: 'Forza · gambe', cat: 'gym', fatto: true, rpe: 4, nota: 'Tutto liscio' }, aderenza: 95, carico: [260, 270, 300, 290] },
  { id: 'elena', nome: 'Elena Moretti', oggi: { titolo: 'Fondo lento 12 km', cat: 'corsa', fatto: false }, aderenza: 88, carico: [240, 260, 255, 270] },
  { id: 'davide', nome: 'Davide Ricci', oggi: { titolo: 'Hyrox forte · sled', cat: 'hyrox', fatto: false }, aderenza: 64, carico: [300, 220, 150, 120], avviso: '3 allenamenti saltati di fila' },
]
const iniziali = (n) => n.split(' ').map((p) => p[0]).join('')
const coloreRpe = (r) => (r <= 3 ? '#22c55e' : r <= 6 ? '#f1ba17' : r <= 8 ? '#f97316' : '#ef4444')

// I nove blocchi Hyrox, con la riga che li descrive e il parametro che mostrano.
const TIPI = ['WarmUp', 'Cash In', 'ON/OFF', 'EMOM', 'AMRAP', 'For Time', 'Interval', 'Rest', 'Cash Out']
const DESCRIZIONE = {
  WarmUp: 'Riscaldamento', 'Cash In': 'Blocco di apertura', 'ON/OFF': 'Lavoro e pausa', EMOM: 'Ogni minuto',
  AMRAP: 'Più giri possibile', 'For Time': 'A tempo', Interval: 'A intervalli', Rest: 'Recupero', 'Cash Out': 'Blocco di chiusura',
}
const RPE_TIPO = { WarmUp: 4, 'Cash In': 6, 'ON/OFF': 8, EMOM: 8, AMRAP: 8, 'For Time': 9, Interval: 8, Rest: 1, 'Cash Out': 8 }
const ESERCIZI_NUOVI = [['SkiErg', '250 m'], ['Wall Balls', '20 · 9 kg'], ['Burpee broad jump', '10']]

let prossimoId = 100
const blocco = (tipo, min, esercizi, extra = {}) => ({ id: prossimoId++, tipo, min, rpe: RPE_TIPO[tipo], esercizi, ...extra })

const INIZIO = () => [
  blocco('WarmUp', 8, [['Corsa lenta', 'Z2']]),
  blocco('Cash In', 5, [['SkiErg', '500 m'], ['Burpee broad jump', '10']]),
  blocco('For Time', 20, [['Wall Balls', '25 · 9 kg'], ['Farmers Carry', '100 m · 24 kg'], ['Rowing', '500 m']], { giri: 3 }),
]
const RICHIESTA_IA = 'Porta il For Time a 4 giri e aggiungi un EMOM da 12 minuti: 15 wall balls, 12 cal row, 10 burpees'
const PROPOSTA_IA = (blocchi) => [
  ...blocchi.map((b) => (b.tipo === 'For Time' ? { ...b, giri: 4, min: 24 } : b)),
  blocco('EMOM', 12, [['Wall Balls', '15 · 9 kg'], ['Row', '12 cal'], ['Burpee', '10']]),
]

const sottotitolo = (b) => [DESCRIZIONE[b.tipo], b.esercizi.length ? `${b.esercizi.length} ${b.esercizi.length === 1 ? 'esercizio' : 'esercizi'}` : null, b.giri ? `${b.giri} giri` : null].filter(Boolean).join(' · ')
const virgola = (n) => n.toFixed(1).replace('.', ',')

// Le scene che lo scroll della landing chiede al telefono.
const SCENE = {
  home: { tab: 'home', atleta: null, foglio: null },
  builder: { tab: 'workout', atleta: null, foglio: null, aperto: null },
  tipo: { tab: 'workout', atleta: null, foglio: 'tipo', aperto: 'For Time' },
  ia: { tab: 'workout', atleta: null, foglio: 'ia', aperto: null },
  atleta: { tab: 'atleti', atleta: 'luca', foglio: null },
  calendario: { tab: 'calendario', atleta: null, foglio: null },
}
// Dove pulsa il cerchio «tocca qui» in ogni scena, finché la persona non tocca.
const QUI = { home: 'atleta-luca', builder: 'blocco-For Time', tipo: 'tipo-EMOM', ia: 'ia-applica', atleta: 'indietro', calendario: 'giorno-dopo' }

export default function AppFinta({ scena = 'home', suggerisci = false }) {
  const scala = useRef(null)
  const app = useRef(null)

  // Lo schermo del telefono cambia misura con la finestra: l'app resta a 402 px e si scala.
  useEffect(() => {
    const fuori = scala.current, dentro = app.current
    if (!fuori || !dentro || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => { dentro.style.transform = `scale(${fuori.clientWidth / LARGO})` })
    ro.observe(fuori)
    return () => ro.disconnect()
  }, [])

  const [blocchi, setBlocchi] = useState(INIZIO)
  const [prima, setPrima] = useState(null) // per «Annulla» dopo l'IA
  const [stato, setStato] = useState(() => ({ ...SCENE[scena], aperto: null }))
  const [scenaVista, setScenaVista] = useState(scena)
  const [avviso, setAvviso] = useState(null)
  const [assegnati, setAssegnati] = useState([])

  // Lo scroll ha cambiato capitolo: il telefono va alla scena giusta (lo stato dei blocchi resta).
  const [toccato, setToccato] = useState(false)
  if (scena !== scenaVista) {
    setScenaVista(scena)
    setToccato(false)
    const s = SCENE[scena]
    const aperto = s.aperto ? blocchi.find((b) => b.tipo === s.aperto)?.id ?? blocchi[blocchi.length - 1]?.id : null
    setStato({ ...s, aperto })
  }

  useEffect(() => {
    if (!avviso) return
    const t = setTimeout(() => setAvviso(null), avviso.annulla ? 5000 : 2800)
    return () => clearTimeout(t)
  }, [avviso])

  const vai = (cambi) => setStato((s) => ({ ...s, ...cambi }))
  const chiudiFoglio = () => vai({ foglio: null })

  const cambiaTipo = (tipo) => {
    setBlocchi((bs) => bs.map((b) => (b.id === stato.aperto ? { ...b, tipo, rpe: RPE_TIPO[tipo], giri: tipo === 'For Time' ? b.giri ?? 3 : undefined } : b)))
    chiudiFoglio()
  }
  const aggiungi = (tipo) => {
    const nuovo = blocco(tipo, tipo === 'Rest' ? 2 : 8, tipo === 'Rest' ? [] : ESERCIZI_NUOVI.slice(0, 2))
    setBlocchi((bs) => [...bs, nuovo])
    vai({ foglio: null, aperto: nuovo.id })
  }
  const togli = (id) => setBlocchi((bs) => bs.filter((b) => b.id !== id))
  const applicaIA = () => {
    setPrima(blocchi)
    setBlocchi(PROPOSTA_IA(blocchi))
    vai({ foglio: null, aperto: null })
    setAvviso({ testo: 'Blocchi aggiornati dall\'IA', annulla: true })
  }
  const annullaIA = () => { if (prima) setBlocchi(prima); setPrima(null); setAvviso(null) }
  const assegna = (ids) => {
    setAssegnati(ids)
    chiudiFoglio()
    const nomi = ATLETI.filter((a) => ids.includes(a.id)).map((a) => a.nome.split(' ')[0])
    const elenco = nomi.length > 3
      ? `${nomi.slice(0, 2).join(', ')} e altri ${nomi.length - 2}`
      : nomi.length > 1 ? `${nomi.slice(0, -1).join(', ')} e ${nomi[nomi.length - 1]}` : nomi[0]
    setAvviso({ testo: `Assegnato a ${elenco}` })
  }

  const atleta = ATLETI.find((a) => a.id === stato.atleta)
  const qui = (id) => (suggerisci && !toccato && QUI[scena] === id ? ' lm-qui' : '')

  return (
    <div className="lm-scala" ref={scala}>
      <div className="lm-app" ref={app} onPointerDown={() => setToccato(true)}>
        <BarraStato />
        <div className="lm-corpo" key={`${stato.tab}-${stato.atleta ?? ''}`}>
          {stato.tab === 'home' && <Home qui={qui} apri={(id) => vai({ tab: 'atleti', atleta: id })} />}
          {stato.tab === 'workout' && (
            <Builder qui={qui} blocchi={blocchi} aperto={stato.aperto}
              apri={(id) => vai({ aperto: stato.aperto === id ? null : id })}
              foglio={(f) => vai({ foglio: f })} togli={togli} />
          )}
          {stato.tab === 'calendario' && <Calendario qui={qui} assegnati={assegnati} />}
          {stato.tab === 'atleti' && (atleta
            ? <Atleta qui={qui} a={atleta} indietro={() => vai({ atleta: null })} />
            : <Atleti apri={(id) => vai({ atleta: id })} />)}
        </div>

        <nav className="lm-tab" aria-label="Sezioni dell'app di prova">
          {[['home', 'Home', IconaHome], ['workout', 'Workout', Dumbbell], ['calendario', 'Calendario', CalendarDays], ['atleti', 'Atleti', Users]].map(([id, nome, Icona]) => (
            <button key={id} className={stato.tab === id ? 'attivo' : ''} onClick={() => vai({ tab: id, atleta: null, foglio: null })}>
              <span className="lm-tab-icona"><Icona size={20} /></span>{nome}
            </button>
          ))}
        </nav>

        <Foglio aperto={stato.foglio === 'tipo'} chiudi={chiudiFoglio} titolo="Cambia tipo di blocco" icona={Repeat2}>
          <p className="lm-foglio-nota">Esercizi e numeri restano al loro posto.</p>
          <GrigliaTipi qui={qui} attuale={blocchi.find((b) => b.id === stato.aperto)?.tipo} scegli={cambiaTipo} />
        </Foglio>
        <Foglio aperto={stato.foglio === 'aggiungi'} chiudi={chiudiFoglio} titolo="Aggiungi blocco" icona={Plus}>
          <GrigliaTipi scegli={aggiungi} />
        </Foglio>
        <FoglioIA qui={qui} aperto={stato.foglio === 'ia'} chiudi={chiudiFoglio} applica={applicaIA} />
        <FoglioAssegna aperto={stato.foglio === 'assegna'} chiudi={chiudiFoglio} assegna={assegna} />

        <div className={`lm-avviso ${avviso ? 'dentro' : ''}`} role="status">
          {avviso && <><Check size={16} />{avviso.testo}{avviso.annulla && <button onClick={annullaIA}><Undo2 size={14} /> Annulla</button>}</>}
        </div>
      </div>
    </div>
  )
}

function BarraStato() {
  const [ora, setOra] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setOra(new Date()), 15000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="lm-stato" aria-hidden="true">
      <span>{format(ora, 'H:mm')}</span>
      <span className="lm-stato-icone"><i /><i /><i /><i /><b /></span>
    </div>
  )
}

function Testa({ sopra, titolo, indietro, destra, qui = () => '' }) {
  return (
    <header className="lm-testa">
      {indietro && <button className={`lm-tondo${qui('indietro')}`} onClick={indietro} aria-label="Indietro"><ChevronLeft size={20} /></button>}
      <div className="lm-testa-t">
        {sopra && <div className="lm-sopra">{sopra}</div>}
        <h3>{titolo}</h3>
      </div>
      {destra}
    </header>
  )
}

/* ─────────────── Home del coach ─────────────── */

function Home({ apri, qui }) {
  const fatti = ATLETI.filter((a) => a.oggi.fatto)
  const [oggi] = useState(() => new Date())
  return (
    <>
      <Testa sopra={format(oggi, 'EEE d MMMM', { locale: it }) + ` · ${ATLETI.length} atleti`}
        titolo={<>FLEO<b>FIT</b> <span className="lm-coach">Coach</span></>}
        destra={<button className="lm-tondo lm-campana" aria-label="Notifiche"><Bell size={18} /><i /></button>} />
      <div className="lm-cerca"><Search size={16} /> Cerca atleti, workout, note…</div>
      <div className="lm-tre">
        <div className="lm-card lm-mini"><span>Aderenza 7 gg</span><b>90<small>%</small></b><em className="lm-giu">↓ 5 punti</em></div>
        <div className="lm-card lm-mini"><span>Come sta il team</span><b className="lm-piccolo">Così così</b><em>2 da tenere d'occhio</em></div>
        <div className="lm-card lm-mini"><span>RPE medio</span><b>7,1</b><em>previsto 6,8</em></div>
      </div>

      <section className="lm-card">
        <div className="lm-card-t">Da tenere d'occhio</div>
        {ATLETI.filter((a) => a.avviso).map((a) => (
          <button key={a.id} className="lm-riga" onClick={() => apri(a.id)}>
            <span className="lm-icona-avviso"><AlertTriangle size={16} /></span>
            <span className="lm-riga-t"><b>{a.nome}</b><small>{a.avviso}</small></span>
            <ChevronRight size={16} className="lm-freccia" />
          </button>
        ))}
      </section>

      <section className="lm-card">
        <div className="lm-card-t">Oggi <span className="lm-conta">{fatti.length} su {ATLETI.length} fatti</span></div>
        <div className="lm-avanz">{ATLETI.map((a) => <i key={a.id} className={a.oggi.fatto ? 'pieno' : ''} />)}</div>
        {ATLETI.map((a) => (
          <button key={a.id} className={`lm-riga${qui(`atleta-${a.id}`)}`} onClick={() => apri(a.id)}>
            <span className="lm-avatar" style={{ '--c': CAT[a.oggi.cat].colore }}>{iniziali(a.nome)}</span>
            <span className="lm-riga-t">
              <b>{a.nome}</b>
              <small><i style={{ color: CAT[a.oggi.cat].colore }}>{CAT[a.oggi.cat].nome}</i> · {a.oggi.titolo}</small>
            </span>
            {a.oggi.fatto
              ? <span className="lm-rpe" style={{ '--c': coloreRpe(a.oggi.rpe) }}>RPE {a.oggi.rpe}</span>
              : <span className="lm-dafare">Da fare</span>}
          </button>
        ))}
      </section>
    </>
  )
}

/* ─────────────── Builder ─────────────── */

function Builder({ blocchi, aperto, apri, foglio, togli, qui }) {
  const durata = blocchi.reduce((s, b) => s + b.min, 0)
  const carico = blocchi.reduce((s, b) => s + b.min * b.rpe, 0)
  const rpe = durata ? carico / durata : 0
  return (
    <>
      <Testa sopra="Hyrox · mar 3 nov" titolo="Hyrox compromised"
        destra={<span className="lm-pill" style={{ '--c': CAT.hyrox.colore }}>Hyrox</span>} />
      <div className="lm-card lm-numeri">
        <div><span>Durata</span><b key={durata}>{durata}<small> min</small></b></div>
        <div><span>Blocchi</span><b key={blocchi.length}>{blocchi.length}</b></div>
        <div><span>RPE atteso</span><b key={rpe} style={{ color: coloreRpe(rpe) }}>{virgola(rpe)}</b></div>
        <div><span>Carico</span><b key={carico}>≈{carico}</b></div>
      </div>

      <button className="lm-ia" onClick={() => foglio('ia')}>
        <span className="lm-ia-icona"><Sparkles size={18} /></span>
        <span className="lm-riga-t"><b>Genera con IA</b><small>Chiedi una modifica ai blocchi che hai</small></span>
        <ChevronRight size={16} />
      </button>

      <ul className="lm-blocchi">
        {blocchi.map((b) => {
          const su = b.id === aperto
          return (
            <li key={b.id} className={`lm-blocco ${su ? 'aperto' : ''}`}>
              <button className={`lm-blocco-testa${qui(`blocco-${b.tipo}`)}`} onClick={() => apri(b.id)} aria-expanded={su}>
                <span className="lm-riga-t"><b key={b.tipo} className="lm-cambio">{b.tipo}</b><small>{sottotitolo(b)}</small></span>
                <span className="lm-tempo">{b.min}:00</span>
              </button>
              {su && (
                <div className="lm-blocco-dentro">
                  <button className="lm-cambia" onClick={() => foglio('tipo')}>
                    <Repeat2 size={18} /><b>Cambia tipo di blocco</b><span>{b.tipo}</span>
                  </button>
                  {b.esercizi.map(([n, d], i) => (
                    <div key={n + i} className="lm-esercizio">
                      <span className="lm-num">{i + 1}</span>
                      <span className="lm-riga-t"><b>{n}</b><small>{d}</small></span>
                      <span className="lm-int">{b.rpe}/10</span>
                    </div>
                  ))}
                  <button className="lm-togli" onClick={() => togli(b.id)}>Elimina blocco</button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <button className="lm-aggiungi" onClick={() => foglio('aggiungi')}><Plus size={18} /> Aggiungi blocco</button>
      <button className="lm-assegna" onClick={() => foglio('assegna')}><Send size={17} /> Assegna</button>
    </>
  )
}

function GrigliaTipi({ attuale, scegli, qui = () => '' }) {
  return (
    <div className="lm-tipi">
      {TIPI.map((t) => <button key={t} className={(t === attuale ? 'attuale' : '') + qui(`tipo-${t}`)} onClick={() => scegli(t)}>{t}</button>)}
    </div>
  )
}

function Foglio({ aperto, chiudi, titolo, icona: Icona, viola, children }) {
  return (
    <>
      <div className={`lm-velo ${aperto ? 'dentro' : ''}`} onClick={chiudi} aria-hidden="true" />
      <div className={`lm-foglio ${aperto ? 'dentro' : ''} ${viola ? 'viola' : ''}`} role="dialog" aria-label={titolo} aria-hidden={!aperto} inert={!aperto}>
        <span className="lm-maniglia" />
        <div className="lm-foglio-t"><Icona size={19} />{titolo}<button className="lm-tondo" onClick={chiudi} aria-label="Chiudi"><X size={17} /></button></div>
        {children}
      </div>
    </>
  )
}

function FoglioIA({ aperto, chiudi, applica, qui }) {
  const [n, setN] = useState(0)
  const [pensa, setPensa] = useState(false)
  const [eraAperto, setEraAperto] = useState(aperto)
  if (aperto !== eraAperto) { setEraAperto(aperto); if (aperto) { setN(0); setPensa(false) } }
  useEffect(() => {
    if (!aperto || n >= RICHIESTA_IA.length) return
    const t = setTimeout(() => setN((x) => x + 2), 22)
    return () => clearTimeout(t)
  }, [aperto, n])
  const scritto = n >= RICHIESTA_IA.length
  return (
    <Foglio aperto={aperto} chiudi={chiudi} titolo="Genera con IA" icona={Sparkles} viola>
      <div className={`lm-ia-testo ${pensa ? 'pensa' : ''}`}>{RICHIESTA_IA.slice(0, n)}{!scritto && <i />}</div>
      <div className="lm-ia-azioni">
        <span><Mic size={16} /> Detta</span>
        <button className={scritto && !pensa ? qui('ia-applica') : ''} disabled={!scritto || pensa} onClick={() => { setPensa(true); setTimeout(applica, 1500) }}>{pensa ? 'Sto scrivendo i blocchi…' : 'Modifica i blocchi'}</button>
      </div>
    </Foglio>
  )
}

function FoglioAssegna({ aperto, chiudi, assegna }) {
  const [scelti, setScelti] = useState(['sara', 'luca', 'giulia'])
  const inverti = (id) => setScelti((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  return (
    <Foglio aperto={aperto} chiudi={chiudi} titolo="A chi lo assegni?" icona={Users}>
      <div className="lm-chips">
        {ATLETI.map((a) => (
          <button key={a.id} className={scelti.includes(a.id) ? 'scelto' : ''} onClick={() => inverti(a.id)} aria-pressed={scelti.includes(a.id)}>
            {scelti.includes(a.id) && <Check size={14} />}{a.nome}
          </button>
        ))}
      </div>
      <button className="lm-assegna lm-assegna-foglio" disabled={!scelti.length} onClick={() => assegna(scelti)}>
        <Send size={17} /> Assegna a {scelti.length}
      </button>
    </Foglio>
  )
}

/* ─────────────── Calendario ─────────────── */

const SETTIMANA = [
  [['Sara Villa', 'Hyrox forte · EMOM 40', 'hyrox'], ['Luca Bianchi', 'Ripetute 6 × 800 m', 'corsa'], ['Marco Rossi', 'Forza · gambe', 'gym']],
  [['Giulia Neri', 'Hyrox medio · sled', 'hyrox'], ['Elena Moretti', 'Fondo lento 12 km', 'corsa']],
  [['Davide Ricci', 'Hyrox forte · sled', 'hyrox'], ['Sara Villa', 'Spinta · forza', 'gym']],
  [['Luca Bianchi', 'Progressivo a zone', 'corsa'], ['Giulia Neri', 'ON/OFF Engine', 'hyrox']],
  [['Marco Rossi', 'Tirata · ipertrofia', 'gym'], ['Elena Moretti', '3 × (4′ Z3 + 3′ Z2)', 'corsa']],
  [['Sara Villa', 'Simulazione gara', 'hyrox']],
  [],
]

function Calendario({ assegnati, qui }) {
  const [lunedi] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [oggi] = useState(() => (new Date().getDay() + 6) % 7)
  const [giorno, setGiorno] = useState(oggi)
  const extra = giorno === Math.min(6, oggi + 1)
    ? ATLETI.filter((a) => assegnati.includes(a.id)).map((a) => [a.nome, 'Hyrox compromised', 'hyrox', true])
    : []
  const lista = [...SETTIMANA[giorno], ...extra]
  return (
    <>
      <Testa sopra={format(lunedi, 'MMMM yyyy', { locale: it })} titolo="Calendario" />
      <div className="lm-settimana">
        {Array.from({ length: 7 }, (_, i) => {
          const d = addDays(lunedi, i)
          const n = SETTIMANA[i].length + (i === Math.min(6, oggi + 1) ? assegnati.length : 0)
          return (
            <button key={i} className={`${i === giorno ? 'scelto' : ''} ${i === oggi ? 'oggi' : ''}${i === Math.min(6, oggi + 1) ? qui('giorno-dopo') : ''}`} onClick={() => setGiorno(i)}>
              <span>{format(d, 'EEEEE', { locale: it })}</span>
              <b>{format(d, 'd')}</b>
              <em>{Array.from({ length: Math.min(3, n) }, (_, k) => <i key={k} />)}</em>
            </button>
          )
        })}
      </div>
      <div className="lm-giorno-t">{format(addDays(lunedi, giorno), 'EEEE d MMMM', { locale: it })}</div>
      <div className="lm-lista" key={giorno}>
        {lista.length ? lista.map(([nome, titolo, cat, nuovo], i) => (
          <div key={nome + titolo} className="lm-card lm-evento" style={{ '--c': CAT[cat].colore, animationDelay: `${i * 50}ms` }}>
            <span className="lm-riga-t"><b>{titolo}</b><small>{nome}</small></span>
            {nuovo ? <span className="lm-pill lm-nuovo">Appena assegnato</span> : <span className="lm-pill" style={{ '--c': CAT[cat].colore }}>{CAT[cat].nome}</span>}
          </div>
        )) : <div className="lm-vuoto">Giorno di riposo per tutti 😴</div>}
      </div>
    </>
  )
}

/* ─────────────── Atleti ─────────────── */

function Atleti({ apri }) {
  return (
    <>
      <Testa sopra={`${ATLETI.length} atleti`} titolo="Atleti" />
      <section className="lm-card lm-card-lista">
        {ATLETI.map((a) => (
          <button key={a.id} className="lm-riga" onClick={() => apri(a.id)}>
            <span className="lm-avatar" style={{ '--c': CAT[a.oggi.cat].colore }}>{iniziali(a.nome)}</span>
            <span className="lm-riga-t"><b>{a.nome}</b><small>{a.avviso ?? `Aderenza ${a.aderenza}%`}</small></span>
            <span className={`lm-ader ${a.aderenza < 80 ? 'basso' : ''}`}>{a.aderenza}%</span>
          </button>
        ))}
      </section>
    </>
  )
}

function Atleta({ a, indietro, qui }) {
  const max = Math.max(...a.carico)
  const giro = 2 * Math.PI * 34
  return (
    <>
      <Testa qui={qui} indietro={indietro} sopra="Atleta" titolo={a.nome} />
      <section className="lm-card">
        <div className="lm-card-t lm-maiusc">Come sta andando · 30 giorni</div>
        <div className="lm-andamento">
          <div className="lm-anello">
            <svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" className="fondo" /><circle cx="40" cy="40" r="34" className="pieno" style={{ strokeDasharray: giro, '--fine': giro * (1 - a.aderenza / 100) }} /></svg>
            <b>{a.aderenza}<small>%</small></b>
          </div>
          <div className="lm-barre">
            <span className="lm-barre-t">Carico · min × RPE</span>
            <div className="lm-barre-col">
              {a.carico.map((c, i) => (
                <span key={i} className={i === a.carico.length - 1 ? 'ultima' : ''} style={{ '--h': `${(c / max) * 100}%`, animationDelay: `${i * 80}ms` }}><i>{c}</i></span>
              ))}
            </div>
          </div>
        </div>
        {a.avviso && <div className="lm-allarme"><TrendingUp size={15} />{a.avviso}</div>}
      </section>
      <div className="lm-sezione-t">Oggi</div>
      <section className={`lm-card lm-oggi ${a.oggi.fatto ? 'fatto' : ''}`}>
        <div className="lm-oggi-testa">
          <span className="lm-oggi-check">{a.oggi.fatto ? <Check size={20} /> : null}</span>
          <span className="lm-riga-t"><b>{a.oggi.titolo}</b><small>{a.oggi.fatto ? 'Completato' : 'Da fare'}</small></span>
        </div>
        {a.oggi.fatto && (
          <>
            <span className="lm-sforzo">Sforzo: <b style={{ color: coloreRpe(a.oggi.rpe) }}>{a.oggi.rpe}/10</b></span>
            <p className="lm-nota">«{a.oggi.nota}»</p>
          </>
        )}
      </section>
    </>
  )
}
