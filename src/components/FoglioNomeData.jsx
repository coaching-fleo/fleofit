// FoglioNomeData — nome e data del workout, dal passo 2 di Crea workout
// (26/11/2026, «Tocca e parti»: docs/memoria/crea-workout.md).
//
// Fino al 26/11 nome e data stavano al passo 1, sotto le categorie, e
// spingevano «Costruisci l'allenamento» in fondo allo schermo. Ma sono
// facoltativi: il nome lo sceglie l'app dai blocchi, la data parte da oggi (o
// dal giorno del Calendario). Ora si cambiano qui, solo se servono.
//
// ⚠️ Le modifiche sono DAL VIVO: ogni tasto scrive subito nello stato della
// pagina, come faceva il campo al passo 1. «Fatto» e la X chiudono e basta —
// non c'è un «Annulla» che dovrebbe ricordare il valore di prima.
// ⚠️ La X «Chiudi» c'è (in `Foglio`): il tasto indietro di Android la trova.
import { Dices } from 'lucide-react'
import { BOTTONE_BRAND } from '../lib/stiliCard'
import { useBottomSheet } from '../useBottomSheet'
import { chiudiTastieraSuInvio } from '../useTastiera'
import { vibraScelta } from '../lib/aptica'
import { Foglio } from './FoglioMessaggio'
import { RigaCampo } from './CreaWorkoutUI'
import CustomDatePicker from './CustomDatePicker'

export default function FoglioNomeData({ nome, onNome, segnaposto, onAltroNome, data, onData, onChiudi }) {
  const sheet = useBottomSheet(onChiudi)

  return (
    <Foglio titolo="Nome e data" {...sheet}>
      <div className="flex flex-col gap-2.5 pb-1">
        <RigaCampo etichetta="Nome">
          <div className="flex items-center gap-2">
            <input
              aria-label="Nome del workout"
              enterKeyHint="done"
              onKeyDown={chiudiTastieraSuInvio}
              className="w-full bg-transparent text-[15.5px] font-bold text-white placeholder-[#5b6070] focus:outline-none"
              placeholder={segnaposto}
              value={nome}
              onChange={e => onNome(e.target.value)}
            />
            {/* Il nome casuale non piace? Se ne pesca un altro. Solo a campo
                vuoto: un nome scritto non si sostituisce. */}
            {onAltroNome && (
              <button
                type="button"
                aria-label="Un altro nome"
                onClick={() => { vibraScelta(); onAltroNome() }}
                className="shrink-0 -my-1 p-1.5 rounded-full text-[#8a8f9c] hover:text-white active:scale-90 transition"
              >
                <Dices size={18} />
              </button>
            )}
          </div>
        </RigaCampo>
        <RigaCampo etichetta="Data">
          <CustomDatePicker
            date={data}
            onChange={onData}
            placeholder="Scegli la data"
            className="text-[15.5px] font-bold"
          />
        </RigaCampo>
        {/* ⚠️ `onMouseDown` annullato, come in BarraAzioni: con la tastiera
            aperta iOS la chiude al mousedown, il foglio si sposta e il click
            cade nel vuoto. Così «Fatto» funziona al primo tocco. */}
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={sheet.chiudi}
          className={`${BOTTONE_BRAND} mt-2`}>
          Fatto
        </button>
      </div>
    </Foglio>
  )
}
