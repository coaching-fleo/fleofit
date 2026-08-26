// CustomAudioPlayer, estratto il 26/08/2026 (BACKLOG #19 / CLAUDE.md §9 punto 1).
//
// Era ricopiato in WorkoutDetail e AthleteDetail. Non era un problema estetico:
// riproduce le note vocali fra coach e atleta.


import { useState, useRef } from 'react'
import { Play, Pause, Trash2 } from 'lucide-react'
import { BRAND } from '../lib/colori'

export default function CustomAudioPlayer({ src, onDelete, role }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState('0:00')
  const [duration, setDuration] = useState('0:00')
  const audioRef = useRef(null)

  const formatAudioTime = (time) => {
    if (isNaN(time)) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleTimeUpdate = () => {
    const current = audioRef.current.currentTime
    const total = audioRef.current.duration
    if (!isNaN(total)) {
      setProgress((current / total) * 100)
      setCurrentTime(formatAudioTime(current))
    }
  }

  const handleLoadedMetadata = () => {
    setDuration(formatAudioTime(audioRef.current.duration))
  }

  const handleSeek = (e) => {
    const seekTime = (e.target.value / 100) * audioRef.current.duration
    audioRef.current.currentTime = seekTime
    setProgress(e.target.value)
  }

  return (
    <div className="flex items-center gap-3 bg-[#111] p-2 rounded-xl border border-[#333] w-full mb-2">
      <audio 
        ref={audioRef} 
        src={src} 
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => { setIsPlaying(false); setProgress(0); audioRef.current.currentTime = 0; setCurrentTime('0:00') }}
      />
      <button aria-label={isPlaying ? 'Metti in pausa la nota vocale' : 'Riproduci la nota vocale'} onClick={togglePlay} className="w-11 h-11 rounded-full bg-brand flex items-center justify-center text-black shrink-0 hover:brightness-110 transition">
        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
      </button>
      <div className="flex-1 flex flex-col justify-center px-1">
         <div className="flex items-center gap-2 h-4">
            <input 
              type="range" 
              min="0" max="100" 
              value={progress} 
              onChange={handleSeek}
              className="w-full h-1.5 bg-[#333] rounded-lg appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-brand [&::-webkit-slider-thumb]:rounded-full cursor-pointer"
              style={{ background: `linear-gradient(to right, ${BRAND} ${progress}%, #333 ${progress}%)` }}
            />
         </div>
         <div className="flex justify-between items-center mt-1">
            <span className="text-[11px] text-muted font-medium">{currentTime}</span>
            <span className="text-[11px] text-muted font-medium">{duration}</span>
         </div>
      </div>
      {role === 'admin' && onDelete && (
        <button aria-label="Elimina la nota vocale" onClick={onDelete} className="w-11 h-11 flex items-center justify-center text-muted hover:text-red-500 transition shrink-0" title="Elimina vocale">
          <Trash2 size={18} />
        </button>
      )}
    </div>
  )
}
