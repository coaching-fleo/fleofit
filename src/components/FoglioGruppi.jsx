// FoglioGruppi — «I tuoi gruppi» (16/11/2026, docs/memoria/atleti.md): elenco ed
// editor dei gruppi di atleti del coach, nello stesso foglio. Si apre dal bottone
// «Gruppi» della pagina Atleti ed è importato pigro: il telefono lo scarica solo
// quando serve. I gruppi si USANO nel foglio «Assegna Workout» (GruppiUI.jsx).
// ⚠️ X «Chiudi» e «Annulla»: il tasto indietro di Android li trova.
import { useState } from 'react'
import { Check, ChevronRight, Plus, User } from 'lucide-react'
import { useBottomSheet } from '../useBottomSheet'
import { Foglio } from './FoglioMessaggio'
import { CustomConfirm } from './CustomModals'
import { CampoRicerca } from './ArchivioUI'
import { BOTTONE_BRAND, BOTTONE_QUIETO, LABEL } from '../lib/stiliCard'
import { NOME_MAX, membriVisibili, nomeGruppoValido } from '../lib/gruppiAtleti'
import { creaGruppo, aggiornaGruppo, eliminaGruppo } from '../lib/gruppiAtletiDb'
import { filtraPerNome, nomeAtleta, iniziali } from '../lib/rigaAtleta'
import { vibraSuccesso } from '../lib/aptica'

const conta = (n) => (n === 1 ? '1 atleta' : `${n} atleti`)

function Faccia({ atleta }) {
  return (
    <span className="w-7 h-7 -ml-2 first:ml-0 rounded-full bg-[#2a2a2a] border-2 border-[#1e1e1e] overflow-hidden flex items-center justify-center text-[10px] font-bold text-gray-300">
      {atleta.photo_url
        ? <img src={atleta.photo_url} alt="" className="w-full h-full object-cover" />
        : iniziali(atleta) || <User size={12} aria-hidden="true" />}
    </span>
  )
}

function Elenco({ gruppi, atleti, onApri, onNuovo }) {
  return (
    <div className="flex flex-col gap-2 pb-1">
      {gruppi.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          Nessun gruppo ancora. Un gruppo ti fa scegliere più atleti con un tocco quando assegni un workout; loro non lo vedono.
        </p>
      ) : gruppi.map(g => {
        const membri = membriVisibili(g, atleti)
        return (
          <button key={g.id} type="button" onClick={() => onApri(g)}
            aria-label={`${g.nome}, ${conta(membri.length)}`}
            className="flex items-center gap-3 bg-[#2a2a2a] border border-[#333] rounded-2xl p-3 text-left hover:border-brand transition">
            <span className="flex-1 min-w-0">
              <span className="block text-white font-bold truncate">{g.nome}</span>
              <span className="block text-xs text-gray-400">{conta(membri.length)}</span>
            </span>
            <span className="flex" aria-hidden="true">{membri.slice(0, 3).map(a => <Faccia key={a.id} atleta={a} />)}</span>
            <ChevronRight size={18} className="text-gray-500 shrink-0" aria-hidden="true" />
          </button>
        )
      })}
      <button type="button" onClick={onNuovo} className={`${BOTTONE_BRAND} mt-2 flex items-center justify-center gap-2`}>
        <Plus size={18} aria-hidden="true" /> Nuovo gruppo
      </button>
    </div>
  )
}

function Editor({ gruppo, gruppi, atleti, coach, onFatto, onIndietro }) {
  const [nome, setNome] = useState(gruppo?.nome ?? '')
  const [scelti, setScelti] = useState(() => new Set(membriVisibili(gruppo, atleti).map(a => a.id)))
  const [cerca, setCerca] = useState('')
  const [errore, setErrore] = useState(null)
  const [invio, setInvio] = useState(false)
  const [conferma, setConferma] = useState(null)

  const visibili = filtraPerNome(atleti, cerca)
  const alterna = (id) => setScelti(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const salva = async () => {
    const e = nomeGruppoValido(nome, gruppi, gruppo?.id ?? null)
    if (e) { setErrore(e); return }
    setInvio(true)
    try {
      // L'ordine degli id è quello della lista: chi non si vede più (cancellato,
      // passato a un altro coach) esce dal gruppo al primo salvataggio.
      const ids = atleti.filter(a => scelti.has(a.id)).map(a => a.id)
      if (gruppo) await aggiornaGruppo(gruppo.id, { nome, atleti: ids }, gruppi)
      else await creaGruppo({ coach, nome, atleti: ids }, gruppi)
      vibraSuccesso()
      onFatto()
    } catch (err) {
      setErrore(err?.message || 'Gruppo non salvato. Riprova.')
      setInvio(false)
    }
  }

  const elimina = () => setConferma({
    title: 'Elimina gruppo',
    message: `«${gruppo.nome}» sparisce. Gli atleti e i loro allenamenti restano come sono.`,
    confirmLabel: 'Elimina',
    onConfirm: async () => {
      try { await eliminaGruppo(gruppo.id); onFatto() }
      catch (err) { setErrore(err?.message || 'Gruppo non eliminato. Riprova.') }
    },
  })

  return (
    <div className="flex flex-col gap-3 pb-1">
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Nome del gruppo</span>
        <input type="text" value={nome} maxLength={NOME_MAX} placeholder="Es. Hyrox martedì"
          onChange={(e) => { setNome(e.target.value); setErrore(null) }}
          className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-base text-white placeholder:text-gray-600 focus:border-brand outline-none" />
      </label>
      {errore && <p role="alert" className="text-red-400 text-sm">{errore}</p>}
      <p className={LABEL}>Atleti · {scelti.size}</p>
      <div className="-mt-3.5">
        <CampoRicerca valore={cerca} onCambia={setCerca} etichetta="Cerca un atleta" placeholder="Cerca nome o cognome" />
      </div>
      <div className="flex flex-col gap-2 max-h-[40dvh] overflow-y-auto">
        {visibili.length === 0 && <p className="text-sm text-gray-400 text-center py-3">Nessun atleta.</p>}
        {visibili.map(a => {
          const dentro = scelti.has(a.id)
          return (
            <button key={a.id} type="button" onClick={() => alterna(a.id)} aria-pressed={dentro}
              className={`flex items-center justify-between gap-3 bg-[#2a2a2a] border rounded-2xl p-3 text-left transition ${dentro ? 'border-brand' : 'border-[#333]'}`}>
              <span className="text-white font-semibold truncate">{nomeAtleta(a)}</span>
              <span className={`w-6 h-6 shrink-0 rounded-full border flex items-center justify-center ${dentro ? 'bg-brand border-brand' : 'border-[#555] bg-[#111]'}`}>
                {dentro && <Check size={14} className="text-black" aria-hidden="true" />}
              </span>
            </button>
          )
        })}
      </div>
      <div className="flex gap-3 mt-1">
        <button type="button" onClick={onIndietro} className={BOTTONE_QUIETO}>Annulla</button>
        <button type="button" onClick={salva} disabled={invio} className={`${BOTTONE_BRAND} disabled:opacity-50`}>
          {invio ? 'Salvo…' : 'Salva'}
        </button>
      </div>
      {gruppo && (
        <button type="button" onClick={elimina} className="text-red-400 text-sm font-semibold py-2 hover:underline">
          Elimina gruppo
        </button>
      )}
      <CustomConfirm info={conferma} onClose={() => setConferma(null)} />
    </div>
  )
}

/**
 * `gruppi` e `atleti` arrivano dalla pagina; `onCambiati()` la fa rileggere
 * dopo ogni salvataggio o eliminazione.
 */
export default function FoglioGruppi({ gruppi, atleti, coach, onCambiati, onChiudi }) {
  const sheet = useBottomSheet(onChiudi)
  // null = elenco · { gruppo: null } = nuovo · { gruppo } = modifica
  const [aperto, setAperto] = useState(null)
  const titolo = !aperto ? 'I tuoi gruppi' : aperto.gruppo ? 'Modifica gruppo' : 'Nuovo gruppo'

  return (
    <Foglio titolo={titolo} {...sheet}>
      <div className="max-h-[75dvh] overflow-y-auto hide-scrollbar">
        {aperto ? (
          <Editor key={aperto.gruppo?.id ?? 'nuovo'} gruppo={aperto.gruppo} gruppi={gruppi} atleti={atleti} coach={coach}
            onIndietro={() => setAperto(null)}
            onFatto={() => { setAperto(null); onCambiati() }} />
        ) : (
          <Elenco gruppi={gruppi} atleti={atleti}
            onApri={(g) => setAperto({ gruppo: g })} onNuovo={() => setAperto({ gruppo: null })} />
        )}
      </div>
    </Foglio>
  )
}
