// TVDashboardUI.jsx — i pezzi visivi della dashboard TV (/tv).
//
// Stesso patto di WorkoutDetailUI e degli altri *UI.jsx: SOLA PRESENTAZIONE.
// Ricevono testo già formattato e callback già esistenti. Il timer, i beep, il
// canale realtime e la scala del canvas stanno in pages/TVDashboard.jsx; cosa
// è acceso e cosa no lo decide src/lib/schermoTV.js. Se qui dentro compare un
// `useEffect`, una `supabase` o un calcolo sul tempo che resta, è finito nel
// file sbagliato.
//
// Dal 26/11/2026 la TV ha DUE MOMENTI (prototipo tools/design-tv/proposta-d.html,
// scelto dal committente; storia in docs/memoria/scheda-workout.md, 9-tv-carosello):
// - prima del via, la LOCANDINA: PUSHFIT grande a sinistra, il workout intero a
//   destra, un riquadro per blocco — la lavagna del box, senza confusione;
// - col timer partito dal telefono, il CAROSELLO: il blocco in corso al centro,
//   i vicini più piccoli ai lati.
// Pesi leggeri (500–700), aria, niente bordi dove basta lo spazio: le «lavagne»
// in grassetto sono state scartate perché caotiche. Solo orizzontale: la TV
// in verticale avrà un disegno suo (BACKLOG).

// ⚠️ Le righe di una carta stanno in fondo con `mt-auto` sulla prima e NON con
// `justify-end`: con justify-end ciò che non ci sta esce dall'ALTO, dove
// `scrollHeight` non lo vede, e useAdattaTesto lo dava per buono (26/11/2026).
import { Volume2, VolumeX, Pause, MonitorUp, Play, Repeat } from 'lucide-react'
import { BRAND } from '../lib/colori'
import { VERDE_TV } from '../lib/schermoTV'
import { NOME_APP } from '../lib/marchio'
import Logo from './Logo'

const VERDE = VERDE_TV

/**
 * La carta sollevata in scala TV: stesso gradiente della scheda, ombra e raggio
 * proporzionati a 1920px. La usano lo schermo del codice e quello d'errore.
 */
const CARTA_TV = 'rounded-[40px] bg-gradient-to-b from-[#1c1c1f] to-[#171719] ' +
  'shadow-[0_40px_70px_-36px_rgba(0,0,0,.9),inset_0_2px_0_rgba(255,255,255,.06)]'

// ── I controlli ───────────────────────────────────────────────────────────

/**
 * L'audio: un cerchio discreto quando è attivo, rosso e pulsante quando è
 * spento, perché senza un «OK» sul telecomando la TV resta muta.
 * ⚠️ Il bottone per ruotare lo schermo è stato tolto il 26/11/2026: la TV in
 * verticale avrà un disegno suo, più avanti.
 */
export function AudioTV({ audioAttivo }) {
  return (
    <span title="Suoni TV" aria-label={audioAttivo ? 'Audio attivo' : 'Audio spento'}
      className={`w-[64px] h-[64px] rounded-full flex items-center justify-center border-2 shrink-0 ${
        audioAttivo ? 'bg-white/[.05] border-white/[.08] text-gray-300' : 'bg-red-500/[.12] border-red-500/35 text-red-400 animate-pulse'}`}>
      {audioAttivo ? <Volume2 size={28} /> : <VolumeX size={28} />}
    </span>
  )
}

/** Il logo (`<Logo />`) seguito da «TV»: schermo del codice e caricamento. */
function MarchioTV() {
  return (
    <span className="inline-flex items-center leading-none">
      <Logo altezza={100} />
      <span className="ml-[.28em] text-[40px] font-extrabold tracking-[.14em] text-muted align-middle">TV</span>
    </span>
  )
}

// ── Il codice da inserire sul telefono ────────────────────────────────────

/**
 * Lo schermo che la TV mostra finché un telefono non si collega. È una sola
 * cosa da fare, e il codice è l'unico punto giallo dello schermo.
 */
export function AttesaTV({ codice, audioAttivo, qr = null }) {
  const cifre = (codice || '····').split('')
  return (
    <div className="relative flex-1 w-full flex flex-col items-center justify-center p-16 overflow-hidden">
      <span aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1400px] h-[1400px] pointer-events-none
                   bg-[radial-gradient(closest-side,rgba(241,197,23,.09),transparent_70%)]" />

      <div className="absolute top-12 right-12 z-10"><AudioTV audioAttivo={audioAttivo} /></div>

      <div className="relative flex flex-col items-center text-center gap-14">
        <MarchioTV />

        <div className="flex flex-col items-center gap-5">
          <span className="flex items-center gap-3 text-[24px] font-bold uppercase tracking-[.16em] text-muted">
            <MonitorUp size={28} className="text-brand" aria-hidden="true" />
            Trasmetti sulla TV
          </span>
          <p className="text-[40px] font-semibold leading-[1.3] text-gray-300 max-w-[1100px] text-balance">
            Apri l'allenamento sul telefono, tocca l'icona della TV e inserisci questo codice.
          </p>
        </div>

        <div className="flex gap-6" aria-label={`Codice ${codice || ''}`}>
          {cifre.map((c, i) => (
            <span key={i}
              className={`${CARTA_TV} border-2 border-brand/30 w-[200px] h-[250px] flex items-center justify-center
                          text-[170px] font-black text-brand tabular-nums leading-none tracking-[-.04em]`}>
              {c}
            </span>
          ))}
        </div>

        {qr && (
          <div className="flex flex-col items-center gap-4">
            {/* Il margine bianco (la zona di rispetto, 4 moduli) lo dà la carta:
                il QR arriva senza margine, 25 moduli × 8px = 200px. Il raggio
                sta sulla carta e MAI sull'immagine, che tagliava gli angoli
                vicino ai riquadri di posizione. Il PNG è a 400px, il doppio
                esatto: `pixelated` tiene i moduli netti anche scalati sulla TV. */}
            <div className="p-8 rounded-[24px] bg-white">
              <img src={qr} alt="Codice QR per collegare il telefono"
                className="block w-[200px] h-[200px] [image-rendering:pixelated]" />
            </div>
            <p className="text-[28px] font-semibold text-gray-300">oppure inquadralo con l'app {NOME_APP}</p>
          </div>
        )}

        {!audioAttivo && <AvvisoAudio />}
      </div>
    </div>
  )
}

function AvvisoAudio() {
  return (
    <p className="flex items-center gap-3 rounded-full px-8 py-4 bg-red-500/[.1] border-2 border-red-500/30
                  text-[30px] font-bold text-red-300 animate-pulse">
      <VolumeX size={32} aria-hidden="true" />
      Premi «OK» sul telecomando per attivare l'audio
    </p>
  )
}

export function CaricamentoTV() {
  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center gap-8">
      <MarchioTV />
      <span className="text-[34px] font-bold uppercase tracking-[.16em] text-brand animate-pulse">
        Collegamento in corso…
      </span>
    </div>
  )
}

export function ErroreTV({ messaggio }) {
  return (
    <div className="flex-1 w-full flex items-center justify-center p-16">
      <div className={`${CARTA_TV} border-2 border-red-500/30 px-20 py-14 text-center`}>
        <p className="text-[44px] font-black tracking-[-.02em] text-red-400">{messaggio}</p>
      </div>
    </div>
  )
}

// ── La locandina: il workout intero, prima del via ───────────────────────

/** Le due strisce gialle in diagonale e una luce morbida: solo nella locandina. */
function SfondoLocandina({ visibile }) {
  const striscia = 'absolute bg-brand transition-[transform,opacity] duration-1000 ease-out'
  return (
    <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
      <span className="absolute -left-[300px] -top-[400px] w-[1500px] h-[1400px] rotate-[-28deg]
                       bg-[linear-gradient(90deg,rgba(255,255,255,.035),rgba(255,255,255,0)_70%)]" />
      <span className={striscia} style={{ left: 900, top: 0, width: 700, height: 12,
        transform: `skewX(-32deg) translateX(${visibile ? 0 : 420}px)`, opacity: visibile ? 1 : 0 }} />
      <span className={striscia} style={{ left: 330, bottom: 0, width: 780, height: 30,
        transform: `skewX(-32deg) translateX(${visibile ? 0 : -900}px)`, opacity: visibile ? 1 : 0 }} />
    </div>
  )
}

/** La linguetta della cartellina: «4x», o «2/4» con i pallini sul blocco in corso. */
function Linguetta({ giri, giro = null, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-[.35em] text-brand font-bold ${className}`}>
      <Repeat className="w-[.9em] h-[.9em]" strokeWidth={2.5} aria-hidden="true" />
      <span className="tabular-nums">{giro ? `${giro}/${giri}` : `${giri}x`}</span>
      {giro && giri <= 8 && (
        <span className="flex gap-[.3em] ml-[.15em]" aria-hidden="true">
          {Array.from({ length: giri }, (_, g) => (
            <i key={g} className={`block w-[.45em] h-[.45em] rounded-full border-[.09em] ${
              g < giro - 1 ? 'bg-brand/45 border-transparent' : g === giro - 1 ? 'bg-brand border-brand' : 'border-brand/45'}`} />
          ))}
        </span>
      )}
    </span>
  )
}

/**
 * Una voce della lista a destra: numero, nome del blocco, linguetta, didascalia
 * e durata in testa, gli esercizi sotto. Tutto in `em`: la pagina adatta la
 * grandezza del testo perché il workout ci stia intero (`useAdattaTesto`).
 */
function VoceLocandina({ voce }) {
  return (
    <>
      {voce.pausaPrima && (
        <div className="shrink-0 flex items-center gap-[.5em] px-[.7em] text-[.7em] font-semibold"
          style={{ color: VERDE }}>
          <Pause className="w-[1em] h-[1em]" aria-hidden="true" /> Pausa
          <span aria-hidden="true" className="flex-1 border-t-[.08em] border-dashed" style={{ borderColor: `${VERDE}59` }} />
        </div>
      )}
      <div className="shrink-0 rounded-[.55em] bg-white/[.04] px-[.7em] pt-[.42em] pb-[.5em]">
        <div className="flex items-baseline gap-[.55em] whitespace-nowrap">
          <span className="w-[1.1em] text-[.8em] font-medium text-gray-500 tabular-nums">{voce.numero}</span>
          <h3 className="text-[1.06em] font-semibold tracking-[-.01em]">{voce.titolo}</h3>
          {voce.giri && (
            <Linguetta giri={voce.giri}
              className="self-center text-[.68em] px-[.5em] py-[.1em] rounded-t-[.4em] border-[.07em] border-b-transparent border-brand/55" />
          )}
          {voce.hint && <span className="text-[.72em] font-medium text-gray-500">{voce.hint}</span>}
          {voce.durata && <span className="ml-auto text-[.8em] font-medium text-gray-400 tabular-nums">{voce.durata}</span>}
        </div>
        {voce.righe.length > 0 ? (
          <ul className="lista-righe pl-[1.65em] mt-[.15em]">
            {voce.righe.map(r => (
              <li key={r.id} className="text-[.86em] leading-[1.4] text-gray-300 whitespace-nowrap">
                {r.nome}{r.specifiche && <span className="ml-[.35em] text-[.88em] text-gray-500">{r.specifiche}</span>}
              </li>
            ))}
          </ul>
        ) : voce.nota ? (
          <p className="pl-[1.9em] mt-[.1em] text-[.8em] text-gray-500 truncate">{voce.nota}</p>
        ) : null}
      </div>
    </>
  )
}

/**
 * La locandina. `voci` vengono da `vociLocandina` (src/lib/schermoTV.js);
 * senza voci (Custom, Evento) a destra vanno le note del coach. `refLista` è
 * del contenitore che la pagina adatta.
 */
export function LocandinaTV({
  visibile, etichettaCategoria, coloreCategoria, titolo, intensita, classeIntensita, durata, quantiBlocchi,
  nota, voci, conTimer, audioAttivo, refLista,
}) {
  const notaADestra = voci.length === 0
  return (
    <section aria-hidden={!visibile}
      className={`absolute inset-0 transition-[opacity,transform] duration-[800ms] ease-out ${
        visibile ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-[160px] pointer-events-none'}`}>
      <SfondoLocandina visibile={visibile} />
      <div className="absolute left-[120px] top-0 bottom-0 w-[820px] flex flex-col">
        <div className="mt-[96px] flex items-center gap-[14px] text-[26px] font-semibold text-[#c9ccd4]">
          <i aria-hidden="true" className="w-[12px] h-[12px] rounded-full" style={{ background: coloreCategoria }} />
          {etichettaCategoria}
        </div>
        <h1 className="mt-[28px] text-[60px] font-bold tracking-[-.025em] leading-[1.08] text-balance line-clamp-3 break-words">{titolo}</h1>
        <div className="mt-[20px] flex gap-[28px] text-[26px] font-medium text-gray-400">
          {intensita && <span>Intensità <b className={`font-semibold ${classeIntensita}`}>{intensita}/10</b></span>}
          {durata && <span>{durata.etichetta} <b className="font-semibold text-gray-200">{durata.valore}</b></span>}
          {quantiBlocchi > 0 && <span><b className="font-semibold text-gray-200">{quantiBlocchi}</b> {quantiBlocchi === 1 ? 'blocco' : 'blocchi'}</span>}
        </div>
        {nota && !notaADestra && (
          <p className="mt-[26px] max-w-[640px] text-[27px] leading-[1.5] text-gray-400 line-clamp-5 whitespace-pre-line">{nota}</p>
        )}

        <div className="mt-auto mb-[120px]">
          <Logo altezza={107} className="-ml-[6px]" />
          <div className="flex items-center gap-[30px] mt-[22px]">
            <span className="text-[76px] font-bold tracking-[-.02em] leading-none bg-gradient-to-b from-gray-300 to-gray-500 bg-clip-text text-transparent">
              Allenamento di oggi
            </span>
            {conTimer && (
              <span aria-hidden="true" className="relative shrink-0 w-[92px] h-[92px]">
                <span className="absolute inset-0 rounded-full bg-brand/40 animate-ping [animation-duration:2.4s]" />
                <span className="relative w-full h-full rounded-full bg-brand text-black flex items-center justify-center">
                  <Play size={38} fill="currentColor" className="ml-[6px]" />
                </span>
              </span>
            )}
          </div>
          {conTimer && <p className="mt-[24px] text-[26px] text-gray-400">Avvia il timer dal telefono per cominciare.</p>}
          {!audioAttivo && <div className="mt-[28px] [&>p]:text-[24px] [&>p]:px-6 [&>p]:py-3 [&>p]:inline-flex"><AvvisoAudio /></div>}
        </div>
      </div>

      <div className="absolute left-[1020px] right-[88px] top-[150px] bottom-[100px] flex flex-col">
        <h2 className="text-[36px] font-bold tracking-[-.015em] pb-[22px] border-b-2 border-white/[.08]">Il workout</h2>
        {notaADestra ? (
          <p className="mt-[28px] text-[34px] leading-[1.5] text-gray-300 whitespace-pre-line line-clamp-[14] break-words">
            {nota || 'Allenamento libero: il cronometro parte dal telefono.'}
          </p>
        ) : (
          <div ref={refLista} data-adatta="lista" data-disposizione="colonna"
            className="locandina-lista flex-1 min-h-0 overflow-hidden text-[30px] pt-[.5em] flex flex-col gap-[.34em]">
            {voci.map(v => <VoceLocandina key={v.id} voce={v} />)}
          </div>
        )}
      </div>
    </section>
  )
}

// ── In corso: testata, timer e carosello ─────────────────────────────────

/**
 * La testata: il logo GRANDE (richiesta del committente, 26/11/2026: «molto più
 * grande durante il workout») e il titolo accanto.
 */
function TestataInCorso({ titolo, audioAttivo }) {
  return (
    <div className="absolute left-[72px] right-[72px] top-[40px] h-[80px] flex items-center gap-[30px]">
      <Logo altezza={66} />
      <span className="min-w-0 flex-1 truncate text-[30px] font-medium text-gray-400 pl-[30px] border-l-2 border-white/10">{titolo}</span>
      <AudioTV audioAttivo={audioAttivo} />
    </div>
  )
}

/** Il timer: fase, compito e «Poi» a sinistra, il tempo grande a destra, la barra sotto. */
function TimerInCorso({ fase, colore, compito, poi, tempo, inPausa, avanzamento, coloreCifre }) {
  return (
    <>
      <div className="absolute left-[72px] right-[72px] top-[140px] h-[214px] flex items-center gap-[60px]">
        <div className="flex-1 min-w-0 flex flex-col gap-[14px]">
          <div className="flex items-center gap-[14px] text-[30px] font-semibold" style={{ color: colore }}>
            <i aria-hidden="true" className="w-[14px] h-[14px] rounded-full bg-current" />
            {fase}
            {inPausa && (
              <span className="ml-[10px] inline-flex items-center gap-[10px] text-[24px] px-[16px] py-[5px] rounded-full bg-white/[.08] text-gray-300">
                <Pause size={22} aria-hidden="true" /> In pausa
              </span>
            )}
          </div>
          <div className="text-[66px] font-bold tracking-[-.025em] leading-[1.05] truncate">{compito}</div>
          {poi && (
            <div className="text-[28px] text-gray-400 truncate">
              <b className="font-semibold text-gray-500 mr-[12px]">Poi</b>{poi}
            </div>
          )}
        </div>
        {tempo != null && (
          <div className={`text-[210px] font-bold tracking-[-.045em] leading-none tabular-nums transition-colors duration-500 ${inPausa ? 'text-white/35' : ''}`}
            style={inPausa ? undefined : { color: coloreCifre }}>
            {tempo}
          </div>
        )}
      </div>
      <div aria-hidden="true" className="absolute left-[72px] right-[72px] top-[366px] h-[4px] rounded-full bg-white/[.07] overflow-hidden">
        <span className="block h-full transition-[width,background-color] duration-1000 ease-linear"
          style={{ width: `${Math.min(1, Math.max(0, avanzamento ?? 0)) * 100}%`, background: colore }} />
      </div>
    </>
  )
}

/** Le pillole dei nomi: piene al lavoro, tratteggiate quando dicono dove si andrà. */
function PilloleChi({ chi, inArrivo }) {
  if (!chi?.length) return null
  return (
    <span className="flex gap-[.25em] shrink-0">
      {chi.map(p => (
        <span key={p.id ?? p.nome}
          className={`text-[.75em] font-bold rounded-full whitespace-nowrap ${inArrivo ? 'px-[.42em] py-[.02em] border-[3px] border-dashed' : 'px-[.5em] py-[.12em]'}`}
          style={inArrivo ? { borderColor: p.colore, color: p.colore } : { background: p.colore, color: '#0b0b0b' }}>
          {p.nome}
        </span>
      ))}
    </span>
  )
}

/**
 * Una riga della carta. `adesso`: l'esercizio in lavoro (giallo). `poi`: quello
 * che viene, nel riposo e prima del via — pieno, col contorno tratteggiato e
 * l'etichetta «Poi», mai spento (segnalato dal committente: «sembra quello
 * appena fatto»). `chi`: con più persone, chi ci sta o ci andrà.
 */
export function RigaCartaTV({ riga, adesso = false, poi = false, chi = null, inArrivo = false, spenta = false, classeIntensita }) {
  const colore = !inArrivo && chi?.[0]?.colore
  return (
    <li className={`flex items-baseline gap-[.45em] px-[.5em] py-[.26em] rounded-[.45em] transition-[background-color,opacity] duration-500 ${
      spenta ? 'opacity-[.38]' : ''}`}
      style={adesso ? { background: 'rgba(241,197,23,.12)' }
        : poi ? { background: 'rgba(241,197,23,.08)', outline: '3px dashed rgba(241,197,23,.9)', outlineOffset: -3 }
        : colore ? { background: `${colore}29` } : undefined}>
      <span className={`w-[.85em] shrink-0 text-[.7em] font-semibold tabular-nums ${adesso ? 'text-brand' : poi ? 'text-white' : 'text-gray-500'}`}>
        {riga.numero ?? ''}
      </span>
      {poi && (
        <span className="self-center shrink-0 text-[.55em] font-bold text-black bg-brand px-[.6em] py-[.12em] rounded-full">Poi</span>
      )}
      <span className={`shrink-0 font-semibold tracking-[-.01em] whitespace-nowrap ${adesso ? 'text-brand' : 'text-white'}`}>{riga.nome}</span>
      <span className="flex-1 min-w-0 truncate text-[.7em] text-gray-400">{riga.specifiche}</span>
      <PilloleChi chi={chi} inArrivo={inArrivo} />
      {riga.intensita && (
        <span className={`shrink-0 text-[.65em] font-semibold ${classeIntensita(riga.intensita)}`}>{riga.intensita}/10</span>
      )}
    </li>
  )
}

const LARGHEZZA_CARTA = 900
const SOVRAPPOSIZIONE = 64

/**
 * Una carta del carosello: un blocco, una pausa, il cronometro libero o la
 * fine. `voce` arriva da `voceBlocco`, `stato` da `statoCarosello`.
 */
function CartaTV({ tappa, voce, stato, piede, classeIntensita, notaLibera, titoloWorkout }) {
  const { ora, fatta } = stato
  const pausa = tappa.tipo === 'pausa'
  const verde = pausa || tappa.tipo === 'fine' || (ora && stato.riposo)
  const sfondo = verde
    ? 'linear-gradient(170deg,#1a2620,#141a16 60%,#161618)'
    : ora ? 'linear-gradient(170deg,#26241b,#18170f 60%,#161618)' : 'linear-gradient(170deg,#1f1f23,#161618)'
  const ombra = `0 50px 80px -40px rgba(0,0,0,.9)${ora ? `, inset 0 3px 0 ${verde ? VERDE : BRAND}` : ''}`
  const linguetta = tappa.tipo === 'blocco' && voce?.giri

  return (
    <div className="relative shrink-0 h-full flex flex-col transition-[transform,opacity] duration-[900ms] ease-out"
      style={{ width: LARGHEZZA_CARTA, marginRight: -SOVRAPPOSIZIONE, transform: `scale(${ora ? 1 : 0.8})`,
        opacity: ora ? 1 : fatta ? 0.22 : 0.38, zIndex: ora ? 1 : 0 }}>
      <div className={`self-start h-[56px] px-[24px] flex items-center rounded-t-[22px] bg-[#1d1d21] -mb-px text-[28px] ${linguetta ? '' : 'invisible'}`}>
        {linguetta && <Linguetta giri={voce.giri} giro={ora ? stato.giro : null} />}
      </div>
      <div className={`flex-1 min-h-0 rounded-[36px] ${linguetta ? 'rounded-tl-none' : ''} px-[44px] pt-[36px] pb-[40px] flex flex-col relative overflow-hidden`}
        style={{ background: sfondo, boxShadow: ombra }}>

        {tappa.tipo === 'fine' ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-[14px]">
            <h2 className="text-[80px] font-bold tracking-[-.025em] leading-none" style={{ color: VERDE }}>Bravi, è finito!</h2>
            <p className="text-[34px] text-gray-400 truncate max-w-full">{titoloWorkout}</p>
          </div>
        ) : tappa.tipo === 'libero' ? (
          <>
            <h2 className="text-[54px] font-bold tracking-[-.025em] leading-none">Allenamento libero</h2>
            <p className="mt-[24px] text-[34px] leading-[1.4] text-[#c9ccd4] whitespace-pre-line line-clamp-[8] break-words">
              {notaLibera || 'Cronometro libero: si va avanti dal telefono.'}
            </p>
          </>
        ) : (
          <>
            <div className="flex items-start gap-[28px] shrink-0">
              {pausa ? (
                <span className="inline-flex items-center gap-[12px] text-[30px] font-semibold px-[22px] py-[10px] rounded-full"
                  style={{ color: VERDE, background: 'rgba(74,222,128,.12)' }}>
                  <Pause size={28} aria-hidden="true" /> Pausa
                </span>
              ) : (
                <span className="text-[104px] font-extralight leading-[.8] tracking-[-.04em] tabular-nums"
                  style={{ color: ora ? (verde ? VERDE : BRAND) : 'rgba(255,255,255,.55)' }}>
                  {voce.numero}
                </span>
              )}
              <div className="flex-1" />
              {!pausa && ora && (stato.riposo || stato.prep) && (
                <span className="self-center inline-flex items-center gap-[10px] text-[30px] font-semibold px-[22px] py-[8px] rounded-full"
                  style={stato.riposo ? { color: VERDE, background: 'rgba(74,222,128,.14)' } : { color: BRAND, background: 'rgba(241,197,23,.12)' }}>
                  {stato.riposo ? <><Pause size={26} aria-hidden="true" /> Riposo</> : 'Si parte da qui'}
                </span>
              )}
              {pausa
                ? <span className="self-center text-[28px] font-medium text-gray-400">Prossimo blocco</span>
                : voce.durata && <span className="text-[34px] font-semibold text-gray-400 tabular-nums">{voce.durata}</span>}
            </div>
            <h2 className={`${pausa ? 'mt-[20px]' : 'mt-[22px]'} text-[54px] font-bold tracking-[-.025em] leading-none shrink-0`}>{voce.titolo}</h2>
            {(pausa ? [voce.hint, voce.durata, voce.giri ? `${voce.giri} giri` : ''].filter(Boolean).join(' · ') : voce.hint) && (
              <p className="mt-[10px] text-[28px] text-gray-400 shrink-0 truncate">
                {pausa ? [voce.hint, voce.durata, voce.giri ? `${voce.giri} giri` : ''].filter(Boolean).join(' · ') : voce.hint}
              </p>
            )}
            {voce.righe.length > 0 ? (
              <ul data-adatta="carta" className="flex-1 min-h-0 mt-[14px] -mx-[20px] overflow-hidden flex flex-col gap-[.12em] text-[40px] [&>li:first-child]:mt-auto">
                {voce.righe.map((r, i) => {
                  const chi = stato.chi?.[i] || null
                  const conPersone = !!stato.chi
                  return (
                    <RigaCartaTV key={r.id} riga={r} classeIntensita={classeIntensita}
                      adesso={stato.adesso === i} poi={stato.poi === i}
                      chi={chi} inArrivo={stato.inArrivo}
                      spenta={ora && stato.riposo && !conPersone && stato.poi !== i} />
                  )
                })}
              </ul>
            ) : (
              <p className="mt-auto text-[36px] leading-[1.35] text-[#c9ccd4] font-medium line-clamp-4">{voce.nota || ''}</p>
            )}
            {piede && (
              <p className="mt-[18px] pt-[18px] border-t-2 border-white/[.07] text-[27px] text-gray-400 shrink-0">{piede}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Lo schermo col timer partito: testata, timer e carosello. `carte` sono le
 * tappe di `statoCarosello` già accoppiate alle loro voci e ai loro piedi.
 */
export function InCorsoTV({
  visibile, titolo, audioAttivo, timer, carte, corrente, classeIntensita, notaLibera, refCarosello,
}) {
  const passo = LARGHEZZA_CARTA - SOVRAPPOSIZIONE
  return (
    <section aria-hidden={!visibile}
      className={`absolute inset-0 transition-[opacity,transform] duration-[800ms] ease-out ${
        visibile ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-[160px] pointer-events-none'}`}>
      <TestataInCorso titolo={titolo} audioAttivo={audioAttivo} />
      <TimerInCorso {...timer} />
      <div ref={refCarosello} className="absolute left-0 right-0 top-[394px] h-[630px]">
        <div className="absolute left-0 top-0 h-full flex transition-transform duration-[900ms] ease-out"
          style={{ transform: `translateX(${960 - corrente * passo - LARGHEZZA_CARTA / 2}px)` }}>
          {carte.map(c => (
            <CartaTV key={c.chiave} tappa={c.tappa} voce={c.voce} stato={c.stato} piede={c.piede}
              classeIntensita={classeIntensita} notaLibera={notaLibera} titoloWorkout={titolo} />
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="absolute left-0 right-0 bottom-[22px] flex justify-center gap-[14px]">
        {carte.filter(c => c.tappa.tipo !== 'fine').map((c, j) => {
          const ora = j === corrente
          const pausa = c.tappa.tipo === 'pausa'
          return (
            <i key={c.chiave} className="block h-[6px] rounded-full transition-all duration-500"
              style={{ width: pausa ? (ora ? 40 : 12) : ora ? 72 : 34,
                background: ora ? (pausa ? VERDE : BRAND) : j < corrente ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.18)' }} />
          )
        })}
      </div>
    </section>
  )
}
