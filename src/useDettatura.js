// useDettatura — parlare invece di scrivere, e ricevere il testo.
//
// Nasce con la ricerca del coach (09/10/2026), e porta le STESSE lezioni del
// foglio «Genera con IA» di CreateWorkout, dove sono state pagate una a una:
//  1. 🔴 Su iOS si registra con MediaRecorder, non col plugin nativo: WebView
//     e recorder nativo si contendono AVAudioSession, e il plugin dichiarava
//     successo restituendo un M4A di sola intestazione (CLAUDE.md §4). Il
//     plugin resta come ripiego, e prima di avviarlo lo stream si CHIUDE.
//  2. Il microfono si apre sempre con getUserMedia: senza stream non c'è
//     forma d'onda, e senza forma d'onda «ti sento» e «non ti sento» sono
//     la stessa immagine.
//  3. `audio/webm` Gemini non lo prende: sul web (il PC di chi sviluppa) si
//     usa il riconoscimento del browser, che dà già il testo.
//
// ⚠️ Il foglio di CreateWorkout ha ancora la SUA copia di questa logica,
// intrecciata con la generazione dei blocchi. Portarlo su questo hook è in
// BACKLOG: va fatto dopo aver provato la ricerca su un iPhone vero, non prima.
//
// `trascrivi(base64, mimeType)` → Promise<string> lo passa chi usa l'hook:
// qui non si sa quale Edge Function chiamare.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { VoiceRecorder } from '@independo/capacitor-voice-recorder'
import { battito, vibraPresa } from './lib/aptica'

/** I formati che Gemini accetta come `inlineData`, nell'ordine di preferenza. */
const FORMATI_AUDIO = ['audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/wav']

const formatoRegistrabile = () => {
  if (typeof window === 'undefined' || !window.MediaRecorder || !window.MediaRecorder.isTypeSupported) return null
  return FORMATI_AUDIO.find(t => window.MediaRecorder.isTypeSupported(t)) || null
}

/** Sopra questa soglia il microfono è vivo (la stessa di CreateWorkout). */
export const SOGLIA_SEGNALE = 0.07

const blobInBase64 = (blob) => new Promise((risolvi, rifiuta) => {
  const lettore = new FileReader()
  lettore.onerror = () => rifiuta(new Error('Audio illeggibile'))
  lettore.onload = () => risolvi(String(lettore.result).split(',')[1] || '')
  lettore.readAsDataURL(blob)
})

export function useDettatura({ trascrivi, onTesto, onErrore }) {
  const isNative = Capacitor.isNativePlatform()

  const [inAscolto, setInAscolto] = useState(false)
  const [trascrivendo, setTrascrivendo] = useState(false)
  const [stream, setStream] = useState(null)
  const [secondi, setSecondi] = useState(0)
  const [livello, setLivello] = useState(0)
  const [haSentito, setHaSentito] = useState(false)
  const [provvisorio, setProvvisorio] = useState('')

  const recognition = useRef(null)
  const recorder = useRef(null)
  const pezzi = useRef([])
  const streamRef = useRef(null)
  const orologio = useRef(null)
  const conPlugin = useRef(false)
  const annullato = useRef(false)
  const testoWeb = useRef('')
  // Le callback del chiamante cambiano a ogni render: si leggono da un ref,
  // così `onstop` — nato all'avvio — chiama sempre quelle di adesso.
  const cb = useRef({ trascrivi, onTesto, onErrore })
  useEffect(() => { cb.current = { trascrivi, onTesto, onErrore } })

  const spegniMicrofono = useCallback(() => {
    clearInterval(orologio.current)
    setLivello(0)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setStream(null)
  }, [])

  const errore = useCallback((msg) => cb.current.onErrore?.(msg), [])

  const manda = useCallback(async (base64, mimeType) => {
    if (annullato.current) return
    if (!base64) { errore('La registrazione è risultata vuota: riprova.'); return }
    setTrascrivendo(true)
    try {
      const testo = await cb.current.trascrivi(base64, mimeType)
      if (annullato.current) return
      if (testo && testo.trim()) cb.current.onTesto?.(testo.trim())
      else errore('Non ho capito: riprova, o scrivi la domanda.')
    } catch (e) {
      if (!annullato.current) errore(e?.message || 'Trascrizione non riuscita.')
    } finally {
      if (!annullato.current) setTrascrivendo(false)
    }
  }, [errore])

  // ── Il riconoscimento del browser, per quando si prova l'app dal PC ──────
  useEffect(() => {
    if (isNative || typeof window === 'undefined') return
    const Riconoscimento = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Riconoscimento) return
    const r = new Riconoscimento()
    r.continuous = true
    r.interimResults = true
    r.lang = 'it-IT'
    r.onresult = (event) => {
      let provv = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) testoWeb.current = `${testoWeb.current} ${t}`.trim()
        else provv += t
      }
      setProvvisorio(`${testoWeb.current} ${provv}`.trim())
    }
    r.onerror = () => setInAscolto(false)
    r.onend = () => {
      setInAscolto(false)
      setProvvisorio('')
      spegniMicrofono()
      const t = testoWeb.current.trim()
      testoWeb.current = ''
      if (t && !annullato.current) cb.current.onTesto?.(t)
    }
    recognition.current = r
  }, [isNative, spegniMicrofono])

  // Si chiude il foglio col microfono acceso: niente deve arrivare dopo.
  useEffect(() => () => {
    annullato.current = true
    clearInterval(orologio.current)
    try { recognition.current?.abort?.() } catch { /* già ferma */ }
    if (recorder.current && recorder.current.state !== 'inactive') {
      try { recorder.current.stop() } catch { /* già ferma */ }
    }
    if (conPlugin.current) VoiceRecorder.stopRecording().catch(() => {})
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
  }, [])

  const suLivello = useCallback((v) => {
    setLivello(v)
    if (v > SOGLIA_SEGNALE) setHaSentito(true)
  }, [])

  const avvia = useCallback(async () => {
    if (inAscolto || trascrivendo) return
    annullato.current = false
    if (isNative) {
      try {
        const perm = await VoiceRecorder.requestAudioRecordingPermission()
        if (!perm.value) return errore('Serve il permesso del microfono: attivalo nelle impostazioni del telefono.')
      } catch {
        // Il permesso vero lo chiede comunque getUserMedia qui sotto.
      }
    }

    let s = null
    try {
      if (navigator.mediaDevices?.getUserMedia) s = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      console.warn('Microfono non accessibile, nessuna forma d\'onda:', e)
    }

    if (isNative) {
      const formato = s ? formatoRegistrabile() : null
      conPlugin.current = !(formato && s)
      if (!conPlugin.current) {
        try {
          const rec = new MediaRecorder(s, { mimeType: formato })
          pezzi.current = []
          rec.ondataavailable = (e) => { if (e.data.size > 0) pezzi.current.push(e.data) }
          rec.onstop = async () => {
            if (annullato.current) return
            spegniMicrofono()
            const tipo = (rec.mimeType || formato).split(';')[0]
            const blob = new Blob(pezzi.current, { type: tipo })
            if (blob.size === 0) { errore('La registrazione è risultata vuota: riprova.'); return }
            try { await manda(await blobInBase64(blob), tipo) } catch (e) { errore(e.message) }
          }
          rec.start()
          recorder.current = rec
        } catch (e) {
          console.error('Errore avvio MediaRecorder:', e)
          if (s) s.getTracks().forEach(t => t.stop())
          return errore('Impossibile avviare la registrazione.')
        }
      } else {
        // ⚠️ Lo stream si chiude PRIMA del plugin: tenerlo aperto è
        // esattamente la condizione che produce il file vuoto.
        if (s) { s.getTracks().forEach(t => t.stop()); s = null }
        try {
          await VoiceRecorder.startRecording()
        } catch (e) {
          return errore("Errore nell'avvio della registrazione: " + (e?.message || e))
        }
      }
    } else {
      if (!recognition.current) {
        if (s) s.getTracks().forEach(t => t.stop())
        return errore('Il riconoscimento vocale non è supportato da questo browser: scrivi la domanda.')
      }
      testoWeb.current = ''
      try { recognition.current.start() } catch (e) { console.error('Riconoscimento vocale:', e) }
    }

    streamRef.current = s
    setStream(s)
    setProvvisorio('')
    setSecondi(0)
    setLivello(0)
    setHaSentito(false)
    setInAscolto(true)
    clearInterval(orologio.current)
    orologio.current = setInterval(() => setSecondi(x => x + 1), 1000)
    vibraPresa()
  }, [inAscolto, trascrivendo, isNative, manda, spegniMicrofono, errore])

  const ferma = useCallback(async () => {
    if (!inAscolto) return
    setInAscolto(false)
    clearInterval(orologio.current)
    battito()

    if (!isNative) {
      // `onend` consegna il testo e spegne il microfono.
      try { recognition.current?.stop() } catch { spegniMicrofono() }
      return
    }

    if (!conPlugin.current) {
      // L'attesa parte subito: fra lo stop e `onstop` il foglio non direbbe niente.
      setTrascrivendo(true)
      if (recorder.current && recorder.current.state !== 'inactive') {
        try { recorder.current.stop() } catch {
          setTrascrivendo(false)
          spegniMicrofono()
          errore('Registrazione non salvata: riprova.')
        }
      } else {
        setTrascrivendo(false)
        spegniMicrofono()
      }
      return
    }

    spegniMicrofono()
    try {
      const r = await VoiceRecorder.stopRecording()
      // ⚠️ Il plugin può tornare un file VUOTO dicendo che è andato tutto bene.
      if (!r?.value?.recordDataBase64 || r.value.msDuration === 0) {
        return errore('La registrazione è risultata vuota: riprova.')
      }
      await manda(r.value.recordDataBase64, r.value.mimeType || 'audio/aac')
    } catch (e) {
      errore('Errore elaborazione audio: ' + (e?.message || e))
    }
  }, [inAscolto, isNative, manda, spegniMicrofono, errore])

  return { inAscolto, trascrivendo, stream, secondi, livello, haSentito, provvisorio, avvia, ferma, suLivello, isNative }
}
