// SchedaTeam — /team/:id (06/11/2026, spec §6-§7). Due facce sulla stessa rotta:
//   · coach: Membri (con lo stato in parole, Invita, Reinvita, Annulla invito),
//     Sfide («Assegna»: insieme o sfida), Impostazioni (classifica visibile, chiudi team);
//   · atleta: i compagni dentro, le sfide, e «Esci dal team».
// I nomi arrivano da `team_scheda` (l'atleta non legge `athletes` altrui).
// Funzione assente o team non più visibile → torna alla lista.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../App'
import { eStaff } from '../lib/ruoli'
import {
  aggiornaTeam, annullaInvito, assegnaInsieme, cancellaMieiRisultati, chiudiTeam, creaSfida, invita, leggiScheda, leggiSfide, rispondi,
} from '../lib/teamDb'
import { scriviValore, testaATesta, vittorie } from '../lib/sfidaTeam'
import {
  ETICHETTE_METRICA, esitoSfida, giorniAlReinvito, giornoBreve, nomeDa, testoReinvito, testoStato,
} from '../lib/membriTeam'
import { separaCodice } from '../lib/codiceWorkout'
import { mostraErrore } from '../lib/alert'
import { vibraSuccesso } from '../lib/aptica'
import { useIndietro } from '../useIndietro'
import { CustomConfirm } from '../components/CustomModals'
import {
  CartaTeam, Interruttore, RigaMembro, RigaSfida, SezioneTeam, TestataTeam,
} from '../components/TeamUI'
import FoglioInvitaTeam from '../components/FoglioInvitaTeam'
import FoglioNuovaSfida from '../components/FoglioNuovaSfida'
import { CARTA_MODALE } from '../lib/stiliCard'

const RIPROVA = 'Controlla la connessione e riprova.'
const AZIONE = 'shrink-0 min-h-9 px-3 rounded-full bg-white/[.07] border border-white/[.12] text-[12.5px] font-bold ' +
  'text-white hover:border-white/25 transition disabled:opacity-50 disabled:hover:border-white/[.12]'

export default function SchedaTeam() {
  const { id } = useParams()
  const { role, user } = useAuth() || {}
  const staff = eStaff(role)
  const navigate = useNavigate()
  const indietro = useIndietro('/team')
  const [scheda, setScheda] = useState(null)
  const [sfide, setSfide] = useState([])
  const [foglio, setFoglio] = useState(null)   // 'invita' | 'sfida' | null
  const [conferma, setConferma] = useState(null)
  const [occupato, setOccupato] = useState(false)

  const carica = useCallback(async () => {
    try {
      const [s, f] = await Promise.all([leggiScheda(id), leggiSfide(id)])
      if (!s.disponibile || !s.scheda) { navigate('/team', { replace: true }); return }
      setScheda(s.scheda)
      setSfide(f.sfide || [])
    } catch (e) {
      console.warn('Team non caricato:', e)
      navigate('/team', { replace: true })
    }
  }, [id, navigate])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- la lettura iniziale
  useEffect(() => { carica() }, [carica])

  const membri = useMemo(() => scheda?.membri || [], [scheda])
  const dentro = membri.filter(m => m.stato === 'dentro')
  const nome = useMemo(() => nomeDa(membri), [membri])
  const team = scheda?.team

  // ── azioni del coach ──────────────────────────────────────────────────────
  const fai = async (azione, testoErrore) => {
    setOccupato(true)
    try { await azione(); await carica(); return true } catch (e) {
      console.warn(testoErrore, e)
      mostraErrore(`${testoErrore} ${RIPROVA}`)
      return false
    } finally { setOccupato(false) }
  }
  const invitaAtleti = (ids) => fai(async () => { await invita(id, ids); vibraSuccesso() }, 'Invito non partito.')
  // «Insieme» non crea una sfida: assegna e basta (09/11/2026).
  const nuovaSfida = ({ modo, ...campi }) => modo === 'sfida'
    ? fai(async () => { await creaSfida({ teamId: id, ...campi }); vibraSuccesso() }, 'Sfida non creata.')
    : fai(async () => { await assegnaInsieme({ teamId: id, ...campi }); vibraSuccesso() }, 'Allenamento non assegnato.')

  const cambiaClassifica = () => {
    const nuova = !team.classifica_visibile
    const applica = () => fai(() => aggiornaTeam(id, { classifica_visibile: nuova }), 'Impostazione non salvata.')
    if (nuova && dentro.length > 0) {
      setConferma({
        title: 'Rendere visibile la classifica?',
        message: 'I compagni vedranno i risultati di tutti, anche quelli già inseriti.',
        confirmLabel: 'Rendi visibile',
        onConfirm: applica,
      })
    } else applica()
  }
  const chiedichiusura = () => setConferma({
    title: 'Chiudere il team?',
    message: 'Non si potranno più invitare atleti né creare sfide. La storia delle sfide resta.',
    confirmLabel: 'Chiudi team',
    onConfirm: () => fai(() => chiudiTeam(id), 'Team non chiuso.'),
  })

  const azioneMembro = (m) => {
    if (!staff || team?.chiuso_il) return null
    if (m.stato === 'invitato') {
      return (
        <button type="button" className={AZIONE} disabled={occupato}
          onClick={() => fai(() => annullaInvito(id, m.atleta_id), 'Invito non annullato.')}>
          Annulla invito
        </button>
      )
    }
    if (m.stato === 'rifiutato' || m.stato === 'uscito') {
      const n = giorniAlReinvito(m.risposto_il)
      return n > 0
        ? <button type="button" className={AZIONE} disabled>{testoReinvito(n)}</button>
        : <button type="button" className={AZIONE} disabled={occupato} onClick={() => invitaAtleti([m.atleta_id])}>Reinvita</button>
    }
    return null
  }

  const elencoMembri = staff ? membri : dentro

  // ── il confronto: testa a testa in due, vittorie in più ────────────────────
  const vedeClassifica = staff || !!team?.classifica_visibile
  const chiuse = sfide.filter(s => s.chiusa_il)
  const coppia = useMemo(() => {
    if (dentro.length !== 2) return null
    // L'atleta si vede a sinistra.
    const [x, y] = dentro[1]?.atleta_id === user?.id ? [dentro[1], dentro[0]] : dentro
    return { x, y, ...testaATesta(chiuse, x.atleta_id, y.atleta_id) }
  }, [dentro, chiuse, user?.id])
  const conteggio = vittorie(chiuse)

  // ── l'atleta esce ──────────────────────────────────────────────────────────
  const [uscita, setUscita] = useState(null)   // null | { cancella: boolean }
  const esci = async () => {
    setOccupato(true)
    try {
      // Prima i risultati: dopo l'uscita la RLS nasconde le sfide.
      if (uscita?.cancella) await cancellaMieiRisultati(id, user.id)
      await rispondi(id, user.id, 'uscito')
      navigate('/team', { replace: true })
    } catch (e) {
      console.warn('Uscita non riuscita:', e)
      mostraErrore(`Non sei uscito dal team. ${RIPROVA}`)
      setOccupato(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[var(--fondo-pagina)]">
      <TestataTeam titolo={team?.nome || 'Team'} onIndietro={indietro}
        dettaglio={team ? [
          team.chiuso_il ? 'Chiuso' : `${dentro.length} dentro`,
          team.evento ? `${separaCodice(team.evento.titolo || '').nome || team.evento.titolo} · ${giornoBreve(team.evento.data)}` : null,
        ].filter(Boolean).join(' · ') : null} />

      {team && (
        <div className="cascata max-w-2xl mx-auto flex flex-col gap-6 mt-2">
          <SezioneTeam etichetta="Membri"
            azione={staff && !team.chiuso_il && (
              <button type="button" className={AZIONE} onClick={() => setFoglio('invita')}>Invita</button>
            )}>
            <ul className="flex flex-col gap-2">
              {elencoMembri.map(m => (
                <RigaMembro key={m.atleta_id} nome={m.nome} cognome={m.cognome} foto={m.foto}
                  dettaglio={staff ? testoStato(m) : (m.atleta_id === user?.id ? 'Tu' : null)}
                  azione={azioneMembro(m)} />
              ))}
            </ul>
          </SezioneTeam>

          <SezioneTeam etichetta="Sfide"
            azione={staff && !team.chiuso_il && (
              <button type="button" className={AZIONE} onClick={() => setFoglio('sfida')}>Assegna</button>
            )}>
            {sfide.length === 0 ? (
              <p className="rounded-3xl border border-dashed border-[#333] px-5 py-6 text-[14px] text-gray-400 leading-relaxed text-center">
                {staff ? 'Nessuna sfida ancora. Scegli un allenamento da fare insieme e cosa si misura.' : 'Nessuna sfida ancora.'}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {sfide.map(s => (
                  <RigaSfida key={s.id} titolo={separaCodice(s.titolo || '').nome || s.titolo || 'Allenamento'}
                    data={giornoBreve(s.data)} metrica={ETICHETTE_METRICA[s.metrica]}
                    esito={staff || team.classifica_visibile ? esitoSfida(s, nome) : (s.chiusa_il ? 'Chiusa' : 'In corso')}
                    onApri={() => navigate(`/team/${id}/sfida/${s.id}`)} />
                ))}
              </ul>
            )}
          </SezioneTeam>

          {vedeClassifica && chiuse.length > 0 && coppia && (
            <SezioneTeam etichetta="Testa a testa">
              <CartaTeam className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex-1 min-w-0 text-[15px] font-bold truncate">{coppia.x.atleta_id === user?.id ? 'Tu' : nome(coppia.x.atleta_id)}</span>
                  <span className="text-[28px] font-black tracking-tight tabular-nums">{`${coppia.a}–${coppia.b}`}</span>
                  <span className="flex-1 min-w-0 text-[15px] font-bold truncate text-right">{nome(coppia.y.atleta_id)}</span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {coppia.sedute.map((sed, i) => {
                    const metrica = chiuse[i]?.metrica
                    return (
                      <li key={chiuse[i]?.id || i} className="flex items-center gap-3 text-[13.5px]">
                        <span className="text-gray-400 w-20 shrink-0">{giornoBreve(sed.data)}</span>
                        <span className="flex-1 min-w-0 font-bold truncate">
                          {sed.vincitore ? (sed.vincitore === user?.id ? 'Tu' : nome(sed.vincitore)) : (sed.distacco === 0 ? 'Pari' : 'Manca un risultato')}
                        </span>
                        {sed.vincitore && <span className="text-gray-400 shrink-0">{scriviValore(sed.distacco, metrica)}</span>}
                      </li>
                    )
                  })}
                </ul>
              </CartaTeam>
            </SezioneTeam>
          )}

          {vedeClassifica && chiuse.length > 0 && !coppia && dentro.length > 2 && (
            <SezioneTeam etichetta="Vittorie">
              <ul className="flex flex-col gap-2">
                {[...dentro].sort((p, q) => (conteggio.get(q.atleta_id) || 0) - (conteggio.get(p.atleta_id) || 0)).map(m => {
                  const n = conteggio.get(m.atleta_id) || 0
                  return (
                    <RigaMembro key={m.atleta_id} nome={m.nome} cognome={m.cognome} foto={m.foto}
                      dettaglio={m.atleta_id === user?.id ? 'Tu' : null}
                      azione={<span className="shrink-0 text-[15px] font-black">{n === 1 ? '1 vittoria' : `${n} vittorie`}</span>} />
                  )
                })}
              </ul>
            </SezioneTeam>
          )}

          {!staff && dentro.some(m => m.atleta_id === user?.id) && (
            <button type="button" onClick={() => setUscita({ cancella: false })}
              className="self-center text-[13.5px] font-bold text-red-500 hover:text-red-400">
              Esci dal team
            </button>
          )}

          {staff && (
            <SezioneTeam etichetta="Impostazioni">
              <CartaTeam className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-bold text-white">Classifica visibile agli atleti</span>
                    <span className="block text-[12.5px] font-medium text-muted">
                      {team.classifica_visibile ? 'I compagni vedono i risultati di tutti.' : 'I risultati li vedi solo tu.'}
                    </span>
                  </span>
                  <Interruttore etichetta="Classifica visibile agli atleti" attivo={!!team.classifica_visibile}
                    onCambia={cambiaClassifica} occupato={occupato || !!team.chiuso_il} />
                </div>
                {!team.chiuso_il && (
                  <button type="button" onClick={chiedichiusura}
                    className="self-start text-[13.5px] font-bold text-red-500 hover:text-red-400">
                    Chiudi team
                  </button>
                )}
              </CartaTeam>
            </SezioneTeam>
          )}
        </div>
      )}

      {foglio === 'invita' && (
        <FoglioInvitaTeam membri={membri} coachId={team?.coach_id || user?.id} onInvita={invitaAtleti} onChiudi={() => setFoglio(null)} />
      )}
      {foglio === 'sfida' && (
        <FoglioNuovaSfida dentro={dentro.length} onCrea={nuovaSfida} onChiudi={() => setFoglio(null)} />
      )}
      {uscita && createPortal(
        <div className="fixed inset-0 bg-black/85 z-[150] flex items-center justify-center p-4 velo-in">
          <div role="dialog" aria-modal="true" aria-label="Esci dal team" className={CARTA_MODALE}>
            <h2 className="text-xl font-black mb-2">Esci dal team</h2>
            <p className="text-[14px] text-gray-400 leading-relaxed mb-4">
              Non vedrai più le sfide di «{team?.nome}». I tuoi risultati restano nella classifica come «Ex membro», senza il tuo nome.
            </p>
            <label className="flex items-center gap-3 mb-5 text-[14.5px] font-bold">
              <input type="checkbox" checked={uscita.cancella} onChange={e => setUscita({ cancella: e.target.checked })}
                className="w-5 h-5 accent-[#f1ba17]" />
              Cancella anche i miei risultati
            </label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setUscita(null)} disabled={occupato}
                className="flex-1 py-3.5 bg-[#2a2a2a] text-white font-semibold rounded-xl hover:bg-[#333] transition disabled:opacity-50">Annulla</button>
              <button type="button" onClick={esci} disabled={occupato}
                className="flex-1 py-3.5 bg-red-600 text-white font-black rounded-xl hover:brightness-110 transition disabled:opacity-50">Esci</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
      {createPortal(<CustomConfirm info={conferma} onClose={() => setConferma(null)} />, document.body)}
    </div>
  )
}
