// TVDashboardUI.jsx — i pezzi visivi della dashboard TV (/tv).
//
// Stesso patto di WorkoutDetailUI e degli altri *UI.jsx: SOLA PRESENTAZIONE.
// Ricevono testo già formattato e callback già esistenti. Il timer, i beep, il
// canale realtime e la scala del canvas stanno in pages/TVDashboard.jsx e lì
// restano: se qui dentro compare un `useEffect`, una `supabase` o un calcolo
// sul tempo che resta, è finito nel file sbagliato.
//
// Il rework in una riga: la TV era l'ultima schermata di prima del redesign —
// bordi da 4px, `#1e1e1e` piatto, il logo ripetuto due volte e il giallo
// dappertutto. Ora parla la stessa lingua della scheda workout: la carta
// sollevata, la spina colorata del blocco, la sovrascritta con il pallino
// della corsia, il vetro per i controlli. Tutto in scala da 1920×1080, cioè
// grande abbastanza da leggersi dall'altra parte della sala.

import { Volume2, VolumeX, RotateCcwSquare, ClipboardList, Pause, MonitorUp } from 'lucide-react'
import { VETRO } from '../lib/stiliCard'
import { TYPE_COLORS } from '../lib/blockColors'
import { BRAND, RUNNING, CUSTOM } from '../lib/colori'

/**
 * La carta sollevata (`CARD_BASE` di stiliCard) in scala TV: stesso gradiente,
 * stessa hairline chiara in alto, ombra e raggio proporzionati a 1920px.
 * Senza bordo di proposito: chi la usa lo dichiara (vedi la trappola dei due
 * bordi in stiliCard.js).
 */
const CARTA_TV = 'rounded-[40px] bg-gradient-to-b from-[#1c1c1f] to-[#171719] ' +
  'shadow-[0_40px_70px_-36px_rgba(0,0,0,.9),inset_0_2px_0_rgba(255,255,255,.06)]'

// ── I controlli ───────────────────────────────────────────────────────────

/**
 * Audio e rotazione. L'audio è un cerchio di vetro, come le icone di stato
 * della scheda; l'audio spento è l'unico che chiede attenzione, perché senza un
 * «OK» sul telecomando la TV resta muta.
 *
 * ⚠️ La rotazione NON è una freccia circolare: sembrava «ricarica la pagina»
 * (15/10/2026). È il quadrato con la freccia curva di Foto su iOS, il simbolo
 * che il committente ha scelto: quello che tutti riconoscono come «ruota».
 */
export function ControlliTV({ audioAttivo, onRuota, ruotato = false }) {
  return (
    <div className="flex items-center gap-4 shrink-0">
      <span title="Suoni TV" aria-label={audioAttivo ? 'Audio attivo' : 'Audio spento'}
        className={`w-[76px] h-[76px] rounded-full flex items-center justify-center border-2 ${
          audioAttivo ? 'bg-brand/[.12] border-brand/35 text-brand' : 'bg-red-500/[.12] border-red-500/35 text-red-400 animate-pulse'}`}>
        {audioAttivo ? <Volume2 size={34} /> : <VolumeX size={34} />}
      </span>
      <button type="button" onClick={onRuota}
        aria-label={ruotato ? 'Passa allo schermo orizzontale' : 'Passa allo schermo verticale'}
        title="Ruota lo schermo"
        className={`w-[76px] h-[76px] rounded-full flex items-center justify-center ${VETRO} text-gray-200
                    hover:text-white hover:border-white/25 transition`}>
        <RotateCcwSquare size={34} aria-hidden="true" />
      </button>
    </div>
  )
}

/** La Regola del Logo di DESIGN.md: `FLEO` bianco, `FIT` ambra, peso 900. */
function MarchioTV({ grande = false }) {
  return (
    <span className={`font-black tracking-[-.035em] leading-none text-white ${grande ? 'text-[132px]' : 'text-[44px]'}`}>
      FLEO<span className="text-brand">FIT</span>
      <span className={`ml-[.28em] font-extrabold tracking-[.14em] text-muted align-middle ${grande ? 'text-[40px]' : 'text-[18px]'}`}>TV</span>
    </span>
  )
}

// ── Attesa: il codice da inserire sul telefono ────────────────────────────

/**
 * Lo schermo che la TV mostra finché un telefono non si collega. È una sola
 * cosa da fare, e il codice è l'unico punto giallo dello schermo.
 */
export function AttesaTV({ codice, audioAttivo, onRuota, ruotato }) {
  const cifre = (codice || '····').split('')
  return (
    <div className="relative flex-1 w-full flex flex-col items-center justify-center p-16 overflow-hidden">
      {/* Un'unica luce ambra dietro il codice: stato («qui»), non atmosfera. */}
      <span aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1400px] h-[1400px] pointer-events-none
                   bg-[radial-gradient(closest-side,rgba(241,186,23,.09),transparent_70%)]" />

      <div className="absolute top-12 right-12 z-10">
        <ControlliTV audioAttivo={audioAttivo} onRuota={onRuota} ruotato={ruotato} />
      </div>

      <div className={`relative flex flex-col items-center text-center ${ruotato ? 'gap-16' : 'gap-14'}`}>
        <MarchioTV grande />

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

        {!audioAttivo && (
          <p className="flex items-center gap-3 rounded-full px-8 py-4 bg-red-500/[.1] border-2 border-red-500/30
                        text-[30px] font-bold text-red-300 animate-pulse">
            <VolumeX size={32} aria-hidden="true" />
            Premi «OK» sul telecomando per attivare l'audio
          </p>
        )}
      </div>
    </div>
  )
}

export function CaricamentoTV() {
  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center gap-8">
      <MarchioTV grande />
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

// ── La testata del workout ────────────────────────────────────────────────

/**
 * Come `TitoloScheda`: la categoria è la sovrascritta, con il pallino della
 * corsia, e il titolo prende tutto lo spazio. Il marchio sta in piccolo a
 * destra, accanto ai controlli: in una sala serve a dire «questa è la TV di
 * FLEOFIT», non a competere con il nome dell'allenamento.
 */
export function TestataTV({ coloreCategoria, etichettaCategoria, titolo, intensita, classeIntensita, audioAttivo, onRuota, stretto = false }) {
  return (
    <div className="flex items-start justify-between gap-10 shrink-0 px-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <span aria-hidden="true" className="w-4 h-4 rounded-full" style={{ background: coloreCategoria }} />
          <span className="text-[26px] font-bold uppercase tracking-[.12em]" style={{ color: coloreCategoria }}>
            {etichettaCategoria}
          </span>
          {intensita && (
            <span className={`text-[26px] font-bold uppercase tracking-[.08em] ${classeIntensita}`}>
              · Intensità {intensita}/10
            </span>
          )}
        </div>
        <h1 className={`${stretto ? 'text-[60px]' : 'text-[76px]'} font-black tracking-[-.04em] leading-[1.04] text-white text-pretty break-words`}>
          {titolo}
        </h1>
      </div>
      <div className="flex items-center gap-8 shrink-0 pt-1">
        {/* Ruotata la TV è larga 1080px: il marchio cede il posto al titolo. */}
        {!stretto && <MarchioTV />}
        <ControlliTV audioAttivo={audioAttivo} onRuota={onRuota} ruotato={stretto} />
      </div>
    </div>
  )
}

// ── Il timer ──────────────────────────────────────────────────────────────

/**
 * Il colore della fascia segue il tema dello step, come il timer sul telefono
 * (`SCHEMES` di WorkoutDetail): lavoro, riposo e preparazione si riconoscono
 * da lontano prima di leggere una parola. Solo il colore: lo sfondo resta la
 * carta, perché una fascia piena larga 1840px sarebbe un muro.
 */
const ACCENTO_TEMA = {
  prep: BRAND,
  run: RUNNING,
  rest: '#4ade80',
  hyrox: CUSTOM,
  emom: BRAND,
  base: '#ffffff',
  done: '#4ade80',
  custom: CUSTOM,
}

/**
 * La fascia del timer. Riceve tutto già pronto: il tempo formattato, la quota
 * di avanzamento (0–1, o `null` per i cronometri liberi, che non hanno una
 * fine) e lo step successivo.
 */
export function TimerTV({ titolo, sottotitolo, compito, poi, tempo, avanzamento, tema, inPausa, stretto = false }) {
  const accento = ACCENTO_TEMA[tema] || BRAND
  return (
    <div className={`${CARTA_TV} relative overflow-hidden border-2`}
      style={{ borderColor: `${accento}4d` }}>
      <span aria-hidden="true" className="absolute left-0 inset-y-0 w-[10px]" style={{ background: accento }} />
      <span aria-hidden="true"
        className="absolute -top-[60%] -left-[8%] w-[900px] h-[900px] pointer-events-none"
        style={{ background: `radial-gradient(closest-side, ${accento}1f, transparent 70%)` }} />

      {/* Stretto (TV ruotata, 1080px): il tempo va sopra e il compito sotto,
          invece di contendersi una riga che non basta a nessuno dei due. */}
      <div className={`relative flex ${stretto ? 'flex-col-reverse items-stretch gap-3 pl-14 pr-12 py-8' : 'items-center gap-12 pl-16 pr-14 py-10'}`}>
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-[30px] font-extrabold uppercase tracking-[.14em]" style={{ color: accento }}>
              {titolo}
            </span>
            {sottotitolo && (
              <span className="text-[28px] font-bold tracking-[.04em] text-muted">· {sottotitolo}</span>
            )}
            {inPausa && (
              <span className="flex items-center gap-2 rounded-full px-5 py-1.5 bg-white/[.08] border-2 border-white/[.14]
                               text-[22px] font-extrabold uppercase tracking-[.12em] text-gray-200">
                <Pause size={22} aria-hidden="true" /> In pausa
              </span>
            )}
          </div>
          <span className={`${stretto ? 'text-[52px]' : 'text-[60px]'} font-black tracking-[-.03em] leading-[1.08] text-white truncate`}>{compito}</span>
          {poi && (
            <span className="text-[28px] font-semibold text-gray-400 truncate">
              <span className="font-extrabold uppercase tracking-[.12em] text-muted mr-3">Poi</span>{poi}
            </span>
          )}
        </div>

        <span className={`shrink-0 ${stretto ? 'text-[140px]' : 'text-[170px]'} font-black tabular-nums tracking-[-.05em] leading-none transition-opacity ${
          inPausa ? 'text-white/45' : 'text-white'}`}
          style={{ fontVariantNumeric: 'tabular-nums' }}>
          {tempo}
        </span>
      </div>

      {avanzamento != null && (
        <div aria-hidden="true" className="relative h-[10px] bg-white/[.06]">
          <span className="absolute left-0 inset-y-0 transition-[width] duration-1000 ease-linear"
            style={{ width: `${Math.min(1, Math.max(0, avanzamento)) * 100}%`, background: accento }} />
        </div>
      )}
    </div>
  )
}

// ── I blocchi ─────────────────────────────────────────────────────────────

/**
 * Un blocco come nella scheda (`BloccoScheda`): la spina a sinistra nel colore
 * di TYPE_COLORS, nome e didascalia in testa, durata a destra, gli esercizi
 * sotto. Il blocco in corso prende il bordo e la spina ambra: è l'unica cosa
 * gialla della griglia, quindi si trova con un'occhiata.
 */
export function BloccoTV({ tipo, hint, sottotitolo, durata, lavoro, numero, attivo, children }) {
  const hex = (TYPE_COLORS[tipo] || {}).hex || '#9ca3af'
  return (
    <div className={`${CARTA_TV} relative overflow-hidden border-2 flex flex-col transition-all duration-500 ${
      attivo ? 'border-brand/70 shadow-[0_0_70px_-10px_rgba(241,186,23,.35)]' : 'border-white/[.07]'}`}>
      <span aria-hidden="true" className="absolute left-0 inset-y-0"
        style={attivo
          ? { width: 10, background: BRAND }
          : { width: lavoro ? 8 : 6, background: hex, opacity: lavoro ? 1 : 0.6 }} />

      <div className="flex items-start gap-6 pl-12 pr-10 pt-9 pb-7 shrink-0">
        {numero != null && (
          <span aria-hidden="true"
            className={`shrink-0 w-[60px] h-[60px] rounded-full flex items-center justify-center text-[28px] font-black tabular-nums ${
              attivo ? 'bg-brand text-black' : `${VETRO} text-gray-300`}`}>
            {numero}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[40px] font-black tracking-[-.025em] leading-[1.1] text-white break-words">{tipo}</p>
          {(hint || sottotitolo) && (
            <p className="mt-2 text-[24px] font-semibold text-muted text-pretty">
              {hint}
              {hint && sottotitolo && <span aria-hidden="true"> · </span>}
              {sottotitolo && <span className="font-bold tracking-[.02em] text-gray-300">{sottotitolo}</span>}
            </p>
          )}
        </div>
        {durata && (
          <span className={`shrink-0 pt-1 text-[34px] font-extrabold tabular-nums tracking-[.01em] ${
            attivo ? 'text-brand' : lavoro ? 'text-gray-100' : 'text-gray-400'}`}>
            {durata}
          </span>
        )}
      </div>

      {children && (
        <div className="flex-1 flex flex-col gap-4 pl-12 pr-10 pb-10">{children}</div>
      )}
    </div>
  )
}

/** Il pozzetto delle righe annidate (`RIGA` di stiliCard), in scala TV. */
const RIGA_TV = 'rounded-[28px] bg-white/[.035] border-2 border-white/[.06] shadow-[inset_0_2px_0_rgba(255,255,255,.05)]'

/**
 * Un esercizio: come `RigaEsercizio`, il nome è il nome, le specifiche stanno
 * sotto e l'intensità in coda. `numero` è il minuto di un EMOM (anche «2–3»,
 * src/lib/stazioniEmom.js): `min-w` e non `w`, così il cerchio si allunga.
 */
export function EsercizioTV({ numero, nome, specifiche, note, intensita, classeIntensita, attivo = false }) {
  // `attivo`: l'esercizio che sta girando in un EMOM o nell'ON di un ON/OFF
  // (src/lib/esercizioInCorso.js). Bordo e fondo ambra, numero pieno: dentro un
  // blocco già acceso è l'unica riga gialla.
  return (
    <div className={`flex items-center gap-6 px-7 py-5 transition-all duration-500 ${attivo
      ? 'rounded-[28px] bg-brand/[.10] border-2 border-brand/60 shadow-[0_0_40px_-12px_rgba(241,186,23,.45)]'
      : RIGA_TV}`}>
      {numero != null && (
        <span aria-hidden="true"
          className={`shrink-0 min-w-[58px] h-[58px] px-3 rounded-full border-2 flex items-center justify-center
                      text-[26px] font-extrabold tabular-nums whitespace-nowrap ${attivo
            ? 'bg-brand border-brand text-black' : 'bg-brand/[.13] border-brand/30 text-brand'}`}>
          {numero}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[36px] font-extrabold tracking-[-.015em] leading-[1.15] text-white break-words">{nome}</p>
        {specifiche && (
          <p className="mt-1.5 text-[28px] font-semibold tracking-[.01em] text-gray-300 break-words">{specifiche}</p>
        )}
        {note && <p className="mt-1.5 text-[24px] text-muted text-pretty break-words">{note}</p>}
      </div>
      {intensita && (
        <span className={`shrink-0 text-[30px] font-black tracking-[.02em] ${classeIntensita}`}>
          {intensita}/10
        </span>
      )}
    </div>
  )
}

/** WarmUp e Rest non hanno esercizi: resta la nota, se il coach l'ha scritta. */
export function NotaBloccoTV({ children }) {
  return <p className="text-[30px] font-medium leading-[1.45] text-gray-300 text-pretty">{children}</p>
}

// ── La corsa ──────────────────────────────────────────────────────────────

const PASSI = {
  warmup:   { etichetta: 'Riscaldamento', colore: '#fb923c' },
  run:      { etichetta: 'Corsa',         colore: RUNNING },
  recover:  { etichetta: 'Recupero',      colore: '#4ade80' },
  cooldown: { etichetta: 'Defaticamento', colore: '#9ca3af' },
  repeat:   { etichetta: 'Ripetute',      colore: '#c084fc' },
}

function MezzaRipetuta({ etichetta, durata, passo, colorePasso, intensita, classeIntensita }) {
  return (
    <div className={`${RIGA_TV} flex items-center gap-6 px-7 py-5`}>
      <span className="shrink-0 w-[150px] text-[22px] font-extrabold uppercase tracking-[.12em] text-muted">{etichetta}</span>
      <p className="flex-1 min-w-0 text-[34px] font-extrabold text-white break-words">
        {durata}
        {passo && <span className="ml-4 font-bold whitespace-nowrap" style={{ color: colorePasso }}>@{passo}</span>}
      </p>
      {intensita && <span className={`shrink-0 text-[30px] font-black ${classeIntensita(intensita)}`}>{intensita}/10</span>}
    </div>
  )
}

/**
 * I passi di una corsa, in colonna. Il passo in corso prende la riga
 * azzurra della corsia; gli altri restano pozzetti.
 */
export function CorsaTV({ passi, attivo, classeIntensita }) {
  return (
    <div className="flex flex-col gap-5">
      {passi.map((step, i) => {
        const p = PASSI[step.type] || { etichetta: '', colore: '#ffffff' }
        const acceso = i === attivo
        return (
          <div key={step.id || i}
            className={`relative overflow-hidden rounded-[30px] border-2 pl-10 pr-8 py-6 flex flex-col gap-4 transition-all duration-500 ${
              acceso ? 'bg-running/[.12] border-running/60 shadow-[0_0_60px_-12px_rgba(0,148,198,.45)]'
                     : 'bg-white/[.025] border-white/[.06]'}`}>
            <span aria-hidden="true" className="absolute left-0 inset-y-0 w-[8px]" style={{ background: p.colore, opacity: acceso ? 1 : 0.7 }} />
            <div className="flex items-center gap-5">
              <span className="text-[28px] font-extrabold uppercase tracking-[.12em]" style={{ color: p.colore }}>{p.etichetta}</span>
              {step.type === 'repeat' && (
                <span className={`rounded-full px-5 py-1 ${VETRO} text-[28px] font-black text-white tabular-nums`}>×{step.rounds}</span>
              )}
            </div>

            {step.type === 'repeat' ? (
              <div className="flex flex-col gap-3">
                <MezzaRipetuta etichetta="Corsa" durata={step.runDuration} passo={step.runPace} colorePasso={RUNNING}
                  intensita={step.runIntensity} classeIntensita={classeIntensita} />
                <MezzaRipetuta etichetta="Recupero" durata={step.recDuration} passo={step.recPace} colorePasso="#4ade80"
                  intensita={step.recIntensity} classeIntensita={classeIntensita} />
                {step.notes && <p className="text-[26px] text-muted text-pretty break-words">{step.notes}</p>}
              </div>
            ) : (
              <div className="flex items-start gap-6">
                <div className="flex-1 min-w-0">
                  <p className="text-[42px] font-black tracking-[-.02em] text-white break-words">
                    {step.duration}
                    {step.pace && <span className="ml-5 text-[34px] font-bold text-gray-400 whitespace-nowrap">@{step.pace}</span>}
                  </p>
                  {step.notes && <p className="mt-2 text-[26px] text-muted text-pretty break-words">{step.notes}</p>}
                </div>
                {step.intensity && (
                  <span className={`shrink-0 pt-2 text-[32px] font-black ${classeIntensita(step.intensity)}`}>{step.intensity}/10</span>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Il contenitore della corsa: una carta con la spina azzurra della corsia. */
export function CartaCorsaTV({ children }) {
  return (
    <div className={`${CARTA_TV} relative overflow-hidden border-2 border-running/25 pl-12 pr-10 py-10 flex flex-col gap-7`}>
      <span aria-hidden="true" className="absolute left-0 inset-y-0 w-[8px] bg-running" />
      <p className="text-[40px] font-black tracking-[-.025em] text-white">Allenamento di corsa</p>
      {children}
    </div>
  )
}

// ── Avviso e note ─────────────────────────────────────────────────────────

// ⚠️ Sulla TV non c'è l'avviso «Prima di iniziare»: tolto su richiesta del
// committente il 15/10/2026 (prima carta della griglia, poi fascia in fondo:
// invasivo in entrambe le forme). Resta nella scheda, `AvvisoRiscaldamento`.

/** Le note del coach: la `CardNota` ambra della scheda, in scala TV. */
export function NotaCoachTV({ children }) {
  return (
    <div className="rounded-[40px] px-12 py-10 flex flex-col gap-5 border-2"
      style={{ background: `${BRAND}0f`, borderColor: `${BRAND}47` }}>
      <div className="flex items-center gap-4">
        <ClipboardList size={32} style={{ color: BRAND }} aria-hidden="true" />
        <span className="text-[26px] font-bold uppercase tracking-[.12em]" style={{ color: BRAND }}>Note del coach</span>
      </div>
      <p className="text-[36px] font-semibold leading-[1.45] text-gray-200 whitespace-pre-wrap text-pretty break-words">
        {children}
      </p>
    </div>
  )
}
