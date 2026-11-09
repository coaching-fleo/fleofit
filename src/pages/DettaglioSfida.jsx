// DettaglioSfida — /team/:id/sfida/:sfidaId (06/11/2026, spec §4-§5): la
// classifica di una seduta.
//   · coach: tutti, con il distacco dal primo, e «Chiudi sfida»;
//   · atleta: la classifica se il coach l'ha resa visibile, altrimenti solo il
//     proprio valore; finché la sfida è aperta lo può correggere.
// Chi non ha inserito il risultato mostra «—», mai uno zero. Chi è uscito
// resta come «Ex membro», senza nome né foto.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../App'
import { eStaff } from '../lib/ruoli'
import { chiudiSfida, leggiScheda, leggiSfide, salvaRisultato } from '../lib/teamDb'
import { leggiValore, ordinaSfida, scriviValore, versoDi } from '../lib/sfidaTeam'
import { ETICHETTE_METRICA, giornoBreve } from '../lib/membriTeam'
import { separaCodice } from '../lib/codiceWorkout'
import { mostraErrore } from '../lib/alert'
import { vibraSuccesso } from '../lib/aptica'
import { useIndietro } from '../useIndietro'
import { CustomConfirm } from '../components/CustomModals'
import { CAMPO_TEAM, CartaTeam, RigaMembro, SezioneTeam, TestataTeam } from '../components/TeamUI'
import { META } from '../lib/stiliCard'

const RIPROVA = 'Controlla la connessione e riprova.'

/** «—» per il primo e per chi non ha valore; «+0:20» per il tempo, «−14» per il resto. */
function testoDistacco(r, metrica) {
  if (r.valore == null || r.posto === 1) return '—'
  return `${versoDi(metrica) === 'minore' ? '+' : '−'}${scriviValore(r.distacco, metrica)}`
}

export default function DettaglioSfida() {
  const { id, sfidaId } = useParams()
  const { role, user } = useAuth() || {}
  const staff = eStaff(role)
  const navigate = useNavigate()
  const indietro = useIndietro(`/team/${id}`)
  const [scheda, setScheda] = useState(null)
  const [sfida, setSfida] = useState(null)
  const [testo, setTesto] = useState('')
  const [conferma, setConferma] = useState(null)
  const [occupato, setOccupato] = useState(false)

  const carica = useCallback(async () => {
    try {
      const [s, f] = await Promise.all([leggiScheda(id), leggiSfide(id)])
      const trovata = (f.sfide || []).find(x => x.id === sfidaId)
      if (!s.disponibile || !s.scheda || !trovata) { navigate(`/team/${id}`, { replace: true }); return }
      setScheda(s.scheda)
      setSfida(trovata)
      const mio = trovata.risultati.find(r => r.atleta_id === user?.id)
      setTesto(mio ? (trovata.metrica === 'tempo' ? scriviValore(mio.valore, 'tempo') : String(mio.valore)) : '')
    } catch (e) {
      console.warn('Sfida non caricata:', e)
      navigate(`/team/${id}`, { replace: true })
    }
  }, [id, sfidaId, navigate, user?.id])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- la lettura iniziale
  useEffect(() => { carica() }, [carica])

  const membri = useMemo(() => scheda?.membri || [], [scheda])
  const team = scheda?.team
  // A sfida aperta compare anche chi non ha ancora inserito; a sfida chiusa
  // solo chi ha un risultato (chi è entrato dopo non c'era).
  const classifica = useMemo(() => (sfida
    ? ordinaSfida(sfida.risultati, sfida.chiusa_il ? [] : membri.filter(m => m.stato === 'dentro').map(m => m.atleta_id), sfida.metrica)
    : []), [sfida, membri])
  const perId = useMemo(() => new Map(membri.map(m => [m.atleta_id, m])), [membri])

  const vedeClassifica = staff || !!team?.classifica_visibile
  const aperta = sfida && !sfida.chiusa_il
  const mioInClassifica = !staff && classifica.some(r => r.atleta_id === user?.id)
  const valoreLetto = sfida ? leggiValore(testo, sfida.metrica) : null

  const fai = async (azione, testoErrore) => {
    setOccupato(true)
    try { await azione(); vibraSuccesso(); await carica() } catch (e) {
      console.warn(testoErrore, e)
      mostraErrore(`${testoErrore} ${RIPROVA}`)
    } finally { setOccupato(false) }
  }
  const chiedichiusura = () => setConferma({
    title: 'Chiudi sfida',
    message: 'Dopo la chiusura nessuno potrà più inserire o correggere il risultato.',
    confirmLabel: 'Chiudi sfida',
    onConfirm: () => fai(() => chiudiSfida(sfidaId), 'Sfida non chiusa.'),
  })
  const salva = () => fai(() => salvaRisultato(sfidaId, user.id, valoreLetto), 'Risultato non salvato.')

  const titolo = sfida ? (separaCodice(sfida.titolo || '').nome || sfida.titolo || 'Sfida') : 'Sfida'

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[var(--fondo-pagina)]">
      <TestataTeam titolo={titolo} onIndietro={indietro}
        dettaglio={sfida ? [
          team?.nome, giornoBreve(sfida.data), ETICHETTE_METRICA[sfida.metrica], sfida.chiusa_il ? 'Chiusa' : 'In corso',
        ].filter(Boolean).join(' · ') : null} />

      {sfida && (
        <div className="cascata max-w-2xl mx-auto flex flex-col gap-6 mt-2">
          {mioInClassifica && aperta && (
            <CartaTeam className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={META}>Il tuo risultato · {ETICHETTE_METRICA[sfida.metrica]}</span>
                <input aria-label="Il tuo risultato" value={testo} onChange={e => setTesto(e.target.value)}
                  inputMode={sfida.metrica === 'tempo' || sfida.metrica === 'ripetizioni' ? 'numeric' : 'decimal'}
                  placeholder={sfida.metrica === 'tempo' ? 'm:ss' : '0'}
                  aria-invalid={testo.trim() && valoreLetto == null ? true : undefined}
                  className={CAMPO_TEAM} />
              </label>
              <button type="button" onClick={salva} disabled={occupato || valoreLetto == null}
                className="self-end min-h-[44px] px-5 rounded-full bg-brand text-black text-[14px] font-extrabold hover:brightness-110 transition disabled:opacity-50">
                Salva
              </button>
            </CartaTeam>
          )}

          {!vedeClassifica && mioInClassifica && !aperta && (
            <CartaTeam>
              <p className={META}>Il tuo risultato</p>
              <p className="text-[22px] font-black">{scriviValore(sfida.risultati.find(r => r.atleta_id === user?.id)?.valore, sfida.metrica)}</p>
            </CartaTeam>
          )}

          {vedeClassifica && (
            <SezioneTeam etichetta="Classifica"
              azione={staff && aperta && (
                <button type="button" onClick={chiedichiusura} disabled={occupato}
                  className="text-[13.5px] font-bold text-red-500 hover:text-red-400 disabled:opacity-50">
                  Chiudi sfida
                </button>
              )}>
              <ul aria-label="Classifica" className="flex flex-col gap-2">
                {classifica.map(r => {
                  const m = perId.get(r.atleta_id)
                  const ex = !m || m.stato === 'uscito'
                  return (
                    <RigaMembro key={r.atleta_id}
                      nome={ex ? 'Ex membro' : m.nome} cognome={ex ? '' : m.cognome} foto={ex ? null : m.foto}
                      dettaglio={r.posto ? `${r.posto}°` : 'Non ancora inserito'}
                      azione={(
                        <span className="flex flex-col items-end shrink-0">
                          <span className="text-[16px] font-black text-white">{scriviValore(r.valore, sfida.metrica)}</span>
                          <span className={META}>{testoDistacco(r, sfida.metrica)}</span>
                        </span>
                      )} />
                  )
                })}
              </ul>
            </SezioneTeam>
          )}
        </div>
      )}
      {createPortal(<CustomConfirm info={conferma} onClose={() => setConferma(null)} />, document.body)}
    </div>
  )
}
