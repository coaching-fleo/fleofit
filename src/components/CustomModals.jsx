import { useEffect, useState } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { registraAlertHost } from '../lib/alert'

export function CustomAlert({ info, onClose }) {
  if (!info) return null
  return (
    <div className="fixed inset-0 bg-black/85 z-[150] flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl w-full max-w-sm p-6 flex flex-col gap-4 text-center shadow-2xl modal-transition">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 shrink-0 ${info.type === 'error' ? 'bg-red-900/30 text-red-500' : 'bg-green-900/30 text-green-500'}`}>
          {info.type === 'error' ? <AlertTriangle size={32} /> : <Check size={32} />}
        </div>
        <h2 className="text-xl font-bold text-white">{info.title}</h2>
        <p className="text-gray-400 text-sm whitespace-pre-wrap">{info.message}</p>
        <button onClick={onClose} className="mt-4 w-full py-3 bg-[#2a2a2a] text-white font-semibold rounded-xl hover:bg-[#333] transition">
          Chiudi
        </button>
      </div>
    </div>
  )
}

export function CustomConfirm({ info, onClose }) {
  if (!info) return null
  return (
    <div className="fixed inset-0 bg-black/85 z-[150] flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl w-full max-w-sm p-6 flex flex-col gap-4 text-center shadow-2xl modal-transition">
        <div className="w-16 h-16 rounded-full bg-[#f1ba17]/20 text-[#f1ba17] flex items-center justify-center mx-auto mb-2 shrink-0">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-xl font-bold text-white">{info.title}</h2>
        <p className="text-gray-400 text-sm whitespace-pre-wrap">{info.message}</p>
        <div className="flex gap-3 mt-4">
          <button onClick={() => { if (info.onCancel) info.onCancel(); onClose(); }} className="flex-1 py-3 bg-[#2a2a2a] text-white font-semibold rounded-xl hover:bg-[#333] transition">Annulla</button>
          <button onClick={() => { info.onConfirm(); onClose(); }} className="flex-1 py-3 bg-[#f1ba17] text-black font-semibold rounded-xl hover:brightness-110 transition">Conferma</button>
        </div>
      </div>
    </div>
  )
}

/** Montato una sola volta in App.jsx: riceve gli alert da mostraAlert()/mostraErrore(). */
export function AlertHost() {
  const [info, setInfo] = useState(null)
  useEffect(() => registraAlertHost(setInfo), [])
  return <CustomAlert info={info} onClose={() => setInfo(null)} />
}
