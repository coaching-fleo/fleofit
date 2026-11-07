// Team — /team per lo staff (06/11/2026, spec §6): i team del coach (un admin li
// vede tutti), «Nuovo team», e i team chiusi in fondo. Tabelle assenti
// (migrazione non applicata) = stato vuoto, MAI un alert.
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { creaTeam, leggiMieiTeam } from '../lib/teamDb'
import { vibraSuccesso } from '../lib/aptica'
import { useIndietro } from '../useIndietro'
import { RigaTeam, SezioneTeam, TestataTeam, VuotoTeam } from '../components/TeamUI'
import FoglioNuovoTeam from '../components/FoglioNuovoTeam'

const dettaglioTeam = (t) => {
  const parti = [`${t.dentro} dentro`]
  if (t.inAttesa) parti.push(`${t.inAttesa} in attesa`)
  return parti.join(' · ')
}

export default function Team() {
  const navigate = useNavigate()
  const indietro = useIndietro('/settings')
  const [team, setTeam] = useState(null)
  const [disponibile, setDisponibile] = useState(true)
  const [nuovo, setNuovo] = useState(false)

  const carica = useCallback(async () => {
    try {
      const r = await leggiMieiTeam()
      setDisponibile(r.disponibile)
      setTeam(r.team)
    } catch (e) {
      console.warn('Team non caricati:', e)
      setTeam([])
    }
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- la lettura iniziale
  useEffect(() => { carica() }, [carica])

  const crea = async (campi) => {
    try {
      const { id } = await creaTeam(campi)
      vibraSuccesso()
      navigate(`/team/${id}`)
      return null
    } catch (e) {
      if (e?.code === '23505') return 'Hai già un team con questo nome.'
      console.warn('Team non creato:', e)
      return 'Non sono riuscito a creare il team. Controlla la connessione e riprova.'
    }
  }

  const attivi = (team || []).filter(t => !t.chiuso_il)
  const chiusi = (team || []).filter(t => t.chiuso_il)

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[var(--fondo-pagina)]">
      <TestataTeam titolo="Team" dettaglio="Gruppi di atleti che si allenano insieme" onIndietro={indietro}
        azione={disponibile && team && (
          <button type="button" onClick={() => setNuovo(true)}
            className="shrink-0 min-h-[40px] inline-flex items-center gap-1 rounded-full bg-brand text-black px-4 text-[14px] font-extrabold hover:brightness-110 transition">
            <Plus size={17} aria-hidden="true" />Nuovo team
          </button>
        )} />
      {team && (
        <div className="cascata max-w-2xl mx-auto flex flex-col gap-6 mt-2">
          {!disponibile && (
            <VuotoTeam titolo="I team non sono ancora disponibili" dettaglio="Arrivano con un prossimo aggiornamento." />
          )}
          {disponibile && team.length === 0 && (
            <VuotoTeam titolo="Ancora nessun team"
              dettaglio="Riunisci gli atleti che si allenano insieme o preparano la stessa gara. Ognuno riceve un invito e decide se entrare."
              azione="Crea il primo team" onAzione={() => setNuovo(true)} />
          )}
          {attivi.length > 0 && (
            <SezioneTeam etichetta="I tuoi team">
              <ul className="flex flex-col gap-2">
                {attivi.map(t => <RigaTeam key={t.id} nome={t.nome} dettaglio={dettaglioTeam(t)} onApri={() => navigate(`/team/${t.id}`)} />)}
              </ul>
            </SezioneTeam>
          )}
          {chiusi.length > 0 && (
            <SezioneTeam etichetta="Chiusi">
              <ul className="flex flex-col gap-2">
                {chiusi.map(t => <RigaTeam key={t.id} nome={t.nome} dettaglio="Chiuso" onApri={() => navigate(`/team/${t.id}`)} />)}
              </ul>
            </SezioneTeam>
          )}
        </div>
      )}
      {nuovo && <FoglioNuovoTeam onCrea={crea} onChiudi={() => setNuovo(false)} />}
    </div>
  )
}
