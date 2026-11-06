import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogIn, Tv, Check, ArrowRight, Plus, Pointer, List, ChevronDown } from 'lucide-react'
import { COLORI, TIPI_BLOCCO, PROFILO_CORSA, STAZIONI, ATLETI } from './landingDati'
import builderDesktop from '../assets/landing/builder-desktop.webp'
import AppFinta from './LandingApp'
import './Landing.css'

/* ─────────────────────────────────────────────────────────────────────────
   Landing pubblica /benvenuto (solo web), rivolta ai COACH.
   Nel telefono gira un'app FINTA che si tocca (LandingApp.jsx): nessun dato
   vero, nessuna chiamata. Lo scroll la muove e la porta di capitolo in
   capitolo; in mezzo la persona la usa come vuole. docs/memoria/landing.md.
   ───────────────────────────────────────────────────────────────────────── */

const URL_PAGINA = 'https://fleofit.vercel.app/benvenuto'
const TITOLO_SEO = 'App per coach Hyrox e running | FLEOFIT'
const DESCRIZIONE_SEO = 'Crea workout Hyrox, di corsa e da palestra a blocchi, assegnali ai tuoi atleti e segui aderenza, fatica e andamento. L\'app per coach, in italiano.'

const ridotto = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const attesa = (ms) => new Promise((r) => setTimeout(r, ridotto() ? 0 : ms))

// Vero quando l'elemento è a schermo. `unaVolta` lo lascia acceso dopo il primo ingresso.
function useInVista(ref, { soglia = 0.35, unaVolta = false } = {}) {
  const [visto, setVisto] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setVisto(true); return }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisto(true); if (unaVolta) io.disconnect() }
      else if (!unaVolta) setVisto(false)
    }, { threshold: soglia })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, soglia, unaVolta])
  return visto
}

/* ═══════════════════════════ SEO ═══════════════════════════ */

const FAQ = [
  {
    d: 'Cos\'è FLEOFIT?',
    r: 'È un\'app per coach di Hyrox, running e palestra. Crei gli allenamenti a blocchi, li assegni ai tuoi atleti, loro li eseguono dall\'app e ti mandano fatica percepita (RPE) e note. Tu vedi aderenza, carico e andamento di tutta la squadra.',
  },
  {
    d: 'Va bene anche per la corsa e la palestra, non solo per Hyrox?',
    r: 'Sì. Per la corsa scrivi fasi e ripetute con il ritmo al chilometro o le zone, anche in sequenze libere come 3 × (4′ Z3 + 3′ Z2). Per la palestra scrivi esercizi, serie, ripetizioni, carichi e superserie. Le tre cose stanno nello stesso calendario.',
  },
  {
    d: 'Come ricevono gli allenamenti i miei atleti?',
    r: 'Dall\'app per iPhone o dal browser del telefono, con una notifica quando assegni la seduta. Durante l\'allenamento possono seguire il timer guidato; alla fine segnano la fatica e lasciano una nota, anche vocale.',
  },
  {
    d: 'Posso creare un workout con l\'intelligenza artificiale?',
    r: 'Sì. Descrivi la seduta o la modifica a parole, anche dettandola, oppure fotografa la lavagna: il builder scrive i blocchi e tu li ritocchi. Ogni modifica si può annullare.',
  },
  {
    d: 'Posso mostrare l\'allenamento sulla TV della palestra?',
    r: 'Sì. Apri la schermata TV sul televisore e collegala dal telefono con il codice di quattro cifre o inquadrando il QR: tempo, esercizio e persone in allenamento si leggono da lontano.',
  },
  {
    d: 'Posso lavorare insieme ad altri coach?',
    r: 'Sì. Più coach possono lavorare nello stesso spazio, ognuno con i propri atleti, i propri workout e i propri codici invito.',
  },
  {
    d: 'Come si accede?',
    r: 'L\'accesso è su invito. Se hai già un account coach entri dal bottone Accedi; i tuoi atleti si registrano con il codice invito che gli mandi tu.',
  },
]

const DATI_STRUTTURATI = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${URL_PAGINA}#pagina`,
      url: URL_PAGINA,
      name: TITOLO_SEO,
      description: DESCRIZIONE_SEO,
      inLanguage: 'it-IT',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'FLEOFIT',
      applicationCategory: 'HealthApplication',
      operatingSystem: 'iOS, Web',
      inLanguage: 'it-IT',
      description: DESCRIZIONE_SEO,
      url: URL_PAGINA,
      featureList: [
        'Builder di workout a blocchi Hyrox: WarmUp, Cash In, ON/OFF, EMOM, AMRAP, For Time, Interval, Rest, Cash Out',
        'Ripetute di corsa con ritmo al chilometro o zone',
        'Schede da palestra con serie, ripetizioni, carichi e superserie',
        'Generazione dei workout con l\'IA, a voce o da una foto',
        'Aderenza, carico e RPE di ogni atleta',
        'Schermata TV per la palestra',
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQ.map((f) => ({
        '@type': 'Question',
        name: f.d,
        acceptedAnswer: { '@type': 'Answer', text: f.r },
      })),
    },
  ],
}

// Titolo, meta e dati strutturati della pagina; tolti all'uscita, così le
// pagine dell'app non se li portano dietro.
function useTestaPagina() {
  useEffect(() => {
    const prima = document.title
    document.title = TITOLO_SEO
    const aggiunti = []
    const meta = (attr, chiave, valore) => {
      let el = document.head.querySelector(`meta[${attr}="${chiave}"]`)
      const vecchio = el?.getAttribute('content')
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, chiave); document.head.appendChild(el); aggiunti.push(() => el.remove()) }
      else aggiunti.push(() => el.setAttribute('content', vecchio))
      el.setAttribute('content', valore)
    }
    meta('name', 'description', DESCRIZIONE_SEO)
    meta('name', 'robots', 'index, follow')
    meta('property', 'og:type', 'website')
    meta('property', 'og:locale', 'it_IT')
    meta('property', 'og:title', TITOLO_SEO)
    meta('property', 'og:description', DESCRIZIONE_SEO)
    meta('property', 'og:url', URL_PAGINA)
    meta('property', 'og:image', 'https://fleofit.vercel.app/web-app-manifest-512x512.png')
    meta('name', 'twitter:card', 'summary')
    const link = document.createElement('link')
    link.rel = 'canonical'; link.href = URL_PAGINA
    document.head.appendChild(link)
    const ld = document.createElement('script')
    ld.type = 'application/ld+json'; ld.textContent = JSON.stringify(DATI_STRUTTURATI)
    document.head.appendChild(ld)
    return () => {
      document.title = prima
      link.remove(); ld.remove()
      aggiunti.forEach((f) => f())
    }
  }, [])
}

/* ═══════════════════════════ Il telefono ═══════════════════════════ */

// I capitoli dello scroll: ognuno porta l'app finta a una scena e suggerisce cosa toccare.
// `zoom` è il dettaglio su cui la camera si avvicina a metà capitolo: fx e fy sono il punto
// del telefono (0–1 da sinistra e dall'alto), s quanto ingrandisce.
const CAPITOLI = [
  {
    titolo: 'Apri l\'app e sai chi si è allenato.',
    testo: 'Aderenza della settimana, RPE medio, chi è da tenere d\'occhio. La squadra in una schermata, senza scrivere a ogni atleta per sapere com\'è andata.',
    breve: 'La squadra oggi', zoom: { fx: 0.5, fy: 0.24, s: 1.75 },
    scena: 'home', prova: 'Tocca un atleta.',
  },
  {
    titolo: 'Scrivi la seduta a blocchi Hyrox.',
    testo: 'WarmUp, Cash In, ON/OFF, EMOM, AMRAP, For Time, Cash Out. Durata, carico e RPE atteso si ricalcolano mentre scrivi.',
    breve: 'Il builder', zoom: { fx: 0.5, fy: 0.2, s: 1.8 },
    scena: 'builder', prova: 'Apri un blocco, aggiungine uno, poi premi Assegna.',
  },
  {
    titolo: 'Cambi idea? Si cambia da dentro.',
    testo: 'Un For Time diventa un EMOM con un tocco: esercizi e numeri restano al loro posto. Niente blocco da cancellare e rifare.',
    breve: 'Cambia tipo', zoom: { fx: 0.5, fy: 0.8, s: 1.6 },
    scena: 'tipo', prova: 'Scegli un altro tipo per il For Time.',
  },
  {
    titolo: 'Oppure chiedilo all\'IA.',
    testo: 'Scrivi o detta la modifica, o fotografa la lavagna: il builder riscrive i blocchi che hai già. Se non ti piace, annulli.',
    breve: 'Genera con IA', zoom: { fx: 0.5, fy: 0.78, s: 1.6 },
    scena: 'ia', prova: 'Premi «Modifica i blocchi», poi Annulla.',
  },
  {
    titolo: 'Ogni atleta, il suo andamento.',
    testo: 'Aderenza, carico e fatica dichiarata settimana per settimana. Vedi chi sta spingendo troppo prima che si fermi, e chi ha smesso di allenarsi.',
    breve: 'Ogni atleta', zoom: { fx: 0.5, fy: 0.22, s: 1.75 },
    scena: 'atleta', prova: 'Torna indietro e apri un altro atleta.',
  },
  {
    titolo: 'La settimana di tutta la squadra.',
    testo: 'Hyrox, corsa e palestra nello stesso calendario, giorno per giorno. Quello che assegni compare subito.',
    breve: 'Il calendario', zoom: { fx: 0.5, fy: 0.19, s: 1.8 },
    scena: 'calendario', prova: 'Tocca un altro giorno.',
  },
]

/* ═══════════════════════════ L'indice ═══════════════════════════ */

// Le voci dell'indice a sinistra: l'apertura, i sei capitoli, le sezioni sotto.
const VOCI = [
  { id: 'inizio', nome: 'Inizio' },
  ...CAPITOLI.map((c, i) => ({ id: `lp-cap-${i + 1}`, nome: c.breve })),
  { id: 'lp-computer', nome: 'Dal computer' },
  { id: 'lp-tv', nome: 'La TV in sala' },
  { id: 'lp-domande', nome: 'Domande' },
]
// Dove sta una voce nella pagina. I capitoli sono tratti di scroll: si salta al loro inizio.
const posizione = (id) => {
  if (id === 'inizio') return 0
  const el = document.getElementById(id)
  if (!el) return 0
  const y = el.getBoundingClientRect().top + window.scrollY
  return id.startsWith('lp-cap-') ? y + 2 : y - 72
}
const vaiA = (id) => window.scrollTo({ top: posizione(id), behavior: ridotto() ? 'auto' : 'smooth' })

function Indice() {
  const [aperto, setAperto] = useState(false)
  const [qui, setQui] = useState('inizio')
  useEffect(() => {
    let raf = 0
    const guarda = () => {
      raf = 0
      const y = window.scrollY + window.innerHeight * 0.35
      let ultima = 'inizio'
      for (const v of VOCI) if (posizione(v.id) <= y) ultima = v.id
      setQui(ultima)
    }
    const chiedi = () => { if (!raf) raf = requestAnimationFrame(guarda) }
    guarda()
    window.addEventListener('scroll', chiedi, { passive: true })
    const esc = (e) => { if (e.key === 'Escape') setAperto(false) }
    window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('scroll', chiedi); window.removeEventListener('keydown', esc); cancelAnimationFrame(raf) }
  }, [])
  const n = VOCI.findIndex((v) => v.id === qui)
  return (
    <>
      {aperto && <div className="lp-indice-velo" onClick={() => setAperto(false)} aria-hidden="true" />}
      <nav className={`lp-indice ${aperto ? 'aperto' : ''}`} aria-label="Indice della pagina">
        <button className="lp-indice-tasto" onClick={() => setAperto((a) => !a)} aria-expanded={aperto} aria-controls="lp-indice-lista">
          <List size={18} aria-hidden="true" />
          <span className="lp-indice-num">{String(n + 1).padStart(2, '0')}<i>/{String(VOCI.length).padStart(2, '0')}</i></span>
          <span className="lp-indice-barra" aria-hidden="true"><i style={{ height: `${((n + 1) / VOCI.length) * 100}%` }} /></span>
        </button>
        <ol id="lp-indice-lista" className="lp-indice-lista" hidden={!aperto}>
          {VOCI.map((v, i) => (
            <li key={v.id}>
              <button className={v.id === qui ? 'qui' : ''} aria-current={v.id === qui ? 'location' : undefined}
                onClick={() => { setAperto(false); vaiA(v.id) }}>
                <span>{String(i + 1).padStart(2, '0')}</span>{v.nome}
              </button>
            </li>
          ))}
        </ol>
      </nav>
    </>
  )
}

/* ═══════════════════ Il telefono che si muove con lo scroll ═══════════════════
   Come un oggetto sul tavolo: parte dritto sotto il titolo, poi si sposta di
   lato e gira su se stesso a ogni capitolo, e intanto cambia schermata. */

// Le pose: una per l'apertura e una per capitolo. x in vw dal centro, y in vh,
// rotazioni in gradi, s = scala.
const POSE = {
  // Sul computer ry resta sempre negativo: così si vede il fianco destro, con tutto lo
  // spessore. Con ry positivo, a telefono spostato a destra, il fianco quasi sparisce.
  largo: [
    { x: 0, y: 46, rx: 26, ry: 0, rz: 0, s: 1 },
    { x: 21, y: 0, rx: 10, ry: -36, rz: 3, s: 1 },
    { x: 19, y: 0, rx: 6, ry: -22, rz: -5, s: 1.03 },
    { x: 23, y: 1, rx: 12, ry: -46, rz: 4, s: 1 },
    { x: 20, y: 0, rx: -4, ry: -28, rz: -3, s: 1 },
    { x: 22, y: 0, rx: 14, ry: -40, rz: 0, s: 1.04 },
    { x: 20, y: 0, rx: 6, ry: -24, rz: 3, s: 1 },
  ],
  stretto: [
    { x: 0, y: 40, rx: 24, ry: 0, rz: 0, s: 1 },
    { x: 0, y: -13, rx: 12, ry: -30, rz: 3, s: 1 },
    { x: 0, y: -13, rx: 6, ry: -18, rz: -4, s: 1.03 },
    { x: 0, y: -13, rx: 14, ry: -34, rz: 4, s: 1 },
    { x: 0, y: -13, rx: -2, ry: 28, rz: -3, s: 1 },
    { x: 0, y: -13, rx: 12, ry: -24, rz: 0, s: 1.02 },
    { x: 0, y: -13, rx: 6, ry: 26, rz: 3, s: 1 },
  ],
}
const liscio = (t) => t * t * (3 - 2 * t)
const mescola = (a, b, t) => Object.fromEntries(Object.keys(a).map((k) => [k, a[k] + (b[k] - a[k]) * t]))

// Il punto di un capitolo dove la camera si avvicina al dettaglio: sale, resta, torna.
const avvicina = (f) => liscio(Math.min(1, Math.max(0, (f - 0.1) / 0.16))) * (1 - liscio(Math.min(1, Math.max(0, (f - 0.42) / 0.16))))

function ScenaTelefono() {
  const sezione = useRef(null)
  const oggetto = useRef(null)
  const vista = useRef(null)
  const testi = useRef(null)
  const nota = useRef(null)
  // 0 = l'apertura (nessun testo di capitolo), poi 1…6.
  const [attivo, setAttivo] = useState(0)
  // Finché nessuno l'ha toccato, il telefono porta l'etichetta «Toccalo».
  const [toccato, setToccato] = useState(false)

  useEffect(() => {
    const el = sezione.current, ogg = oggetto.current
    if (!el || !ogg) return
    let raf = 0, visibile = true
    // La posa disegnata insegue quella voluta: lo scroll la sposta, il puntatore la inclina,
    // e un leggero ondeggiare la tiene viva. Così la profondità si vede sempre.
    const ora = { x: 0, y: 46, rx: 26, ry: 0, rz: 0, s: 1, dx: 0, dy: 0 }
    const mano = { dentro: false, px: 0, py: 0 }
    const giro = (tempo) => {
      raf = visibile ? requestAnimationFrame(giro) : 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      const stretto = window.innerWidth < 860
      // Il tratto di scroll: prima l'apertura (alta A), poi un capitolo ogni C.
      // p = 0…1 nell'apertura, poi c + f nel capitolo c (f = 0…1).
      const apertura = el.querySelector('.lp-apertura'), primo = el.querySelector('.lp-capitolo')
      const A = apertura.offsetHeight, C = primo.offsetHeight
      const sc = Math.max(0, -r.top)
      const p = Math.min(6.999, sc < A ? sc / A : 1 + (sc - A) / C)
      const c = Math.floor(p), f = p - c
      const ultimo = POSE.largo.length - 1
      const pose = (stretto ? POSE.stretto : POSE.largo).map((x) => ({ ...x, dx: 0, dy: 0 }))
      // All'inizio il telefono sta SOTTO i testi dell'apertura, qualunque sia la loro altezza.
      const fondo = nota.current?.getBoundingClientRect().bottom ?? vh * 0.8
      pose[0].y = ((fondo + 36 + ogg.offsetHeight * 0.48) - vh / 2) / vh * 100
      // Ogni posa resta ferma per più di metà capitolo, poi scivola nella successiva.
      const t = liscio(Math.min(1, Math.max(0, (f - 0.6) / 0.4)))
      const fermo = ridotto()
      const q = fermo ? { ...pose[Math.min(ultimo, Math.round(p))], rx: 0, ry: 0, rz: 0 } : mescola(pose[Math.min(ultimo, c)], pose[Math.min(ultimo, c + 1)], t)
      // A metà capitolo la camera si avvicina al dettaglio e il telefono si raddrizza.
      const dettaglio = c >= 1 ? CAPITOLI[c - 1].zoom : null
      if (dettaglio && !fermo) {
        const z = avvicina(f)
        const Z = 1 + (dettaglio.s - 1) * (stretto ? 0.7 : 1) * z
        // Porta il dettaglio dove prima c'era il centro del telefono.
        q.dx = -(dettaglio.fx - 0.5) * ogg.offsetWidth * Z * q.s * z
        q.dy = -(dettaglio.fy - 0.5) * ogg.offsetHeight * Z * q.s * z
        q.s *= Z
        q.rx *= 1 - 0.65 * z; q.ry *= 1 - 0.65 * z; q.rz *= 1 - 0.65 * z
      }
      if (!fermo) {
        if (mano.dentro) {
          // In mano: quasi dritto, si piega verso il puntatore e si avvicina un poco.
          q.rx = q.rx * 0.3 - mano.py * 10
          q.ry = q.ry * 0.3 + mano.px * 14
          q.rz *= 0.3
          q.s *= 1.03
        } else {
          q.rx += Math.cos(tempo / 1900) * 2.2
          q.ry += Math.sin(tempo / 1500) * 4
        }
      }
      const k = fermo ? 1 : 0.12
      for (const x of Object.keys(ora)) ora[x] += (q[x] - ora[x]) * k
      ogg.style.transform =
        `translate3d(${ora.x}vw, ${ora.y}vh, 0) translate(${ora.dx}px, ${ora.dy}px) rotateX(${ora.rx}deg) rotateY(${ora.ry}deg) rotateZ(${ora.rz}deg) scale(${ora.s})`
      ogg.style.setProperty('--luce', ora.ry.toFixed(2))
      // Il testo di un capitolo arriva verso la fine del precedente e, finché resta,
      // sale insieme allo scroll (--g da 0 a 1): si vede che la pagina scorre.
      const n = p < 0.8 ? 0 : Math.min(6, Math.floor(p + 0.2))
      setAttivo(n)
      if (testi.current) testi.current.style.setProperty('--g', n ? Math.min(1.2, p - (n - 0.2)).toFixed(3) : 0)
      // Su telefono il telefono sfuma prima della fascia del testo, anche quando si avvicina.
      const scritto = testi.current?.querySelector('.attivo')
      if (vista.current) vista.current.style.setProperty('--fascia', `${scritto ? vh - scritto.getBoundingClientRect().top + 30 : 0}px`)
    }
    raf = requestAnimationFrame(giro)
    // Fuori dallo schermo il giro si ferma.
    const io = new IntersectionObserver(([e]) => {
      visibile = e.isIntersecting
      if (visibile && !raf) raf = requestAnimationFrame(giro)
    })
    io.observe(el)
    const muovi = (e) => {
      const b = ogg.getBoundingClientRect()
      mano.px = Math.max(-1, Math.min(1, ((e.clientX - b.left) / b.width - 0.5) * 2))
      mano.py = Math.max(-1, Math.min(1, ((e.clientY - b.top) / b.height - 0.5) * 2))
    }
    const entra = () => { mano.dentro = true }
    const esce = () => { mano.dentro = false }
    const puoPassare = window.matchMedia?.('(hover: hover)').matches
    if (puoPassare) {
      ogg.addEventListener('pointerenter', entra)
      ogg.addEventListener('pointerleave', esce)
      ogg.addEventListener('pointermove', muovi)
    }
    return () => {
      cancelAnimationFrame(raf); io.disconnect()
      ogg.removeEventListener('pointerenter', entra); ogg.removeEventListener('pointerleave', esce); ogg.removeEventListener('pointermove', muovi)
    }
  }, [])

  return (
    <section className="lp-scena" ref={sezione} aria-labelledby="lp-titolo">
      <div className="lp-scena-palco">
        <div className={`lp-scena-vista ${attivo ? 'con-testo' : ''}`} ref={vista}>
          <div className="lp-tel-palco">
          <div className="lp-oggetto" ref={oggetto}>
            {/* Lo spessore: lastre una dietro l'altra, così girando si vede il bordo in metallo. */}
            {Array.from({ length: 30 }, (_, k) => <i key={k} className="lp-spessore" style={{ '--k': k + 1 }} />)}
            <i className="lp-tasto lp-tasto-azione" /><i className="lp-tasto lp-tasto-su" /><i className="lp-tasto lp-tasto-giu" /><i className="lp-tasto lp-tasto-acceso" />
            <div className="lp-telefono" onPointerDown={() => setToccato(true)}>
              <div className="lp-schermo lp-schermo-app">
                <AppFinta scena={CAPITOLI[Math.max(1, attivo) - 1].scena} suggerisci={attivo > 0} />
                <div className="lp-isola" aria-hidden="true" />
                <div className="lp-home-ind" aria-hidden="true" />
                <div className="lp-riflesso" aria-hidden="true" />
              </div>
            </div>
            <div className={`lp-toccalo ${toccato || attivo === 0 ? 'via' : ''}`} aria-hidden="true"><Pointer size={16} /> Toccalo, funziona</div>
          </div>
          </div>
          <div className="lp-testi" ref={testi}>
            {CAPITOLI.map((c, i) => (
              <div key={c.titolo} className={`lp-capitolo-testo ${attivo === i + 1 ? 'attivo' : ''}`} aria-hidden={attivo !== i + 1}>
                <h2 className="lp-h2">{c.titolo}</h2>
                <p className="lp-sotto">{c.testo}</p>
                <p className="lp-prova"><Pointer size={15} aria-hidden="true" /> {c.prova}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="lp-apertura">
        <h1 id="lp-titolo" className="lp-h1">L'app per coach Hyrox e running.<br /><span className="lp-giallo">Scrivi la seduta, segui ogni atleta.</span></h1>
        <p className="lp-sotto">
          Componi i workout con i blocchi veri di Hyrox, le ripetute di corsa e le schede da palestra.
          Li assegni in un tocco: l'atleta li riceve sul telefono, li esegue con il timer e ti dice
          com'è andata.
        </p>
        <div className="lp-azioni lp-azioni-centro">
          <Link to="/login" className="lp-btn lp-btn-primario"><LogIn size={18} aria-hidden="true" /> Accedi</Link>
          <Link to="/tv" className="lp-btn lp-btn-secondario"><Tv size={18} aria-hidden="true" /> Schermata TV</Link>
        </div>
        <p className="lp-nota" ref={nota}>L'accesso per i coach è su invito. Il telefono qui sotto è una demo con dati di esempio: si tocca.</p>
        <button className="lp-scorri" onClick={() => vaiA('lp-cap-1')}>Scorri <ChevronDown size={18} aria-hidden="true" /></button>
      </div>

      {/* I capitoli sono solo spazio da scorrere: i loro testi stanno fermi
          nella vista, impilati, e si danno il cambio (come su aster.video). */}
      {CAPITOLI.map((c, i) => <div key={c.titolo} id={`lp-cap-${i + 1}`} className="lp-capitolo" aria-hidden="true" />)}
      {/* Un po' di coda: l'ultimo capitolo ha il tempo di avvicinarsi e tornare. */}
      <div className="lp-capitolo-coda" aria-hidden="true" />
    </section>
  )
}

/* ═══════════════════════════ Dal computer ═══════════════════════════ */

function SezioneComputer() {
  const [scelto, setScelto] = useState(2)
  const pannello = useRef(null)
  const visto = useInVista(pannello, { soglia: 0.3, unaVolta: true })
  const t = TIPI_BLOCCO[scelto]

  return (
    <section className="lp-sezione" id="lp-computer" aria-labelledby="lp-computer-t">
      <div className="lp-sezione-testa">
        <h2 id="lp-computer-t" className="lp-h2">Dal computer, con tutto lo spazio.</h2>
        <p className="lp-sotto">
          La programmazione della settimana si fa meglio alla scrivania: blocchi a sinistra, durata,
          carico e intensità a destra, i blocchi da aggiungere a portata di clic. Quello che salvi è
          già sul telefono dei tuoi atleti.
        </p>
      </div>

      <figure className="lp-finestra">
        <div className="lp-finestra-barra" aria-hidden="true"><i /><i /><i /><span>fleofit.vercel.app/create</span></div>
        <img src={builderDesktop} alt="Il builder dei workout dal computer: blocchi Hyrox, durata stimata, carico, RPE atteso e blocchi da aggiungere" loading="lazy" decoding="async" />
      </figure>

      <div className="lp-sezione-testa lp-sezione-testa-dopo">
        <h3 className="lp-h2 lp-h2-medio">Nove blocchi, il vocabolario di Hyrox.</h3>
        <p className="lp-sotto">Non serie e ripetute generiche: ogni blocco ha la sua forma nel tempo, e l'app la conosce. Scegline uno e guarda com'è fatto.</p>
      </div>
      <div className={`lp-tipi ${visto ? 'visto' : ''}`} ref={pannello}>
        <div className="lp-tipi-elenco" role="radiogroup" aria-label="Tipo di blocco">
          {TIPI_BLOCCO.map((b, i) => (
            <button key={b.tipo} role="radio" aria-checked={i === scelto} onClick={() => setScelto(i)}
              className={i === scelto ? 'attivo' : ''}>{b.tipo}</button>
          ))}
        </div>
        <div className="lp-tipo-vista">
          <div className="lp-tipo-testa" key={t.tipo}>
            <span className="lp-pillola lp-pillola-grande">{t.tipo}</span>
            <span className="lp-tipo-param">{t.param}</span>
          </div>
          <p className="lp-tipo-spiega" key={`s-${t.tipo}`}>{t.spiega}</p>
          <div className="lp-forma" key={`f-${t.tipo}`} aria-hidden="true">
            {t.forma.map(([d, k], i) => (
              <span key={i} className={`lp-segmento ${k}`}
                style={{ flexGrow: d, flexBasis: 0, animationDelay: `${i * (360 / t.forma.length)}ms` }} />
            ))}
          </div>
          <div className="lp-forma-asse" aria-hidden="true"><span>0:00</span><span>fine del blocco</span></div>
        </div>
      </div>

      <div className="lp-coppia lp-coppia-una">
        <ProfiloCorsa />
      </div>
    </section>
  )
}

function ProfiloCorsa() {
  const ref = useRef(null)
  const visto = useInVista(ref, { soglia: 0.4, unaVolta: true })
  const tot = PROFILO_CORSA.reduce((a, [m]) => a + m, 0)
  return (
    <div ref={ref} className={`lp-corsa ${visto ? 'visto' : ''}`}>
      <div className="lp-corsa-sx">
        <h3 className="lp-h3">E le ripetute di corsa come le pensi.</h3>
        <p className="lp-testo">Sequenze libere, ritmo al chilometro o zone. Per i tuoi runner e per la parte di corsa delle sedute ibride.</p>
        <div className="lp-corsa-formula"><span>3 ×</span> (4′ Z3 + 3′ Z2)</div>
      </div>
      <div className="lp-corsa-dx">
        <div className="lp-profilo" role="img" aria-label="Profilo: riscaldamento in Z2, tre ripetute 4 minuti Z3 e 3 minuti Z2, defaticamento in Z1">
          {PROFILO_CORSA.map(([m, z], i) => (
            <span key={i} className="lp-barra" data-z={z}
              style={{ flexGrow: m, '--h': `${z * 26}%`, animationDelay: `${120 + i * 70}ms` }}>
              <i>Z{z}</i>
            </span>
          ))}
        </div>
        <div className="lp-profilo-asse"><span>0′</span><span>≈ {tot} min</span></div>
      </div>
    </div>
  )
}

/* ═══════════════════════════ La TV ═══════════════════════════ */

// Il timer guidato di un blocco ON/OFF: 40 s di lavoro, 20 di pausa, otto round.
const SEQUENZA = Array.from({ length: 16 }, (_, i) => {
  const round = Math.floor(i / 2) + 1
  const [compito] = STAZIONI[(round - 1) % STAZIONI.length]
  return i % 2
    ? { tipo: 'riposo', etichetta: 'OFF', compito: 'Recupera', round, dur: 20 }
    : { tipo: 'lavoro', etichetta: 'ON', compito, round, dur: 40 }
})

function useTimer(attivo, parteDa = 2) {
  const [stato, setStato] = useState({ idx: parteDa, left: 31 })
  useEffect(() => {
    if (!attivo) return
    const t = setInterval(() => {
      setStato(({ idx, left }) => (left > 1
        ? { idx, left: left - 1 }
        : { idx: (idx + 1) % SEQUENZA.length, left: SEQUENZA[(idx + 1) % SEQUENZA.length].dur }))
    }, 1000)
    return () => clearInterval(t)
  }, [attivo])
  const passo = SEQUENZA[stato.idx]
  return { passo, prossimo: SEQUENZA[(stato.idx + 1) % SEQUENZA.length], left: stato.left, frazione: stato.left / passo.dur }
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

// Cifre che rotolano: ogni cifra cambiata rientra dall'alto.
function Cifre({ testo, className = '' }) {
  return (
    <span className={`lp-cifre ${className}`} aria-label={testo}>
      {testo.split('').map((c, i) => (
        <span key={`${i}-${c}`} className={c === ':' ? 'lp-due-punti' : 'lp-cifra'} aria-hidden="true">{c}</span>
      ))}
    </span>
  )
}

const CODICE = '4821'

function SezioneTV() {
  const ref = useRef(null)
  const visto = useInVista(ref, { soglia: 0.35, unaVolta: true })
  const inVista = useInVista(ref, { soglia: 0.2 })
  const [cifre, setCifre] = useState(0)
  const acceso = cifre >= 4
  const t = useTimer(acceso && inVista)

  useEffect(() => {
    if (!visto) return
    let vivo = true
    ;(async () => {
      await attesa(700)
      for (let i = 1; i <= 4 && vivo; i++) { setCifre(i); await attesa(420) }
    })()
    return () => { vivo = false }
  }, [visto])

  const colore = t.passo.tipo === 'riposo' ? COLORI.riposo : COLORI.hyrox
  return (
    <section className="lp-sezione lp-sezione-tv" id="lp-tv" ref={ref} aria-labelledby="lp-tv-t">
      <div className="lp-sezione-testa">
        <h2 id="lp-tv-t" className="lp-h2">Le sedute di gruppo, sulla TV della sala.</h2>
        <p className="lp-sotto">
          Apri la schermata TV sul televisore del box e collegala dal telefono con quattro cifre o con il QR.
          Il tempo, l'esercizio e chi si sta allenando si leggono da tutta la sala: tu guardi le persone, non il cronometro.
        </p>
      </div>

      <div className="lp-tv-riga">
        <div className="lp-tv">
          <div className={`lp-tv-schermo ${acceso ? 'acceso' : ''}`}>
            <div className="lp-tv-attesa" aria-hidden={acceso}>
              <div className="lp-tv-logo">FLEO<b>FIT</b> <span>TV</span></div>
              <div className="lp-tv-codice">
                {CODICE.split('').map((c, i) => <span key={i} className={i < cifre ? 'preso' : ''}>{c}</span>)}
              </div>
              <div className="lp-tv-attesa-nota">Scrivi questo codice nell'app</div>
            </div>
            <div className="lp-tv-live" aria-hidden={!acceso} style={{ '--tinta': colore }}>
              <div className="lp-tv-testa">
                <div>
                  <div className="lp-tv-cat"><i />HYROX · ON/OFF</div>
                  <div className="lp-tv-titolo">ON/OFF Engine</div>
                </div>
                <div className="lp-tv-persone">{ATLETI.map((a) => <span key={a}>{a[0]}</span>)}</div>
              </div>
              <div className="lp-tv-carta">
                <div className="lp-tv-carta-sx">
                  <div className="lp-tv-et">{t.passo.etichetta} <span>· Round {t.passo.round} di 8</span></div>
                  <div className="lp-tv-compito">{t.passo.compito}</div>
                  <div className="lp-tv-poi"><b>Poi</b> {t.passo.tipo === 'lavoro' ? 'Recupera' : t.prossimo.compito}</div>
                </div>
                <Cifre testo={mmss(t.left)} className="lp-tv-tempo" />
                <div className="lp-tv-linea"><i style={{ width: `${(1 - t.frazione) * 100}%` }} /></div>
              </div>
            </div>
          </div>
          <div className="lp-tv-piede" aria-hidden="true" />
        </div>

        <div className="lp-tv-lato">
          <div className="lp-collega">
            <div className="lp-collega-t">Collega TV</div>
            <div className="lp-collega-caselle" aria-label={`Codice ${CODICE.slice(0, cifre)}`}>
              {CODICE.split('').map((c, i) => (
                <span key={i} className={i < cifre ? 'piena' : i === cifre ? 'cursore' : ''}>{i < cifre ? c : ''}</span>
              ))}
            </div>
            <div className={`lp-collega-ok ${acceso ? 'dentro' : ''}`}><Check size={15} aria-hidden="true" /> TV collegata</div>
          </div>
          <Link to="/tv" className="lp-btn lp-btn-secondario lp-btn-largo"><Tv size={18} aria-hidden="true" /> Apri la schermata TV <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════ Domande ═══════════════════════════ */

function SezioneDomande() {
  return (
    <section className="lp-sezione" id="lp-domande" aria-labelledby="lp-faq-t">
      <div className="lp-sezione-testa">
        <h2 id="lp-faq-t" className="lp-h2">Domande dei coach.</h2>
      </div>
      <div className="lp-faq">
        {FAQ.map((f) => (
          <details key={f.d} className="lp-domanda">
            <summary><h3>{f.d}</h3><Plus size={20} aria-hidden="true" /></summary>
            <p>{f.r}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

/* ═══════════════════════════ Pagina ═══════════════════════════ */

export default function Landing() {
  useTestaPagina()
  const [scorso, setScorso] = useState(false)
  useEffect(() => {
    const su = () => setScorso(window.scrollY > 8)
    su()
    window.addEventListener('scroll', su, { passive: true })
    return () => window.removeEventListener('scroll', su)
  }, [])

  return (
    <div className="lp">
      <header className={`lp-nav ${scorso ? 'scorso' : ''}`}>
        <Link to="/benvenuto" className="lp-logo" aria-label="FLEOFIT">FLEO<b>FIT</b></Link>
        <nav className="lp-nav-azioni" aria-label="Accesso">
          <Link to="/tv" className="lp-btn lp-btn-piccolo lp-btn-secondario"><Tv size={16} aria-hidden="true" /><span>Schermata TV</span></Link>
          <Link to="/login" className="lp-btn lp-btn-piccolo lp-btn-primario"><LogIn size={16} aria-hidden="true" /><span>Accedi</span></Link>
        </nav>
      </header>

      <Indice />
      <main>
        <ScenaTelefono />
        <SezioneComputer />
        <SezioneTV />
        <SezioneDomande />

        <section className="lp-chiusura" aria-labelledby="lp-chiudi-t">
          <h2 id="lp-chiudi-t" className="lp-h1 lp-h1-chiusura">Scrivi la prossima seduta.<br /><span className="lp-giallo">Il resoconto arriva da solo.</span></h2>
          <div className="lp-azioni lp-azioni-centro">
            <Link to="/login" className="lp-btn lp-btn-primario"><LogIn size={18} aria-hidden="true" /> Accedi</Link>
            <Link to="/tv" className="lp-btn lp-btn-secondario"><Tv size={18} aria-hidden="true" /> Schermata TV</Link>
          </div>
        </section>
      </main>

      <footer className="lp-piede">
        <span className="lp-logo lp-logo-piccolo">FLEO<b>FIT</b></span>
        <span>L'app per coach di Hyrox, running e palestra</span>
        <a href="/privacy">Privacy</a>
      </footer>
    </div>
  )
}
