// FoglioTeamGruppi — «Team e gruppi» dalla scheda di un atleta (16/11/2026,
// docs/memoria/scheda-atleta.md). Il coach mette l'atleta in un gruppo o lo
// toglie (subito, senza consenso: i gruppi sono solo suoi), e lo invita in un
// team, annulla l'invito o lo toglie se è dentro. Da qui si crea anche un gruppo nuovo (con dentro
// solo questo atleta) o un team nuovo (e l'atleta riceve l'invito).
//
// Nessuna logica nuova: i gruppi passano da gruppiAtleti.js + gruppiAtletiDb.js,
// i team da teamDb.js + `teamPerAtleta` di membriTeam.js.
// 🔴 «Togli» su chi è DENTRO funziona solo con team_togli_2026-11-16.sql
// applicata: prima la RLS non cancella niente, senza errore, e togliDalTeam
// risponde NON_TOLTO (qui diventa un messaggio, non un falso successo).
// La sezione Team c'è solo con `conTeam` (interruttore acceso e tabelle presenti),
// quella Gruppi solo con `gruppi` non null (tabella presente).
// ⚠️ X «Chiudi» e «Annulla»: il tasto indietro di Android li trova. Importato
// pigro: teamDb e gruppiAtletiDb non entrano nel chunk della scheda.
import { useCallback, useEffect, useState } from 'react'
import { Check, Layers, Plus, Users } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useBottomSheet } from '../useBottomSheet'
import { Foglio } from './FoglioMessaggio'
import FoglioNuovoTeam from './FoglioNuovoTeam'
import { BOTTONE_BRAND, BOTTONE_QUIETO, LABEL, META, RIGA, VETRO } from '../lib/stiliCard'
import { NOME_MAX, conAtleta, nomeGruppoValido } from '../lib/gruppiAtleti'
import { aggiornaGruppo, creaGruppo } from '../lib/gruppiAtletiDb'
import { teamPerAtleta } from '../lib/membriTeam'
import { annullaInvito, creaTeam, invita, leggiMembriAtleta, leggiMieiTeam, togliDalTeam } from '../lib/teamDb'
import { CustomConfirm } from './CustomModals'
import { vibraScelta, vibraSuccesso, vibraErrore } from '../lib/aptica'

const PICCOLO = 'shrink-0 min-h-[36px] px-3.5 rounded-full text-[13px] font-extrabold transition active:scale-[.97] disabled:opacity-50'

function Sezione({ etichetta, children }) {
  return (
    <section className="flex flex-col gap-2">
      <p className={LABEL}>{etichetta}</p>
      {children}
    </section>
  )
}

function Gruppi({ atletaId, coach, gruppi, onCambiati, onErrore }) {
  const [occupato, setOccupato] = useState(null)
  const [nuovo, setNuovo] = useState(false)
  const [nome, setNome] = useState('')
  const [errore, setErrore] = useState(null)

  const alterna = async (g) => {
    if (occupato) return
    const dentro = !(g.atleti || []).includes(atletaId)
    setOccupato(g.id)
    vibraScelta()
    try {
      await aggiornaGruppo(g.id, { nome: g.nome, atleti: conAtleta(g, atletaId, dentro) }, gruppi)
      await onCambiati()
    } catch (e) {
      console.warn('Gruppo non salvato:', e)
      vibraErrore()
      onErrore('Gruppo non salvato. Controlla la connessione e riprova.')
    } finally {
      setOccupato(null)
    }
  }

  const crea = async () => {
    const e = nomeGruppoValido(nome, gruppi)
    if (e) { setErrore(e); return }
    setOccupato('nuovo')
    try {
      await creaGruppo({ coach, nome, atleti: [atletaId] }, gruppi)
      vibraSuccesso()
      setNuovo(false); setNome('')
      await onCambiati()
    } catch (err) {
      setErrore(err?.message || 'Gruppo non creato. Riprova.')
    } finally {
      setOccupato(null)
    }
  }

  return (
    <Sezione etichetta="Gruppi">
      {gruppi.length === 0 && !nuovo && (
        <p className={`${META} py-1`}>Nessun gruppo ancora. Ti servono per assegnare un workout a più atleti con un tocco; loro non li vedono.</p>
      )}
      <ul className="flex flex-col gap-2">
        {gruppi.map((g) => {
          const dentro = (g.atleti || []).includes(atletaId)
          return (
            <li key={g.id}>
              <button type="button" onClick={() => alterna(g)} aria-pressed={dentro} disabled={!!occupato}
                className={`${RIGA} w-full flex items-center gap-3 px-3.5 py-3 text-left transition disabled:opacity-60 ${dentro ? 'border-brand/60' : ''}`}>
                <Layers size={18} aria-hidden="true" className="shrink-0 text-muted" />
                <span className="flex-1 min-w-0 text-[15px] font-bold text-white truncate">{g.nome}</span>
                <span aria-hidden="true" className={`w-6 h-6 shrink-0 rounded-full border flex items-center justify-center ${dentro ? 'bg-brand border-brand' : 'border-[#555] bg-[#111]'}`}>
                  {dentro && <Check size={14} className="text-black" />}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {nuovo ? (
        <div className="flex flex-col gap-2">
          <input type="text" value={nome} maxLength={NOME_MAX} placeholder="Nome del gruppo" aria-label="Nome del gruppo"
            onChange={(e) => { setNome(e.target.value); setErrore(null) }}
            className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-base text-white placeholder:text-gray-600 focus:border-brand outline-none" />
          {errore && <p role="alert" className="text-red-400 text-sm">{errore}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => { setNuovo(false); setNome(''); setErrore(null) }} className={BOTTONE_QUIETO}>Annulla</button>
            <button type="button" onClick={crea} disabled={occupato === 'nuovo'} className={BOTTONE_BRAND}>
              {occupato === 'nuovo' ? 'Creo…' : 'Crea gruppo'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setNuovo(true)}
          className={`${VETRO} min-h-[44px] rounded-2xl flex items-center justify-center gap-2 text-[14px] font-bold text-white hover:border-white/25 transition`}>
          <Plus size={17} aria-hidden="true" />Nuovo gruppo
        </button>
      )}
    </Sezione>
  )
}

function Team({ elenco, occupato, onAzione, onNuovo }) {
  return (
    <Sezione etichetta="Team">
      {elenco === null && <div className="h-14 rounded-[18px] bg-white/[.035] animate-pulse" aria-hidden="true" />}
      {elenco?.length === 0 && (
        <p className={`${META} py-1`}>Nessun team aperto. L'atleta riceve un invito e decide se entrare.</p>
      )}
      {elenco?.length > 0 && (
        <ul className="flex flex-col gap-2">
          {elenco.map(t => (
            <li key={t.id} className={`${RIGA} flex items-center gap-3 px-3.5 py-3`}>
              <Users size={18} aria-hidden="true" className="shrink-0 text-muted" />
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-bold text-white truncate">{t.nome}</span>
                {t.testo && <span className={`block ${META} truncate`}>{t.testo}</span>}
              </span>
              {t.azione === 'invita' && (
                <button type="button" onClick={() => onAzione(t)} disabled={!!occupato}
                  aria-label={`Invita in ${t.nome}`} className={`${PICCOLO} bg-brand text-black hover:brightness-110`}>
                  Invita
                </button>
              )}
              {t.azione === 'togli' && (
                <button type="button" onClick={() => onAzione(t)} disabled={!!occupato}
                  aria-label={`Togli da ${t.nome}`} className={`${PICCOLO} ${VETRO} text-red-400 hover:border-white/25`}>
                  Togli
                </button>
              )}
              {t.azione === 'annulla' && (
                <button type="button" onClick={() => onAzione(t)} disabled={!!occupato}
                  aria-label={`Annulla l'invito a ${t.nome}`} className={`${PICCOLO} ${VETRO} text-white hover:border-white/25`}>
                  Annulla invito
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onNuovo}
        className={`${VETRO} min-h-[44px] rounded-2xl flex items-center justify-center gap-2 text-[14px] font-bold text-white hover:border-white/25 transition`}>
        <Plus size={17} aria-hidden="true" />Nuovo team
      </button>
    </Sezione>
  )
}

/** I team del coach con la situazione di QUESTO atleta. `null` mentre legge. */
function useTeamAtleta(atletaId, inPausa, attivo) {
  const [elenco, setElenco] = useState(null)
  const carica = useCallback(async () => {
    try {
      const [t, m, c] = await Promise.all([
        leggiMieiTeam(),
        leggiMembriAtleta(atletaId),
        supabase.from('coach_atleti').select('coach_id').eq('athlete_id', atletaId),
      ])
      if (c.error) throw c.error
      setElenco(teamPerAtleta(t.team, m.righe, { coachDi: (c.data || []).map(r => r.coach_id), inPausa }))
    } catch (e) {
      console.warn('Team non caricati:', e)
      setElenco([])
    }
  }, [atletaId, inPausa])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- la lettura iniziale
  useEffect(() => { if (attivo) carica() }, [attivo, carica])
  return [elenco, carica]
}

function Principale({ atleta, coach, gruppi, conTeam, inPausa, onGruppiCambiati, onTeamCambiati, onNuovoTeam, onChiudi }) {
  const sheet = useBottomSheet(onChiudi)
  const [elenco, ricarica] = useTeamAtleta(atleta.id, inPausa, conTeam)
  const [occupato, setOccupato] = useState(null)
  const [errore, setErrore] = useState(null)
  const [conferma, setConferma] = useState(null)

  const esegui = async (t) => {
    setOccupato(t.id); setErrore(null)
    try {
      if (t.azione === 'invita') { await invita(t.id, [atleta.id]); vibraSuccesso() }
      else if (t.azione === 'togli') { await togliDalTeam(t.id, atleta.id); vibraScelta() }
      else { await annullaInvito(t.id, atleta.id); vibraScelta() }
      await ricarica()
      onTeamCambiati()
    } catch (e) {
      console.warn('Team non aggiornato:', e)
      vibraErrore()
      setErrore(e?.code === 'NON_TOLTO'
        ? 'Togliere un atleta da un team non è ancora attivo: serve un aggiornamento del database.'
        : 'Non sono riuscito ad aggiornare il team. Controlla la connessione e riprova.')
    } finally {
      setOccupato(null)
    }
  }

  // Togliere chiede conferma (l'atleta perde il team e le sue sfide); invitare e
  // annullare un invito no, come nella scheda del team.
  const azioneTeam = (t) => {
    if (occupato) return
    if (t.azione !== 'togli') { esegui(t); return }
    setConferma({
      title: `Togli ${atleta.nome} da «${t.nome}»?`,
      message: 'Non vedrà più il team e le sue sfide. I risultati che ha già inserito restano, senza nome. Potrai reinvitarlo quando vuoi.',
      confirmLabel: 'Togli',
      onConfirm: () => esegui(t),
    })
  }

  return (
    <Foglio titolo={`Team e gruppi · ${atleta.nome}`} {...sheet}>
      <div className="max-h-[75dvh] overflow-y-auto hide-scrollbar flex flex-col gap-5 pb-1">
        {errore && <p role="alert" className="text-red-400 text-sm">{errore}</p>}
        {gruppi && (
          <Gruppi atletaId={atleta.id} coach={coach} gruppi={gruppi}
            onCambiati={onGruppiCambiati} onErrore={setErrore} />
        )}
        {conTeam && <Team elenco={elenco} occupato={occupato} onAzione={azioneTeam} onNuovo={onNuovoTeam} />}
      </div>
      <CustomConfirm info={conferma} onClose={() => setConferma(null)} />
    </Foglio>
  )
}

/**
 * `gruppi`: i gruppi del coach (null = tabella assente, sezione nascosta).
 * `conTeam`: interruttore `team` acceso e tabelle presenti.
 * `onGruppiCambiati()` rilegge i gruppi nella pagina (e torna una promise);
 * `onTeamCambiati()` rilegge la riga «Team:» della scheda.
 */
export default function FoglioTeamGruppi(props) {
  const { atleta, inPausa, onTeamCambiati } = props
  // Due fogli, mai insieme: «Nuovo team» prende il posto di questo e, chiuso, lo riapre.
  const [nuovoTeam, setNuovoTeam] = useState(false)

  const crea = async (campi) => {
    try {
      const { id } = await creaTeam(campi)
      if (!inPausa) await invita(id, [atleta.id])
      vibraSuccesso()
      onTeamCambiati()
      return null
    } catch (e) {
      if (e?.code === '23505') return 'Hai già un team con questo nome.'
      console.warn('Team non creato:', e)
      return 'Non sono riuscito a creare il team. Controlla la connessione e riprova.'
    }
  }

  if (nuovoTeam) return <FoglioNuovoTeam onCrea={crea} onChiudi={() => setNuovoTeam(false)} />
  return <Principale {...props} onNuovoTeam={() => setNuovoTeam(true)} />
}
