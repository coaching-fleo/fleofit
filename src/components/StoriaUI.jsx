// StoriaUI.jsx — la grafica che l'atleta mette sopra la propria storia, e il
// foglio da cui la guarda prima di esportarla.
//
// Il modello è quello di Strava: una FORMA grande, riconoscibile e propria di
// quella sessione, e sotto pochi numeri molto grandi. Strava disegna il
// percorso GPS; noi non ne abbiamo uno, ma abbiamo il **profilo di sforzo** —
// un tratto per blocco, largo quanto dura e alto quanto è duro (la sagoma la
// calcola `src/lib/recapStoria.js`, qui si decide solo come appare).
//
// 🔴 **Il formato predefinito è lo sticker TRASPARENTE**, ed è tutta la
// richiesta: su Instagram non si pubblica questa immagine *al posto* della
// propria foto, la si appoggia *sopra*. Un PNG con lo sfondo pieno andrebbe
// bene solo per un post, e obbligherebbe a rinunciare alla foto — che è
// esattamente ciò che la storia di Strava non chiede. Lo sfondo resta come
// seconda opzione per chi vuole pubblicarla da sola.
//
// ⚠️ Tutto è scritto in `style` inline e non in classi Tailwind, come la
// grafica IG che già esiste: html-to-image clona il nodo e ne rasterizza gli
// stili calcolati, e qui dentro non deve poter entrare niente che dipenda dal
// foglio di stile dell'app o da una variabile CSS — che in un `foreignObject`
// non viene risolta.

import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Download, Send, Loader2 } from 'lucide-react'
import { coloreCategoria, conVelo, BRAND } from '../lib/colori'
import { useBottomSheet } from '../useBottomSheet'
import { battito } from '../lib/aptica'

/**
 * La misura della grafica in punti CSS. Esportata a `FATTORE_STORIA` dà
 * 1080×1920, cioè il formato di una storia.
 *
 * ⚠️ Non si esporta a 1080 di larghezza CSS: i corpi del testo sono scelti per
 * questa scala, e cambiarla senza riscalare tutto il resto darebbe una grafica
 * con le proporzioni giuste e la tipografia sbagliata.
 */
export const LARGHEZZA_STORIA = 360

/**
 * L'altezza della **storia con lo sfondo**, e solo di quella: 360×640 è il 9:16
 * che si pubblica così com'è.
 *
 * 🔴 Lo **sticker trasparente non ha un'altezza fissa**: si ritaglia sul
 * contenuto. Non è un dettaglio di gusto — Instagram scala l'immagine INTERA
 * per farla entrare dove la si appoggia, quindi ogni pixel trasparente di
 * margine rimpicciolisce il testo due volte: una nel file e una nella storia.
 * La prima stesura esportava sempre 9:16 con il contenuto in fondo, e su un
 * allenamento corto metà sticker era vuoto. Chi esporta deve perciò leggere
 * l'altezza dal nodo (`offsetHeight`), non darla per scontata.
 */
export const ALTEZZA_STORIA = 640
export const FATTORE_STORIA = 3

/**
 * Quanto spazio resta libero in fondo alla **storia con sfondo**.
 *
 * ⚠️ Non è respiro estetico: Instagram copre la fascia bassa della storia con
 * la barra della risposta. Un numero che finisce lì sotto non si legge, e
 * l'atleta se ne accorge dopo aver pubblicato. Sullo sticker non si applica:
 * lì è l'atleta a decidere dove appoggiarlo.
 */
const FONDO_SICURO = 84

/**
 * Il bordo dello sticker, che è anche la zona in cui l'alone si spegne.
 *
 * ⚠️ Serve al velo: un ritaglio sul contenuto senza margine avrebbe il velo che
 * finisce di netto sul bordo, cioè un rettangolo scuro appiccicato sulla foto.
 * Qui dentro la sfumatura arriva a zero, e quello che resta è un alone.
 */
const BORDO_STICKER = { alto: 44, lato: 30, basso: 40 }

/**
 * Quanto resta libero in cima alla storia con lo sfondo prima che il contenuto
 * cominci a rimpicciolirsi. Non è margine estetico: è la soglia oltre la quale
 * `StoriaConSfondo` sceglie di scalare invece di far uscire il titolo.
 */
const RESPIRO_ALTO = 44

// La stessa pila di font dell'app (src/index.css): Inter era dichiarato ma non
// caricato da nessuna parte, quindi su iOS il testo è San Francisco. Scrivere
// qui un font diverso darebbe una grafica che non somiglia all'app.
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, system-ui, sans-serif"

// ── L'elenco di quello che si è fatto ─────────────────────────────────────
//
// 🔴 Ha preso il posto del profilo di sforzo, su decisione del committente
// presa guardando la prima versione: il grafico a barre gialle era gradevole e
// **non si leggeva**. Una sagoma racconta l'andamento; l'elenco dice *che cosa
// hai fatto*, che è la sola cosa per cui si guarda la storia di qualcun altro.
//
// ⚠️ Tutto qui dentro è dimensionato perché l'immagine verrà guardata PICCOLA:
// il nome dell'esercizio prende il corpo più grande della pagina dopo il
// titolo, le specifiche stanno in colonna a destra invece che in coda al nome
// (una riga sola da leggere invece di due informazioni da separare a occhio),
// e l'elenco si ferma a `MASSIMO_RIGHE` dicendolo, invece di rimpicciolirsi.

function RigaBlocco({ titolo, dettaglio, colore, primo }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: '8px',
      marginTop: primo ? 0 : '10px', marginBottom: '4px',
    }}>
      <span style={{
        fontSize: '12.5px', fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: '0.13em', color: colore, whiteSpace: 'nowrap',
      }}>{titolo}</span>
      {dettaglio && (
        <span style={{
          fontSize: '12.5px', fontWeight: 700, letterSpacing: '0.02em',
          color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{dettaglio}</span>
      )}
    </div>
  )
}

function RigaEsercizio({ nome, specifiche }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '2px' }}>
      {/* ⚠️ Il nome cede per primo, non le specifiche: «Sled Push» troncato in
          «Sled Pu…» resta riconoscibile, «125 kg» troncato in «125 k» no. */}
      <span style={{
        fontSize: '19px', fontWeight: 700, color: '#fff', letterSpacing: '-0.25px',
        flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{nome}</span>
      {specifiche && (
        <span style={{
          fontSize: '14.5px', fontWeight: 600, color: 'rgba(255,255,255,0.7)',
          flexShrink: 0, whiteSpace: 'nowrap',
        }}>{specifiche}</span>
      )}
    </div>
  )
}

function Elenco({ righe, colore }) {
  return (
    <div>
      {righe.map((r, i) => {
        // ⚠️ «Primo» vuol dire prima riga dell'elenco, non primo blocco: è
        // l'unica che non prende lo stacco sopra di sé. In una corsa
        // l'intestazione «Ripetute» arriva dopo il riscaldamento, e lì lo
        // stacco ci vuole.
        if (r.genere === 'blocco') {
          return <RigaBlocco key={i} titolo={r.titolo} dettaglio={r.dettaglio} colore={colore} primo={i === 0} />
        }
        if (r.genere === 'esercizio') {
          return <RigaEsercizio key={i} nome={r.nome} specifiche={r.specifiche} />
        }
        if (r.genere === 'testo') {
          return (
            <div key={i} style={{
              fontSize: '17px', fontWeight: 600, lineHeight: 1.4, marginTop: '5px',
              color: 'rgba(255,255,255,0.88)', wordBreak: 'break-word',
            }}>{r.testo}</div>
          )
        }
        // «+4 esercizi»: una lista troncata che lo dichiara è leggibile, una
        // lista intera in corpo 9 non lo è.
        return (
          <div key={i} style={{
            fontSize: '14px', fontWeight: 700, marginTop: '12px',
            letterSpacing: '0.02em', color: 'rgba(255,255,255,0.5)',
          }}>{r.testo}</div>
        )
      })}
    </div>
  )
}

// ── Le celle grandi ───────────────────────────────────────────────────────

function Cella({ cella }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        {/* 🔴 Il «circa» è la sola cosa che separa una stima da un cronometro.
            La durata di un «For Time» non esiste: il tempo lo fa l'atleta
            (src/lib/stimaWorkout.js). Su una storia, senza questo segno, quel
            numero viene letto come un tempo misurato. */}
        {cella.circa && (
          <span style={{ fontSize: '26px', fontWeight: 600, color: 'rgba(255,255,255,0.52)', marginRight: '1px', letterSpacing: '-0.5px' }}>≈</span>
        )}
        <span style={{ fontSize: '46px', fontWeight: 800, letterSpacing: '-1.6px', lineHeight: 1, color: '#fff' }}>
          {cella.valore}
        </span>
        {cella.unita && (
          <span style={{ fontSize: '17px', fontWeight: 700, color: 'rgba(255,255,255,0.66)', marginLeft: '3px', letterSpacing: '-0.2px' }}>
            {cella.unita}
          </span>
        )}
      </div>
      <span style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.6)', marginTop: '6px' }}>
        {cella.etichetta}
      </span>
    </div>
  )
}

/**
 * Quello che c'è scritto, uguale nei due formati.
 *
 * ⚠️ È un componente e non due copie perché lo sticker e la storia con lo
 * sfondo devono dire **la stessa cosa**: cambia la cornice, non il contenuto.
 */
function Contenuto({ recap, colore, sfondo }) {
  // Una gara, o un libero senza note: non c'è niente da elencare, e il titolo
  // diventa il contenuto invece di essere l'etichetta di ciò che sta sotto.
  const solaIntestazione = recap.righe.length === 0

  return (
    <>
      {/* L'occhiello: la corsia e il giorno in cui l'allenamento è stato
          fatto. Il pallino è il colore della categoria — la stessa Regola
          della Corsia di tutta l'app, che qui esce dall'app insieme a lei. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '99px', background: colore, display: 'block' }} />
        <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.82)' }}>
          {recap.etichettaCategoria}{recap.giornoBreve ? ` · ${recap.giornoBreve}` : ''}
        </span>
      </div>

      {/* ⚠️ Il titolo si rimpicciolisce quando SOTTO c'è un elenco, e cresce
          quando non c'è: su una gara o su un libero senza note il titolo è
          tutto il contenuto, mentre su un Hyrox è solo l'etichetta di quello
          che si legge sotto. Sono due pagine diverse, non due gusti.
          ⚠️ L'altezza è limitata con `maxHeight` e non con
          `-webkit-line-clamp`: il clamp dipende da una proprietà che il
          rasterizzatore potrebbe non applicare, e un titolo lungo uscirebbe
          dal riquadro senza dare alcun errore. Qui, al peggio, si taglia. */}
      <div style={{
        fontSize: solaIntestazione ? '35px' : '27px',
        fontWeight: 800,
        letterSpacing: solaIntestazione ? '-1px' : '-0.7px',
        lineHeight: 1.13,
        marginTop: '10px',
        maxHeight: solaIntestazione ? '120px' : '62px',
        overflow: 'hidden', wordBreak: 'break-word',
      }}>
        {recap.titolo}
      </div>

      {!solaIntestazione && (
        <>
          <div style={{ height: '1.5px', width: '100%', background: 'rgba(255,255,255,0.34)', borderRadius: '1px', marginTop: '14px' }} />
          <div style={{ marginTop: '11px' }}>
            <Elenco righe={recap.righe} colore={colore} />
          </div>
        </>
      )}

      {recap.celle.length > 0 && (
        <div style={{ display: 'flex', gap: '28px', marginTop: '20px', flexWrap: 'nowrap' }}>
          {recap.celle.map(c => <Cella key={c.chiave} cella={c} />)}
        </div>
      )}

      {/* Il marchio, come la firma di Strava in fondo alla sua. È anche
          l'unica ragione per cui questa grafica conviene al coach. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginTop: '20px' }}>
        <span style={{ fontSize: '17px', fontWeight: 900, letterSpacing: '0.4px' }}>
          <span style={{ color: '#fff' }}>FLEO</span>
          <span style={{ color: BRAND }}>FIT</span>
        </span>
        <span style={{ flex: 1, height: '1px', background: sfondo ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.22)' }} />
      </div>
    </>
  )
}

/**
 * La grafica esportabile, nella sua misura vera.
 *
 * ⚠️ `nodoRef` è il nodo che html-to-image rasterizza, e deve stare sull'unico
 * elemento che porta l'intera misura: passarlo a un contenitore che lo avvolge
 * darebbe un'immagine con del margine intorno, e passarlo a un figlio la
 * taglierebbe. Non è un ref «di comodo».
 *
 * 🔴 I due formati hanno due **misure** diverse, non solo due sfondi:
 * - lo **sticker** si ritaglia sul contenuto (altezza automatica), perché ogni
 *   pixel trasparente di margine è spazio che Instagram conta quando scala la
 *   grafica sopra la storia: la si appoggia grande e il testo resta piccolo;
 * - la **storia con lo sfondo** resta 9:16, perché si pubblica così com'è.
 */
export function GraficaStoria({ recap, sfondo = false, nodoRef }) {
  const colore = coloreCategoria(recap.categoria)

  if (sfondo) return <StoriaConSfondo recap={recap} colore={colore} nodoRef={nodoRef} />

  return (
    <div ref={nodoRef} style={{
      width: `${LARGHEZZA_STORIA}px`,
      boxSizing: 'border-box',
      padding: `${BORDO_STICKER.alto}px ${BORDO_STICKER.lato}px ${BORDO_STICKER.basso}px`,
      fontFamily: FONT, color: '#fff',
      // 🔴 Una CARTA, non una sfumatura a perdere. Il primo tentativo era un
      // alone ellittico che si spegneva dentro il margine, per non avere
      // l'aria di una scatola: non funziona su un ritaglio, e si vede solo
      // guardandolo. Il testo arriva quasi ai bordi, quindi l'ellisse o
      // smetteva di coprirlo ai lati oppure — allargandola — tagliava di netto
      // sui fianchi, disegnando sulla foto una fascia scura con due spigoli.
      // Le due cose non possono stare insieme: o si stringe il testo, o si
      // dichiara la carta. La carta è anche il linguaggio dell'app (la Regola
      // della Carta Sollevata di DESIGN.md), quindi lo sticker somiglia alla
      // schermata da cui esce.
      borderRadius: '30px',
      border: '1px solid rgba(255,255,255,0.10)',
      background: 'linear-gradient(to bottom, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.76) 100%)',
      // ⚠️ L'ombra del testo resta: la carta è semitrasparente di proposito —
      // la foto sotto si deve intravedere — e sotto una riga può capitare il
      // punto più chiaro dello scatto.
      textShadow: '0 1px 4px rgba(0,0,0,0.55)',
    }}>
      <Contenuto recap={recap} colore={colore} sfondo={false} />
    </div>
  )
}

/**
 * La storia 9:16 da pubblicare così com'è.
 *
 * 🔴 **Si adatta al contenuto invece di tagliarlo.** Qui il riquadro è fisso e
 * il contenuto no: un Hyrox da dodici righe supera i 640px, e con un riquadro
 * ancorato in basso a uscire dalla CIMA sono il titolo e l'occhiello — cioè le
 * uniche due righe che dicono di che allenamento si tratta. È successo appena
 * il testo è stato ingrandito. Rimpicciolire di un decimo tutto insieme è
 * meglio che perdere il titolo, ed è molto meglio che tenere il testo piccolo
 * per tutti gli allenamenti a causa di quelli lunghi.
 *
 * ⚠️ La misura si prende sullo `scrollHeight` del contenuto **non scalato**: il
 * `transform` non tocca il layout, quindi non esiste il ciclo «scalo → rimisuro
 * → riscalo». E l'origine è in basso, o rimpicciolendo si perderebbe proprio lo
 * spazio di sicurezza sotto (`FONDO_SICURO`).
 */
function StoriaConSfondo({ recap, colore, nodoRef }) {
  const contenuto = useRef(null)
  const [scala, setScala] = useState(1)

  useLayoutEffect(() => {
    const nodo = contenuto.current
    if (!nodo) return
    const alto = nodo.scrollHeight
    // In un ambiente che non calcola il layout resta 1, cioè la grafica
    // intera: meglio di una scalata a zero.
    if (!alto) return
    setScala(Math.min(1, (ALTEZZA_STORIA - RESPIRO_ALTO) / alto))
  }, [recap])

  return (
    <div ref={nodoRef} style={{
      width: `${LARGHEZZA_STORIA}px`, height: `${ALTEZZA_STORIA}px`,
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      fontFamily: FONT, color: '#fff',
      background: 'radial-gradient(120% 75% at 50% 0%, #1b1b20 0%, #0B0B0B 62%)',
    }}>
      {/* ⚠️ L'alone della corsia va tenuto BASSO e largo. Al primo tentativo
          era un ovale al 22% alto meno di metà grafica, e su «Gara» — la cui
          corsia è il bianco — si vedeva come una macchia grigia con un
          contorno, cioè come un difetto di compressione invece che come una
          luce. */}
      <div style={{
        position: 'absolute', left: '-35%', right: '-35%', bottom: '2%', height: '72%',
        background: `radial-gradient(52% 50% at 50% 50%, ${conVelo(colore, 0.15)} 0%, rgba(0,0,0,0) 74%)`,
      }} />
      <div ref={contenuto} style={{
        position: 'relative',
        padding: `0 ${BORDO_STICKER.lato}px ${FONDO_SICURO}px`,
        transform: scala < 1 ? `scale(${scala})` : undefined,
        transformOrigin: 'bottom center',
      }}>
        <Contenuto recap={recap} colore={colore} sfondo />
      </div>
    </div>
  )
}

// ── Il foglio di anteprima ────────────────────────────────────────────────

/**
 * Il fattore con cui l'anteprima entra nello spazio che le resta.
 *
 * ⚠️ Non è un numero fisso: fra un iPhone SE e un Pro Max lo spazio libero
 * cambia di oltre 200px, e una scala scritta a mano o taglia la grafica in
 * basso o la lascia minuscola. Si misura, come l'altezza della navbar
 * (CLAUDE.md §9-quaterdecies).
 */
function useScalaAnteprima(riferimento) {
  const [scala, setScala] = useState(0.5)

  useLayoutEffect(() => {
    const nodo = riferimento.current
    if (!nodo) return
    const misura = () => {
      const r = nodo.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return
      setScala(Math.min(r.width / LARGHEZZA_STORIA, r.height / ALTEZZA_STORIA))
    }
    misura()
    // ⚠️ E una seconda volta al fotogramma dopo: al montaggio il foglio sta
    // ancora entrando dal basso e le icone della barra in fondo non hanno
    // ancora la loro altezza definitiva, quindi la prima misura può essere
    // generosa. Il riquadro ha `overflow: hidden`, quindi al peggio
    // l'anteprima si taglia e i bottoni restano dove sono — ma un'anteprima
    // tagliata è comunque il primo sguardo che l'atleta dà alla grafica.
    const fotogramma = requestAnimationFrame(misura)

    // ResizeObserver non esiste in ogni ambiente (jsdom lo ha, ma un WebView
    // vecchio no): senza di lui resta la misura del montaggio, che è giusta
    // finché nessuno ruota il telefono.
    if (typeof ResizeObserver === 'undefined') return () => cancelAnimationFrame(fotogramma)
    const osservatore = new ResizeObserver(misura)
    osservatore.observe(nodo)
    return () => { cancelAnimationFrame(fotogramma); osservatore.disconnect() }
  }, [riferimento])

  return scala
}

function Segmento({ attivo, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={attivo}
      className={`flex-1 h-9 rounded-xl text-[13px] font-bold transition ${
        attivo ? 'bg-white/[.13] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.1)]' : 'text-gray-400'}`}>
      {children}
    </button>
  )
}

/**
 * Il foglio da cui si guarda la grafica e la si esporta.
 *
 * ⚠️ L'anteprima è LO STESSO componente che viene rasterizzato, solo riscalato:
 * una seconda versione «per l'anteprima» sarebbe il modo in cui ciò che si vede
 * e ciò che si esporta cominciano a divergere (CLAUDE.md §9 punto 1). Il nodo
 * che html-to-image legge è però una copia a misura vera, montata fuori
 * schermo dal chiamante: `transform: scale` su un antenato cambierebbe il
 * rettangolo che il rasterizzatore misura, e l'immagine uscirebbe della
 * dimensione sbagliata.
 */
export function FoglioStoria({ recap, sfondo, onSfondo, onChiudi, onSalva, onCondividi, occupato }) {
  const { chiudi, maniglia, stileFoglio, stileVelo, classeFoglio, classeVelo } = useBottomSheet(onChiudi)
  const riquadro = useRef(null)
  const scala = useScalaAnteprima(riquadro)

  const cambiaSfondo = (valore) => { battito(); onSfondo(valore) }

  return createPortal(
    <div className={`fixed inset-0 z-[120] flex flex-col justify-end bg-black/90 touch-none ${classeVelo}`}
      style={stileVelo} onClick={chiudi}>
      <div role="dialog" aria-label="Condividi come storia" onClick={(e) => e.stopPropagation()}
        style={stileFoglio}
        className={`bg-[#141416] border-t border-white/[.09] rounded-t-3xl px-4
                    pb-[calc(1rem+env(safe-area-inset-bottom))] flex flex-col gap-3
                    h-[92dvh] shadow-[0_-20px_50px_-12px_rgba(0,0,0,.85)] ${classeFoglio}`}>

        <button type="button" aria-label="Chiudi" {...maniglia}
          className="w-full pt-3 pb-1.5 -mx-4 px-4 flex justify-center shrink-0 touch-none
                     cursor-grab active:cursor-grabbing group">
          <span aria-hidden="true" className="w-10 h-1 rounded-full bg-white/20 group-hover:bg-white/35" />
        </button>

        <div className="flex items-center shrink-0">
          <h2 className="text-[17px] font-black tracking-tight flex-1">Condividi come storia</h2>
          <button type="button" aria-label="Chiudi" onClick={chiudi}
            className="-mr-1.5 w-10 h-10 rounded-full flex items-center justify-center text-gray-300 hover:bg-white/[.06]">
            <X size={19} />
          </button>
        </div>

        {/* Il fondo dell'anteprima finge una foto, e non è decorazione: uno
            sticker trasparente su fondo nero sembra una grafica con lo sfondo
            nero, cioè proprio la cosa che non è. */}
        <div ref={riquadro} className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
          <div style={{
            width: LARGHEZZA_STORIA * scala, height: ALTEZZA_STORIA * scala,
            borderRadius: 18 * scala + 6, overflow: 'hidden', position: 'relative',
            background: sfondo ? '#0B0B0B'
              : 'linear-gradient(160deg, #4a5361 0%, #2b3140 42%, #6b6255 100%)',
            boxShadow: '0 18px 46px -12px rgba(0,0,0,.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* ⚠️ La cornice resta 9:16 anche per lo sticker, che 9:16 non è:
                serve a far vedere quanto occupa DAVVERO sopra una storia. Il
                riscalamento è centrato invece che ancorato in alto a sinistra
                perché il riquadro non lo riempie più — con `top left` lo
                sticker resterebbe appiccicato in cima con il vuoto sotto, che
                è esattamente l'impressione sbagliata. */}
            <div style={{ transform: `scale(${scala})`, transformOrigin: 'center' }}>
              <GraficaStoria recap={recap} sfondo={sfondo} />
            </div>
          </div>
        </div>

        <div className="shrink-0 flex flex-col gap-2.5">
          <div role="group" aria-label="Formato della grafica"
            className="flex gap-1 bg-[#111] p-1 rounded-2xl border border-white/[.07]">
            <Segmento attivo={!sfondo} onClick={() => cambiaSfondo(false)}>Sticker trasparente</Segmento>
            <Segmento attivo={sfondo} onClick={() => cambiaSfondo(true)}>Con sfondo</Segmento>
          </div>

          <p className="text-[11.5px] leading-snug text-muted px-0.5">
            {sfondo
              ? 'Immagine 1080×1920 pronta da pubblicare così com’è.'
              : 'PNG trasparente: salvalo e aggiungilo alla tua storia con lo sticker «foto», sopra il video o la foto che hai girato.'}
          </p>

          <div className="flex gap-2.5">
            <button type="button" onClick={onSalva} disabled={occupato}
              className="flex-1 h-[52px] rounded-2xl bg-white/[.07] border border-white/[.12] text-white
                         font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-50 transition">
              {occupato ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              Salva
            </button>
            <button type="button" onClick={onCondividi} disabled={occupato}
              className="flex-1 h-[52px] rounded-2xl bg-brand text-black font-bold text-[15px]
                         flex items-center justify-center gap-2 disabled:opacity-50 transition">
              {occupato ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              Condividi
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
