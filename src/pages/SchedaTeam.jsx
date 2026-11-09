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
  ETICHETTE_METRICA, esitoSfida, giorniAlReinvito, giornoBreve, nomeBreve, nomeDa, testoReinvito, testoStato,
} from '../lib/membriTeam'
import { separaCodice } from '../lib/codiceWorkout'
import { mostraErrore } from '../lib/alert'
import { vibraSuccesso } from '../lib/aptica'
import { useIndietro } from '../useIndietro'
import { CustomConfirm } from '../components/CustomModals'
import {
  CartaTeam, Duello, Interruttore, Podio, RigaClassifica, RigaMembro, RigaSfida, SezioneTeam, StrisciaMembri, TestataTeam,
} from '../components/TeamUI'
import FoglioInvitaTeam from '../components/FoglioInvitaTeam'
import FoglioNuovaSfida from '../components/FoglioNuovaSfida'
import { CARTA_MODALE } from '../lib/stiliCard'
import { Plus } from 'lucide-react'

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

  // Solo il coach apre la scheda atleta (/athletes/:id è sua): per l'atleta i compagni non si toccano.
  const apriAtleta = staff ? (atletaId) => navigate(`/athletes/${atletaId}`) : null
  // Il coach vede anche chi non è (ancora, o più) dentro, con lo stato e l'azione.
  const fuori = staff ? membri.filter(m => m.stato !== 'dentro') : []
  // Nei posti stretti (righe delle sfide) il nome breve; «Ex membro» resta tale.
  const nomeCorto = (atletaId) => {
    const m = membri.find(x => x.atleta_id === atletaId)
    return m ? nomeBreve(m.nome, m.cognome) : nome(atletaId)
  }

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
  // La classifica per vittorie, pari merito = stesso posto (1, 1, 3).
  const classifica = dentro
    .map(m => ({ ...m, n: conteggio.get(m.atleta_id) || 0 }))
    .sort((p, q) => q.n - p.n)
  classifica.forEach((r, i) => { r.posto = i > 0 && r.n === classifica[i - 1].n ? classifica[i - 1].posto : i + 1 })
  const conPodio = vedeClassifica && chiuse.length > 0 && !coppia && dentro.length > 2 && classifica[0]?.n > 0

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
        <div className="cascata max-w-2xl mx-auto flex flex-col gap-7 mt-2">
          {vedeClassifica && chiuse.length > 0 && coppia && (
            <SezioneTeam etichetta="Testa a testa">
              <Duello x={coppia.x} y={coppia.y} a={coppia.a} b={coppia.b} ioId={user?.id} onApri={apriAtleta}>
                <ul className="flex flex-col border-t border-white/[.07] pt-2">
                  {coppia.sedute.map((sed, i) => {
                    const metrica = chiuse[i]?.metrica
                    return (
                      <li key={chiuse[i]?.id || i} className="flex items-center gap-3 py-2 text-[13.5px]">
                        <span className="text-muted w-[72px] shrink-0">{giornoBreve(sed.data)}</span>
                        <span className="flex-1 min-w-0 font-bold truncate">
                          {sed.vincitore ? (sed.vincitore === user?.id ? 'Tu' : nomeCorto(sed.vincitore)) : (sed.distacco === 0 ? 'Pari' : 'Manca un risultato')}
                        </span>
                        {sed.vincitore && <span className="text-gray-300 font-bold tabular-nums shrink-0">{`+${scriviValore(sed.distacco, metrica)}`}</span>}
                      </li>
                    )
                  })}
                </ul>
              </Duello>
            </SezioneTeam>
          )}

          {conPodio && (
            <SezioneTeam etichetta="Classifica">
              <Podio classifica={classifica} ioId={user?.id} onApri={apriAtleta} />
              {classifica.length > 3 && (
                <ul className="flex flex-col gap-2">
                  {classifica.slice(3).map(m => (
                    <RigaClassifica key={m.atleta_id} atletaId={m.atleta_id} onApri={apriAtleta} posto={m.posto} nome={m.nome} cognome={m.cognome} foto={m.foto}
                      n={m.n} tu={m.atleta_id === user?.id} />
                  ))}
                </ul>
              )}
            </SezioneTeam>
          )}

          <SezioneTeam etichetta="Membri">
            <CartaTeam>
              {dentro.length === 0 && !(staff && !team.chiuso_il) ? (
                <p className="text-[14px] text-gray-400 text-center">Nessuno è ancora dentro il team.</p>
              ) : (
                <StrisciaMembri membri={dentro} ioId={user?.id} onApri={apriAtleta}
                  onInvita={staff && !team.chiuso_il ? () => setFoglio('invita') : null} />
              )}
            </CartaTeam>
            {fuori.length > 0 && (
              <ul className="flex flex-col gap-2">
                {fuori.map(m => (
                  <RigaMembro key={m.atleta_id} atletaId={m.atleta_id} onApri={apriAtleta} nome={m.nome} cognome={m.cognome} foto={m.foto}
                    dettaglio={testoStato(m)} azione={azioneMembro(m)} />
                ))}
              </ul>
            )}
          </SezioneTeam>

          <SezioneTeam etichetta="Sfide"
            azione={staff && !team.chiuso_il && (
              <button type="button" onClick={() => setFoglio('sfida')}
                className="shrink-0 min-h-9 pl-2.5 pr-3.5 rounded-full bg-brand text-black text-[13px] font-black inline-flex items-center gap-1 hover:brightness-110 transition shadow-lg shadow-brand/20">
                <Plus size={16} strokeWidth={2.75} aria-hidden="true" />
                Assegna
              </button>
            )}>
            {sfide.length === 0 ? (
              <p className="rounded-3xl border border-dashed border-[#333] px-5 py-6 text-[14px] text-gray-400 leading-relaxed text-center">
                {staff ? 'Nessuna sfida ancora. Con «Assegna» scegli un allenamento da fare insieme o in sfida.' : 'Nessuna sfida ancora.'}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {sfide.map(s => (
                  <RigaSfida key={s.id} titolo={separaCodice(s.titolo || '').nome || s.titolo || 'Allenamento'}
                    data={giornoBreve(s.data)} metrica={ETICHETTE_METRICA[s.metrica]} chiave={s.metrica}
                    aperta={!s.chiusa_il}
                    esito={vedeClassifica ? esitoSfida(s, nomeCorto) : 'Chiusa'}
                    onApri={() => navigate(`/team/${id}/sfida/${s.id}`)} />
                ))}
              </ul>
            )}
          </SezioneTeam>

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
