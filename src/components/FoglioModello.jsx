import { useState } from 'react'
import { createPortal } from 'react-dom'
import { BookmarkPlus, X } from 'lucide-react'
import { BOLLA_MODALE, BOTTONE_QUIETO, CARTA_MODALE, LABEL, TESTO_MODALE, TITOLO_MODALE, TONO_BOLLA } from '../lib/stiliCard'
import { CtaPrimaria } from './CreaWorkoutUI'
import { chiudiTastieraSuInvio } from '../useTastiera'
import { contenutoDaBlocco, nomeProposto, nomeValido, MAX_NOME } from '../lib/modelliBlocco'
import { salvaModello, MESSAGGIO_SENZA_RETE } from '../lib/modelliBloccoDb'
import { mostraErrore, mostraSuccesso } from '../lib/alert'
import { vibraErrore, vibraSuccesso } from '../lib/aptica'
import { useAuth } from '../App'

/**
 * «Salva come modello»: il coach dà un nome a un blocco Hyrox, a una fase
 * Corsa o a un gruppo Gym e lo mette in `modelli_blocco`, per reinserirlo in
 * un altro workout. Lo aprono i blocchi del builder (CreateWorkout e CreaGym).
 *
 * Il blocco nel workout non cambia: si salva una copia senza `id`
 * (`contenutoDaBlocco`). Se non riesce il foglio resta aperto, col nome
 * scritto, per riprovare.
 *
 * ⚠️ z-[110]: sopra il builder (z-[60]), sotto gli alert (z-[150]).
 * ⚠️ Il tasto indietro di Android la chiude perché ha la X «Chiudi» e il
 * bottone «Annulla» (src/lib/indietroAndroid.js).
 */
export function FoglioSalvaModello({ categoria, blocco, onChiudi }) {
  const { user } = useAuth() || {}
  const [nome, setNome] = useState(() => nomeProposto(categoria, blocco))
  const [salvando, setSalvando] = useState(false)

  const salva = async () => {
    if (!nomeValido(nome) || salvando) return
    setSalvando(true)
    try {
      if (!user?.id) throw new Error('Nessun utente')
      await salvaModello({ coach: user.id, categoria, nome, contenuto: contenutoDaBlocco(categoria, blocco) })
      vibraSuccesso()
      mostraSuccesso('Lo trovi in «Aggiungi» e in Modelli.', 'Modello salvato')
      onChiudi()
    } catch {
      vibraErrore()
      mostraErrore(MESSAGGIO_SENZA_RETE)
      setSalvando(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/85 z-[110] flex items-center justify-center p-4 velo-in" onClick={onChiudi}>
      <div role="dialog" aria-modal="true" aria-label="Salva come modello"
        className={`${CARTA_MODALE} relative`} onClick={e => e.stopPropagation()}>
        <button type="button" aria-label="Chiudi" onClick={onChiudi}
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-white">
          <X size={18} />
        </button>
        <div className={`${BOLLA_MODALE} ${TONO_BOLLA.avviso}`}><BookmarkPlus size={26} aria-hidden="true" /></div>
        <h2 className={TITOLO_MODALE}>Salva come modello</h2>
        <p className={TESTO_MODALE}>Lo ritrovi quando aggiungi un blocco a un altro workout.</p>

        <label className="flex flex-col gap-1.5 text-left">
          <span className={LABEL}>Nome</span>
          <input
            aria-label="Nome del modello"
            enterKeyHint="done"
            onKeyDown={chiudiTastieraSuInvio}
            maxLength={MAX_NOME}
            value={nome}
            onChange={e => setNome(e.target.value)}
            className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-[15px] font-bold text-white
                       placeholder-[#5b6070] focus:outline-none focus:border-brand"
          />
        </label>

        <div className="flex gap-3 mt-2">
          <button type="button" onClick={onChiudi} className={BOTTONE_QUIETO}>Annulla</button>
          <CtaPrimaria onClick={salva} disabled={!nomeValido(nome)} attesa={salvando}>Salva modello</CtaPrimaria>
        </div>
      </div>
    </div>,
    document.body
  )
}
