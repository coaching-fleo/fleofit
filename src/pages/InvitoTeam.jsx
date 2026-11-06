// InvitoTeam — l'invito in un team, lato atleta (06/11/2026, spec §5).
// Si apre dalla notifica (route /team/invito/:id). Il consenso è dell'atleta:
// Accetta e Rifiuta hanno lo stesso peso, perché rifiutare non deve sembrare
// una scortesia. La frase su chi vedrà i risultati dipende dalla scelta del
// coach (`classifica_visibile`): è il motivo per cui l'atleta accetta sapendo.
//
// Regole:
//   · funzione assente, team non più visibile (coach cambiato) o invito già
//     ritirato → torna alla Home, mai uno schermo bianco;
//   · già dentro → va alla scheda del team;
//   · una risposta sola anche con due tocchi; se fallisce, l'errore e i
//     bottoni restano (niente «sembra fatto» quando non lo è).
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { useAuth } from '../App'
import { leggiScheda, rispondi } from '../lib/teamDb'
import { mostraErrore } from '../lib/alert'
import { vibraScelta, vibraSuccesso } from '../lib/aptica'
import { BOTTONE_QUIETO, LABEL } from '../lib/stiliCard'
import { useIndietro } from '../useIndietro'
import { CartaTeam, RigaMembro, TestataTeam } from '../components/TeamUI'

const giorno = (d) => {
  try { return format(new Date(`${d}T12:00:00`), 'EEE d MMMM', { locale: it }) } catch { return '' }
}

export default function InvitoTeam() {
  const { id } = useParams()
  const { user } = useAuth() || {}
  const navigate = useNavigate()
  const indietro = useIndietro('/team')
  const [scheda, setScheda] = useState(null)
  const [occupato, setOccupato] = useState(false)
  const inCorso = useRef(false)

  useEffect(() => {
    let vivo = true
    leggiScheda(id)
      .then(({ disponibile, scheda: s }) => {
        if (!vivo) return
        const mio = s?.membri?.find(m => m.atleta_id === user?.id)
        if (!disponibile || !s || !mio) { navigate('/', { replace: true }); return }
        if (mio.stato === 'dentro') { navigate(`/team/${id}`, { replace: true }); return }
        setScheda(s)
      })
      .catch((e) => {
        console.warn('Invito non caricato:', e)
        if (vivo) navigate('/', { replace: true })
      })
    return () => { vivo = false }
  }, [id, user?.id, navigate])

  const rispondiCon = async (stato) => {
    if (inCorso.current) return
    inCorso.current = true
    setOccupato(true)
    vibraScelta()
    try {
      await rispondi(id, user?.id, stato)
      if (stato === 'dentro') {
        vibraSuccesso()
        navigate(`/team/${id}`, { replace: true })
      } else {
        navigate('/team', { replace: true })
      }
    } catch (e) {
      console.warn('Risposta all\'invito non salvata:', e)
      mostraErrore('Non sono riuscito a salvare la risposta. Controlla la connessione e riprova.')
      inCorso.current = false
      setOccupato(false)
    }
  }

  const team = scheda?.team
  const compagni = (scheda?.membri || []).filter(m => m.atleta_id !== user?.id)

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[var(--fondo-pagina)]">
      <TestataTeam titolo="Invito" onIndietro={indietro} />
      {team && (
        <div className="cascata max-w-2xl mx-auto flex flex-col gap-5 mt-2">
          <CartaTeam>
            <p className={LABEL}>Team</p>
            <h2 className="mt-1 text-[26px] font-black tracking-tight leading-tight">{team.nome}</h2>
            <p className="mt-1 text-[14px] text-gray-300">{`Ti invita ${scheda.coach?.nome || 'il tuo coach'}`}</p>
            {team.evento && (
              <p className="mt-1 text-[14px] text-gray-400">{`Obiettivo: ${team.evento.titolo}${team.evento.data ? ` · ${giorno(team.evento.data)}` : ''}`}</p>
            )}
            <p className="mt-4 text-[14px] leading-relaxed text-white font-semibold">
              {team.classifica_visibile
                ? 'I tuoi risultati saranno visibili ai compagni.'
                : 'Solo il coach vedrà i tuoi risultati.'}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-gray-400">Puoi uscire dal team quando vuoi.</p>
          </CartaTeam>

          {compagni.length > 0 && (
            <section aria-label="Nel team" className="flex flex-col gap-2.5">
              <h3 className={`${LABEL} px-1`}>Nel team</h3>
              <ul className="flex flex-col gap-2">
                {compagni.map(m => (
                  <RigaMembro key={m.atleta_id} nome={m.nome} cognome={m.cognome} foto={m.foto}
                    dettaglio={m.stato === 'dentro' ? 'Dentro' : 'Invitato'} />
                ))}
              </ul>
            </section>
          )}

          <div className="flex gap-3">
            <button type="button" disabled={occupato} onClick={() => rispondiCon('rifiutato')} className={BOTTONE_QUIETO}>
              Rifiuta
            </button>
            <button type="button" disabled={occupato} onClick={() => rispondiCon('dentro')}
              className={`${BOTTONE_QUIETO} !border-brand`}>
              Accetta
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
