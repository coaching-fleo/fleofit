// AudioVisualizer, estratto il 26/08/2026 (BACKLOG #19 / CLAUDE.md §9 punto 1).
//
// Era ricopiato in Home, WorkoutDetail e AthleteDetail. Non era un problema estetico:
// le tre copie erano identiche al 100%, ma sarebbero divergite
// alla prima modifica, come è già successo a VoiceRecorder.
//
// Dal 28/08/2026 lo usa anche la dettatura di «Genera con IA», che è viola e
// più alta: da lì i parametri `colore`, `altezza`, `larghezza` e `onLivello`.
// Sono tutti facoltativi — una seconda copia viola sarebbe stata il modo in cui
// le due si mettono a divergere.


import { useEffect, useRef } from 'react'
import { BRAND, conVelo } from '../lib/colori'

/** Ogni quanto `onLivello` viene avvisato. A 60fps sarebbe un render ogni 16ms. */
const MS_LIVELLO = 100

/**
 * 🔴 Quante bande disegnare, e perché non sono tutte (28/08/2026).
 *
 * L'analizzatore copre metà della frequenza di campionamento — con 48 kHz sono
 * **24 kHz** — distribuiti in parti uguali fra le bande. La voce sta fra 80 Hz e
 * ~4 kHz, cioè nel **primo sesto** dello spettro: con `fftSize 64` (32 bande da
 * 750 Hz l'una) tutto il parlato finiva nelle prime quattro barre e le altre
 * ventotto restavano piatte per sempre.
 *
 * Non era un difetto visibile come tale — l'onda «si muoveva» — ma si muoveva
 * in un angolo. Ora l'analisi è più fine (`fftSize 256` → bande da ~187 Hz) e
 * si disegnano solo le prime `BANDE_VOCE`, distribuite su TUTTA la larghezza.
 */
const FFT = 256
const BANDE_VOCE = 24

/**
 * Quante bande finiscono nel disegno, che sono MENO di quelle che contano per
 * il livello: 13 rispecchiate fanno 25 barre, cioè barre grasse e leggibili su
 * 340 punti invece di ventiquattro stecchi.
 */
const BANDE_DISEGNO = 13

/**
 * 🔴 Perché SPECULARE dal centro, e non da sinistra a destra.
 *
 * L'energia di una voce decresce con la frequenza, sempre: disegnata in ordine
 * dà una scala discendente identica a ogni parola — informativa quanto vuoi,
 * ma sembra un grafico, non una voce. Rispecchiata attorno alla banda più
 * bassa diventa la sagoma che tutti riconoscono come «qualcuno sta parlando»,
 * e si gonfia e sgonfia con le sillabe.
 */

/** Quanta parte del passo è aria fra una barra e l'altra. */
const ARIA = 0.34

/**
 * Le bande alte sono naturalmente più deboli: senza compenso le barre esterne
 * non si muovono mai e la sagoma è una gobba immobile. Non falsa niente — è
 * l'inclinazione dello spettro della voce, non un livello inventato.
 */
const COMPENSO = 0.06

/**
 * La curva con cui l'ampiezza diventa altezza.
 *
 * Lineare, una voce normale disegna barre basse e schiacciate: l'orecchio sente
 * in modo logaritmico, l'occhio si aspetta di vedere quello che sente. L'esponente
 * sotto 1 alza il parlato tranquillo senza saturare le urla.
 */
const CURVA = 0.75

export default function AudioVisualizer({ stream, colore = BRAND, altezza = 32, larghezza = 300, classe = 'w-full h-8', onLivello }) {
  const canvasRef = useRef(null)
  // Il callback vive in un ref: se entrasse nelle dipendenze dell'effetto, una
  // arrow inline del chiamante ricostruirebbe l'AudioContext a ogni render.
  const suLivello = useRef(onLivello)
  useEffect(() => { suLivello.current = onLivello })

  useEffect(() => {
    if (!stream) return
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }
    const analyser = audioCtx.createAnalyser()
    const source = audioCtx.createMediaStreamSource(stream)
    source.connect(analyser)
    analyser.fftSize = FFT
    // Senza, ogni fotogramma è indipendente dal precedente e l'onda tremola.
    analyser.smoothingTimeConstant = 0.75
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    // Le bande oltre la voce non contano per il livello: mediate su 24 kHz di
    // silenzio non si muoverebbero nemmeno gridando.
    const bande = Math.min(BANDE_VOCE, analyser.frequencyBinCount)
    const meta = Math.min(BANDE_DISEGNO, bande)
    const barre = meta * 2 - 1
    const canvas = canvasRef.current
    const canvasCtx = canvas.getContext('2d')
    let animationId
    let ultimoAvviso = 0
    let piccoFinestra = 0
    let gradiente = null

    // ⚠️ La risoluzione del canvas segue la misura REALE a schermo e il
    // devicePixelRatio: su un iPhone 3x un canvas da 300px stirato su 340
    // punti è disegnato a un terzo della densità dello schermo, e si vede —
    // era la ragione principale per cui l'onda sembrava sfocata.
    const dimensiona = () => {
      const dpr = window.devicePixelRatio || 1
      const box = canvas.getBoundingClientRect()
      const w = Math.max(1, Math.round((box.width || larghezza) * dpr))
      const h = Math.max(1, Math.round((box.height || altezza) * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gradiente = null
      }
    }
    dimensiona()
    window.addEventListener('resize', dimensiona)

    const draw = () => {
      animationId = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(dataArray)
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height)

      // 🔴 Il passo era `(larghezza / bande) * 1.5`: con 32 bande su 200px la x
      // arrivava a 300, e un terzo delle barre finiva FUORI dal canvas. Nessun
      // errore da nessuna parte — l'onda sembrava solo un po' corta.
      const passo = canvas.width / barre
      const spessore = Math.max(1, passo * (1 - ARIA))
      const raggio = spessore / 2
      const centro = canvas.height / 2
      // Il massimo, meno lo spessore: i capi tondi devono starci dentro.
      const corsa = Math.max(spessore, canvas.height - spessore)

      if (!gradiente) {
        // Piena al centro, che è dove sta la voce, e sfumata ai bordi: senza,
        // la sagoma finisce di netto e sembra tagliata invece che sfumata.
        gradiente = canvasCtx.createLinearGradient(0, 0, canvas.width, 0)
        gradiente.addColorStop(0, conVelo(colore, 0.4))
        gradiente.addColorStop(0.5, colore)
        gradiente.addColorStop(1, conVelo(colore, 0.4))
      }
      canvasCtx.fillStyle = gradiente

      let picco = 0
      for (let i = 0; i < bande; i++) {
        const v = dataArray[i] / 255
        if (v > picco) picco = v
      }

      let x = passo * ARIA * 0.5
      for (let j = 0; j < barre; j++) {
        // La banda 0 sta al centro, e da lì si specchia verso i due bordi.
        const i = Math.abs(j - (meta - 1))
        const v = Math.min(1, (dataArray[i] / 255) * (1 + i * COMPENSO))
        // Minimo un pallino tondo, non una scheggia da 2px: sulla coda muta
        // dello spettro è la differenza fra una linea tratteggiata e dei punti.
        const alta = Math.max(spessore, Math.pow(v, CURVA) * corsa)

        canvasCtx.beginPath()
        if (canvasCtx.roundRect) canvasCtx.roundRect(x, centro - alta / 2, spessore, alta, raggio)
        else canvasCtx.rect(x, centro - alta / 2, spessore, alta)
        canvasCtx.fill()

        x += passo
      }

      // 🔴 Si riporta il PICCO della finestra, non la media dell'istante.
      // La media su 24 bande resta bassa anche mentre si parla — la voce sta in
      // poche bande, le altre sono zero e la trascinano giù — e il campione
      // istantaneo può cadere fra due sillabe: messe insieme, le due cose
      // facevano scattare «non arriva nessun suono» a microfono perfettamente
      // funzionante. Segnalato dal committente il 28/08/2026.
      if (suLivello.current) {
        if (picco > piccoFinestra) piccoFinestra = picco
        const ora = Date.now()
        if (ora - ultimoAvviso >= MS_LIVELLO) {
          ultimoAvviso = ora
          suLivello.current(piccoFinestra)
          piccoFinestra = 0
        }
      }
    }
    draw()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', dimensiona)
      if (audioCtx.state !== 'closed') audioCtx.close()
    }
  }, [stream, colore, larghezza, altezza])

  // ⚠️ `larghezza`/`altezza` sono solo il RIPIEGO per quando il box non è
  // ancora misurabile (il primo fotogramma, o jsdom): la misura vera la decide
  // `classe`, e `dimensiona()` la insegue.
  return <canvas ref={canvasRef} className={classe} width={larghezza} height={altezza} />
}
