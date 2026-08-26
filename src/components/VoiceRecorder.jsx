// VoiceRecorder, estratto il 26/08/2026 (BACKLOG #19 / CLAUDE.md §9 punto 1).
//
// 🔴 Questo è il componente che dimostra perché la duplicazione costa.
// Ne esistevano TRE copie — Home, WorkoutDetail, AthleteDetail — e il 25/08 un
// guasto è stato corretto in due su tre: la registrazione poteva sparire senza
// che né onSave né onCancel venissero chiamati, lasciando la modale ad
// aspettare per sempre. Home era rimasta indietro.
//
// Questa versione unifica il meglio delle due linee che si erano separate:
//   · da Home            il messaggio all'utente quando il MediaRecorder web fallisce
//                        (prima si premeva registra e non succedeva niente)
//   · da WorkoutDetail   il log dell'errore sul ramo nativo
//
// ⚠️ Chi lo modifica lo modifica per tutte e tre le pagine. È il punto.

import { useState, useEffect, useRef } from 'react'
import { Mic, Square, Trash2 } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { VoiceRecorder as NativeVoiceRecorder } from '@independo/capacitor-voice-recorder'
import { mostraErrore } from '../lib/alert'
import AudioVisualizer from './AudioVisualizer'

export default function VoiceRecorder({ onSave, onCancel }) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [mediaStream, setMediaStream] = useState(null)
  const isNative = Capacitor.isNativePlatform()
  
  const mediaRecorder = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const isCancelledRef = useRef(false)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (mediaStream) mediaStream.getTracks().forEach(t => t.stop())
    }
  }, [mediaStream])

  const toggleRecording = () => {
    if (isRecording) {
      stopRecordingAndSave()
    } else {
      startRecording()
    }
  }

  const startRecording = async () => {
    let stream = null;
    if (isNative) {
      try {
        let hasPerm = await NativeVoiceRecorder.hasAudioRecordingPermission()
        if (!hasPerm.value) {
          hasPerm = await NativeVoiceRecorder.requestAudioRecordingPermission()
          if (!hasPerm.value) return mostraErrore('Devi abilitare il microfono dalle impostazioni di iOS.')
        }
      } catch (e) {
        console.error("Errore permessi nativi:", e)
      }
    }
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        setMediaStream(stream)
      } catch (err) {
        // Lo stream serve solo alla forma d'onda: su iOS nativo la registrazione
        // la fa NativeVoiceRecorder, quindi qui si degrada senza visualizzatore.
        // Sul web il ramo !stream più sotto mostra comunque l'errore all'utente.
        console.warn('getUserMedia non disponibile, nessuna forma d\'onda:', err)
      }
    }
    if (isNative) {
      try {
        await NativeVoiceRecorder.startRecording()
        isCancelledRef.current = false
        setIsRecording(true)
        setRecordingTime(0)
        timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000)
      } catch (e) {
        // Il log veniva dalla copia in WorkoutDetail, il messaggio all'utente da
        // quella in Home: nessuna delle due le aveva entrambe.
        console.error('Errore avvio registrazione nativa:', e)
        mostraErrore('Impossibile accedere al microfono.')
      }
    } else {
      if (!window.MediaRecorder || !stream) {
        return mostraErrore('Il tuo browser non supporta la registrazione vocale.')
      }
      try {
        const recorder = new MediaRecorder(stream)
        chunksRef.current = []
        isCancelledRef.current = false
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        }
        
        recorder.onstop = () => {
          const mimeType = recorder.mimeType || 'audio/webm'
          const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('aac') ? 'aac' : 'webm'
          const audioBlob = new Blob(chunksRef.current, { type: mimeType })
          if (stream) stream.getTracks().forEach(track => track.stop())
          setMediaStream(null)
          if (!isCancelledRef.current) {
            onSave(audioBlob, ext)
          } else if (onCancel) {
            onCancel()
          }
        }
        
        recorder.start()
        mediaRecorder.current = recorder
        setIsRecording(true)
        setRecordingTime(0)
        timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000)
      } catch (err) {
        // Senza questo l'utente premeva registra e non succedeva niente: nessun
        // messaggio, setIsRecording mai true. Allineato a WorkoutDetail.
        console.error('Errore avvio MediaRecorder:', err)
        mostraErrore('Impossibile avviare la registrazione.')
      }
    }
  }

  const cancelRecording = async () => {
    isCancelledRef.current = true
    setIsRecording(false)
    clearInterval(timerRef.current)
    if (!isNative && mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop()
      return
    }
    if (isNative) {
      if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop())
        setMediaStream(null)
      }
      // Stiamo annullando: se lo stop fallisce l'audio va buttato comunque.
      try { await NativeVoiceRecorder.stopRecording() } catch { /* esito irrilevante */ }
      if (onCancel) onCancel()
    }
  }

  const stopRecordingAndSave = async () => {
    isCancelledRef.current = false
    setIsRecording(false)
    clearInterval(timerRef.current)
    if (!isNative && mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop()
      return
    }
    if (isNative) {
      if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop())
        setMediaStream(null)
      }
      try {
        const result = await NativeVoiceRecorder.stopRecording()
        if (result.value && result.value.recordDataBase64) {
          const mimeType = result.value.mimeType || 'audio/aac'
          const ext = mimeType.includes('mp4') ? 'mp4' : 'aac'
          const response = await fetch(`data:${mimeType};base64,${result.value.recordDataBase64}`)
          const audioBlob = await response.blob()
          onSave(audioBlob, ext)
        } else if (onCancel) onCancel()
      } catch (e) {
        // Prima la registrazione spariva in silenzio: né onSave né onCancel,
        // con la modale ferma in attesa di un callback che non arrivava mai.
        console.error('Errore stop nativo:', e)
        mostraErrore('Registrazione non salvata: riprova.')
        if (onCancel) onCancel()
      }
    }
  }

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-2 bg-[#111] border border-[#333] p-1.5 rounded-full h-12 w-full">
        {!isRecording ? (
          <button 
            onClick={toggleRecording}
            className="w-full h-full rounded-full flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-all"
          >
            <Mic size={18} className="text-brand" /> Tocca per registrare...
          </button>
        ) : (
          <div className="flex items-center justify-between w-full px-2 gap-2">
            <div className="flex items-center gap-1 text-red-500 font-semibold animate-pulse w-12 shrink-0 select-none text-xs">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              {Math.floor(recordingTime/60)}:{(recordingTime%60).toString().padStart(2,'0')}
            </div>
            
            <div className="flex-1 mx-2 overflow-hidden h-6 flex items-center justify-center gap-1">
              {mediaStream ? (
                <AudioVisualizer stream={mediaStream} />
              ) : (
                <div className="flex items-center gap-1 h-full py-1">
                  {[...Array(12)].map((_, i) => (
                    <div key={i} className="w-1.5 bg-brand rounded-full animate-bounce" style={{ height: '100%', animationDelay: `${i * 0.1}s`, animationDuration: '0.8s' }}></div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button aria-label="Annulla la registrazione" onClick={cancelRecording} className="text-gray-400 hover:text-red-500 transition p-1" title="Annulla">
                <Trash2 size={16} />
              </button>
              <button aria-label="Ferma e salva la registrazione" onClick={stopRecordingAndSave} className="w-11 h-11 flex items-center justify-center bg-brand text-black rounded-full hover:brightness-110 transition" title="Interrompi e Salva">
                <Square size={14} fill="currentColor" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
