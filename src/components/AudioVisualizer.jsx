// AudioVisualizer, estratto il 26/08/2026 (BACKLOG #19 / CLAUDE.md §9 punto 1).
//
// Era ricopiato in Home, WorkoutDetail e AthleteDetail. Non era un problema estetico:
// le tre copie erano identiche al 100%, ma sarebbero divergite
// alla prima modifica, come è già successo a VoiceRecorder.


import { useEffect, useRef } from 'react'
import { BRAND } from '../lib/colori'

export default function AudioVisualizer({ stream }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!stream) return
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }
    const analyser = audioCtx.createAnalyser()
    const source = audioCtx.createMediaStreamSource(stream)
    source.connect(analyser)
    analyser.fftSize = 64
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    const canvas = canvasRef.current
    const canvasCtx = canvas.getContext('2d')
    let animationId

    const draw = () => {
      animationId = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(dataArray)
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height)
      
      const barWidth = (canvas.width / bufferLength) * 1.5
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        let barHeight = dataArray[i] / 8
        if (barHeight < 2) barHeight = 2
        
        canvasCtx.fillStyle = BRAND
        const y = (canvas.height - barHeight) / 2
        
        canvasCtx.beginPath()
        if (canvasCtx.roundRect) canvasCtx.roundRect(x, y, barWidth - 2, barHeight, 4)
        else canvasCtx.rect(x, y, barWidth - 2, barHeight)
        canvasCtx.fill()
        
        x += barWidth
      }
    }
    draw()

    return () => {
      cancelAnimationFrame(animationId)
      if (audioCtx.state !== 'closed') audioCtx.close()
    }
  }, [stream])

  return <canvas ref={canvasRef} className="w-full h-8" width={200} height={32} />
}
