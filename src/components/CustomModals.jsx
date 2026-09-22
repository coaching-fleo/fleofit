import { useEffect, useState } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { registraAlertHost } from '../lib/alert'
import {
  BOLLA_MODALE, BOTTONE_BRAND, BOTTONE_QUIETO, CARTA_MODALE,
  TESTO_MODALE, TITOLO_MODALE, TONO_BOLLA,
} from '../lib/stiliCard'

/**
 * 🔴 IL VELO E LA CARTA SONO UNA COPPIA, E IL VELO ERA LA METÀ MANCANTE.
 * Segnalato dal committente il 22/09/2026 sulla modale «Bozza Trovata»: «non è
 * graficamente coerente con il resto dell'app e compare secca». La carta la sua
 * entrata ce l'aveva già — ma il velo arrivava a `bg-black/85` PIENO nello
 * stesso fotogramma, e un nero che si accende secco copre qualunque movimento
 * ci sia dietro. Ora sfuma con `velo-in`, che è lo stesso keyframe dei bottom
 * sheet: il velo dell'app è uno.
 */
const VELO = 'fixed inset-0 bg-black/85 z-[150] flex items-center justify-center p-4 velo-in'

/**
 * Il vestito sta in `lib/stiliCard.js`, non qui: questi due componenti non
 * coprono tutti i dialoghi del progetto — quelli con una conferma distruttiva
 * sono scritti a mano in tre pagine — e le stringhe di classi erano già in
 * quattro copie. Vedi la nota in testa a quel blocco.
 */
function Bolla({ tono, children }) {
  return <div className={`${BOLLA_MODALE} ${TONO_BOLLA[tono]}`}>{children}</div>
}

export function CustomAlert({ info, onClose }) {
  if (!info) return null
  const errore = info.type === 'error'
  return (
    <div className={VELO}>
      <div role="dialog" aria-modal="true" aria-label={info.title} className={CARTA_MODALE}>
        <Bolla tono={errore ? 'errore' : 'successo'}>
          {errore ? <AlertTriangle size={26} aria-hidden="true" /> : <Check size={26} aria-hidden="true" />}
        </Bolla>
        <h2 className={TITOLO_MODALE}>{info.title}</h2>
        <p className={`${TESTO_MODALE} whitespace-pre-wrap`}>{info.message}</p>
        <div className="flex gap-3 mt-2">
          <button onClick={onClose} className={BOTTONE_QUIETO}>Chiudi</button>
        </div>
      </div>
    </div>
  )
}

export function CustomConfirm({ info, onClose }) {
  if (!info) return null
  return (
    <div className={VELO}>
      <div role="dialog" aria-modal="true" aria-label={info.title} className={CARTA_MODALE}>
        <Bolla tono="avviso"><AlertTriangle size={26} aria-hidden="true" /></Bolla>
        <h2 className={TITOLO_MODALE}>{info.title}</h2>
        <p className={`${TESTO_MODALE} whitespace-pre-wrap`}>{info.message}</p>
        <div className="flex gap-3 mt-2">
          <button onClick={() => { if (info.onCancel) info.onCancel(); onClose(); }} className={BOTTONE_QUIETO}>Annulla</button>
          <button onClick={() => { info.onConfirm(); onClose(); }} className={BOTTONE_BRAND}>Conferma</button>
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
