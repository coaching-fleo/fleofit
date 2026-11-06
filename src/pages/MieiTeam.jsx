// MieiTeam — /team per l'atleta (06/11/2026, spec §6): gli inviti in attesa e i
// team in cui è dentro. Tabelle assenti (migrazione non applicata) = stato
// vuoto, MAI un alert.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { leggiTeamAtleta } from '../lib/teamDb'
import { useIndietro } from '../useIndietro'
import { RigaTeam, SezioneTeam, TestataTeam, VuotoTeam } from '../components/TeamUI'

export default function MieiTeam() {
  const { user } = useAuth() || {}
  const navigate = useNavigate()
  const indietro = useIndietro('/settings')
  // null = in caricamento
  const [team, setTeam] = useState(null)

  useEffect(() => {
    let vivo = true
    leggiTeamAtleta(user?.id)
      .then((r) => { if (vivo) setTeam(r.disponibile ? r.team : []) })
      .catch((e) => { console.warn('Team non caricati:', e); if (vivo) setTeam([]) })
    return () => { vivo = false }
  }, [user?.id])

  const inviti = (team || []).filter(t => t.stato === 'invitato')
  const dentro = (team || []).filter(t => t.stato === 'dentro')

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[var(--fondo-pagina)]">
      <TestataTeam titolo="I miei team" onIndietro={indietro} />
      {team && (
        <div className="cascata max-w-2xl mx-auto flex flex-col gap-6 mt-2">
          {team.length === 0 && (
            <VuotoTeam titolo="Non sei ancora in un team"
              dettaglio="Quando il coach ti invita in un team, l'invito arriva qui e nelle notifiche." />
          )}
          {inviti.length > 0 && (
            <SezioneTeam etichetta="Inviti">
              <ul className="flex flex-col gap-2">
                {inviti.map(t => (
                  <RigaTeam key={t.id} nome={t.nome} dettaglio="Ti aspetta una risposta"
                    onApri={() => navigate(`/team/invito/${t.id}`)} />
                ))}
              </ul>
            </SezioneTeam>
          )}
          {dentro.length > 0 && (
            <SezioneTeam etichetta="I tuoi team">
              <ul className="flex flex-col gap-2">
                {dentro.map(t => (
                  <RigaTeam key={t.id} nome={t.nome}
                    dettaglio={t.classifica_visibile ? 'Classifica condivisa' : 'Risultati visti dal coach'}
                    onApri={() => navigate(`/team/${t.id}`)} />
                ))}
              </ul>
            </SezioneTeam>
          )}
        </div>
      )}
    </div>
  )
}
