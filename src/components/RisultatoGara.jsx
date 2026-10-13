import { useState, useEffect, useCallback } from 'react'
import { Flag, ChevronDown, ChevronRight, RefreshCw, ExternalLink, Search } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { vibraScelta, vibraSuccesso } from '../lib/aptica'
import { CARD, LABEL } from '../lib/stiliCard'
import {
  cercaRisultato, salvaRisultato, ignora, nomeDaCercare, cittaGara, divisioneCorta, tempoCorto,
  splitInOrdine, leggiTempoScritto, dettaglioRisultato, cercaInGara, tempoDallaNota, riferimentoDallaNota,
  statisticheSalvate, riassuntoGara,
} from '../lib/risultatoGara'

/**
 * «Com'è andata?»: sulla scheda di una gara HYROX già corsa, cerca da solo il
 * tempo dell'atleta su results.hyrox.com (Edge Function `risultato-hyrox`) e
 * chiede conferma prima di salvarlo — gli omonimi esistono, e il sito cerca
 * per inizio del cognome. Se non lo trova, il tempo si scrive a mano.
 * Logica e salvataggio in src/lib/risultatoGara.js; storia in
 * docs/memoria/calendario.md.
 */
export default function RisultatoGara({ awId, athleteId, sections, titolo, giorno, onSalvato }) {
  const citta = cittaGara(sections, titolo)
  // Una gara passata conosce già il suo gruppo sul sito dei risultati: non
  // serve ritrovarlo da città e data.
  const gruppo = sections?.hyrox?.gruppo
  const stagione = sections?.hyrox?.stagione
  const cerca = useCallback((chi) => (gruppo && stagione
    ? cercaInGara(supabase, { gruppo, stagione, ...chi })
    : cercaRisultato(supabase, { citta, giorno, ...chi })), [citta, giorno, gruppo, stagione])
  const conferma = async (risultato) => {
    await salvaRisultato(supabase, { awId, athleteId, citta, giorno, risultato })
    onSalvato?.()
  }
  const nonHo = () => { ignora(awId); onSalvato?.() }
  return (
    <div className={`${CARD} p-5`}>
      <RicercaTempo athleteId={athleteId} citta={citta} etichetta="Com'è andata?" cerca={cerca}
        onConferma={conferma} onNonHo={nonHo} />
    </div>
  )
}

/**
 * Il cuore di «Com'è andata?», senza sapere dove si salva. Cerca il COGNOME
 * dell'atleta con `cerca({ cognome, nome })` e mostra la lista di chi l'ha
 * (individuali e squadre): l'atleta tocca la sua riga, vede tempo, posizioni
 * e split, e conferma (12/10/2026: «legga solo il cognome, mi dà la lista e
 * seleziono io»). Il cognome si può correggere, per chi ha corso con un'altra
 * grafia. Lo usano la scheda della gara (qui sopra) e le gare passate.
 */
export function RicercaTempo({ athleteId, citta, etichetta, cerca: cercaNome, onConferma, onNonHo }) {
  const [fase, setFase] = useState('cerco')
  const [chi, setChi] = useState(null)
  const [cognome, setCognome] = useState('')
  const [esito, setEsito] = useState(null)
  const [scelto, setScelto] = useState(null)
  const [aMano, setAMano] = useState('')
  const [errore, setErrore] = useState('')
  const [salvando, setSalvando] = useState(false)

  const cerca = useCallback(async (persona) => {
    setFase('cerco')
    setErrore('')
    setScelto(null)
    const r = await cercaNome(persona)
    setEsito(r)
    setFase(r.stato === 'trovato' ? 'scegli' : r.stato) // 'nessun-risultato' · 'gara-non-trovata' · 'errore'
  }, [cercaNome])

  useEffect(() => {
    // La ricerca parte da sola, col cognome del profilo: è il punto della funzione.
    let vivo = true
    supabase.from('athletes').select('name, surname').eq('id', athleteId).single().then(({ data }) => {
      if (!vivo) return
      const persona = nomeDaCercare(data)
      setChi(persona)
      setCognome(persona?.cognome || '')
      if (persona) cerca(persona)
      else setFase('senza-nome')
    })
    return () => { vivo = false }
  }, [athleteId, cerca])

  const cercaCognome = (e) => {
    e?.preventDefault()
    const c = cognome.trim()
    if (!c) return
    vibraScelta()
    cerca({ cognome: c, nome: chi?.nome || '' })
  }

  const apri = async (riga) => {
    vibraScelta()
    setScelto(riga)
    setFase('dettaglio')
    const d = await dettaglioRisultato(supabase, { stagione: esito?.stagione, idp: riga.idp, evento: riga.evento })
    // Senza dettaglio resta la riga: tempo e categoria li ha già, e basta per salvare.
    setScelto(d ? { ...riga, ...d, nome: riga.nome, divisione: d.divisione || riga.divisione } : riga)
    setFase('proposta')
  }

  const salva = async (risultato) => {
    setSalvando(true)
    setErrore('')
    try {
      await onConferma(risultato)
      vibraSuccesso()
    } catch (e) {
      console.error('Salvataggio del tempo di gara:', e)
      setErrore('Non sono riuscito a salvare il tempo. Riprova.')
    } finally {
      setSalvando(false)
    }
  }

  const salvaAMano = () => {
    const tempo = leggiTempoScritto(aMano)
    if (!tempo) { setErrore('Scrivi il tempo come 1:12:38'); return }
    salva({ tempo })
  }

  const nonHoPartecipato = onNonHo ? () => { vibraScelta(); onNonHo() } : null
  const candidati = esito?.candidati || []

  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-brand/10 border border-brand/30 text-brand flex items-center justify-center shrink-0">
          <Flag size={18} />
        </span>
        <div className="min-w-0">
          <p className={LABEL}>{etichetta}</p>
          <p className="text-[17px] font-black tracking-tight text-white leading-tight truncate">HYROX {citta}</p>
        </div>
      </div>

      {(fase === 'scegli' || fase === 'nessun-risultato' || fase === 'senza-nome') && (
        <form onSubmit={cercaCognome} className="flex gap-2">
          <input type="text" value={cognome} onChange={e => setCognome(e.target.value)} placeholder="Il tuo cognome"
            aria-label="Cognome da cercare" autoCapitalize="words"
            className="flex-1 min-w-0 bg-[#111] border border-[#333] text-white px-4 py-2.5 rounded-xl focus:outline-none focus:border-brand text-base" />
          <button type="submit" disabled={!cognome.trim()} aria-label="Cerca il cognome"
            className="px-4 rounded-xl bg-[#2a2a2a] text-white hover:bg-[#333] disabled:opacity-40 transition">
            <Search size={18} />
          </button>
        </form>
      )}

      {(fase === 'cerco' || fase === 'dettaglio') && (
        <div className="flex flex-col gap-2" aria-label={fase === 'cerco' ? 'Cerco il tuo tempo' : 'Carico il risultato'}>
          <p className="text-sm text-gray-400">{fase === 'cerco' ? 'Cerco il tuo cognome fra i risultati ufficiali…' : 'Carico tempo e split…'}</p>
          <div className="h-16 rounded-2xl bg-[#111] border border-[#2a2a2a] animate-pulse" />
        </div>
      )}

      {fase === 'scegli' && (
        <>
          <p className="text-sm text-gray-400">
            {candidati.length === 1 ? 'Ho trovato un risultato. Sei tu?' : `Ho trovato ${candidati.length} risultati. Tocca il tuo.`}
          </p>
          <ul className="flex flex-col gap-2">
            {candidati.map(c => (
              <li key={c.idp}>
                <button onClick={() => apri(c)}
                  className="w-full text-left bg-[#111] border border-[#2a2a2a] hover:border-brand rounded-2xl px-4 py-3 flex items-center justify-between gap-3 transition">
                  <span className="min-w-0">
                    <span className="block text-white font-semibold leading-snug">{c.nome}</span>
                    <span className="block text-xs text-gray-400 mt-0.5">{[divisioneCorta(c.divisione), giornoDivisione(c.divisione), c.categoriaEta].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="text-white font-black tabular-nums shrink-0">{c.tempo ? tempoCorto(c.tempo) : '—'}</span>
                </button>
              </li>
            ))}
          </ul>
          <AltreStrade onAMano={() => setFase('manuale')} onNonHo={nonHoPartecipato} />
        </>
      )}

      {fase === 'proposta' && scelto && (
        <>
          <Candidato c={scelto} />
          <div className="flex flex-col gap-2">
            <button onClick={() => salva(scelto)} disabled={salvando || !scelto.tempo}
              className="w-full py-3.5 bg-brand text-black font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50">
              {salvando ? 'Salvataggio...' : 'Sì, sono io'}
            </button>
            <button onClick={() => { vibraScelta(); setFase('scegli') }}
              className="w-full py-3 bg-[#2a2a2a] text-gray-300 font-bold rounded-xl hover:bg-[#333] transition">
              Torna alla lista
            </button>
          </div>
        </>
      )}

      {(fase === 'nessun-risultato' || fase === 'gara-non-trovata' || fase === 'errore' || fase === 'senza-nome') && (
        <>
          <p className="text-sm text-gray-400 leading-relaxed">
            {fase === 'gara-non-trovata' && `I risultati di ${citta} non sono ancora sul sito HYROX. Di solito escono la sera della gara.`}
            {fase === 'nessun-risultato' && `Nessun «${cognome.trim()}» fra i risultati. Se hai corso con un altro cognome, correggilo qui sopra.`}
            {fase === 'errore' && (esito?.messaggio || 'I risultati HYROX non rispondono in questo momento.')}
            {fase === 'senza-nome' && 'Scrivi il tuo cognome qui sopra per cercare il tuo tempo.'}
          </p>
          {(fase === 'gara-non-trovata' || fase === 'errore') && (
            <button onClick={() => { vibraScelta(); cerca({ cognome: cognome.trim() || chi?.cognome, nome: chi?.nome || '' }) }}
              className="self-start flex items-center gap-2 text-sm font-bold text-white">
              <RefreshCw size={15} /> Riprova
            </button>
          )}
          <AltreStrade onAMano={() => setFase('manuale')} onNonHo={nonHoPartecipato} />
        </>
      )}

      {fase === 'manuale' && (
        <div className="flex flex-col gap-3">
          <label className="text-gray-400 text-xs pl-1 block" htmlFor="tempo-gara">Il tuo tempo finale</label>
          <input id="tempo-gara" type="text" inputMode="numeric" placeholder="1:12:38" value={aMano}
            onChange={e => setAMano(e.target.value)}
            className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-brand text-2xl font-black tabular-nums tracking-tight" />
          <button onClick={salvaAMano} disabled={salvando || !aMano.trim()}
            className="w-full py-3.5 bg-brand text-black font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50">
            {salvando ? 'Salvataggio...' : 'Salva il tempo'}
          </button>
          {esito?.stato === 'trovato' && (
            <button onClick={() => setFase('scegli')} className="text-sm text-gray-400 hover:text-white">
              Torna ai risultati trovati
            </button>
          )}
        </div>
      )}

      {errore && <p className="text-sm text-red-400">{errore}</p>}
    </div>
  )
}

const GIORNI_EN = { monday: 'lun', tuesday: 'mar', wednesday: 'mer', thursday: 'gio', friday: 'ven', saturday: 'sab', sunday: 'dom' }
/** «HYROX DOUBLES - Saturday» → «sab»: due righe uguali in giorni diversi si distinguono. */
function giornoDivisione(divisione) {
  const m = /-\s*(\w+day)\s*$/i.exec(divisione || '')
  return m ? GIORNI_EN[m[1].toLowerCase()] || '' : ''
}

/** Un risultato: tempo grande, divisione e posizioni, e gli split su richiesta. */
function Candidato({ c }) {
  const [aperti, setAperti] = useState(false)
  const split = splitInOrdine(c)
  const dettagli = [
    divisioneCorta(c.divisione),
    c.posizione && `${c.posizione}° assoluto`,
    c.posizioneCategoria && `${c.posizioneCategoria}° di categoria${c.categoriaEta ? ` (${c.categoriaEta})` : ''}`,
  ].filter(Boolean)
  return (
    <div className="bg-[#111] border border-brand/30 rounded-2xl p-4 flex flex-col gap-3">
      <div>
        <p className="text-[40px] font-black tracking-[-.04em] text-white leading-none tabular-nums">{tempoCorto(c.tempo)}</p>
        <p className="mt-1.5 text-sm text-gray-300">{dettagli.join(' · ')}</p>
        <p className="mt-1 text-xs text-muted">{c.nome}</p>
      </div>
      {(c.roxzone || c.totaleCorsa) && (
        <div className="grid grid-cols-2 gap-2">
          {c.totaleCorsa && <Cella etichetta="Corsa" valore={tempoCorto(c.totaleCorsa)} />}
          {c.roxzone && <Cella etichetta="Roxzone" valore={tempoCorto(c.roxzone)} />}
        </div>
      )}
      {split.length > 0 && (
        <>
          <button onClick={() => { vibraScelta(); setAperti(v => !v) }} aria-expanded={aperti}
            className="flex items-center gap-1.5 text-sm font-bold text-gray-300 hover:text-white self-start">
            {aperti ? <ChevronDown size={16} /> : <ChevronRight size={16} />} Split
          </button>
          {aperti && (
            <ol className="flex flex-col">
              {split.map((s, i) => (
                <li key={i} className={`flex items-center justify-between py-1.5 text-sm border-t border-[#222] ${s.corsa ? 'text-gray-400' : 'text-white font-semibold'}`}>
                  <span>{s.nome}</span>
                  <span className="tabular-nums">{s.tempo}{s.posizione ? <span className="text-muted font-normal"> · {s.posizione}°</span> : null}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
      {c.url && (
        <a href={c.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted hover:text-white self-start">
          Risultato ufficiale <ExternalLink size={12} />
        </a>
      )}
    </div>
  )
}

function Cella({ etichetta, valore }) {
  return (
    <div className="bg-[#1a1a1a] rounded-xl px-3 py-2">
      <p className={LABEL}>{etichetta}</p>
      <p className="text-white font-black tabular-nums">{valore}</p>
    </div>
  )
}

function AltreStrade({ onAMano, onNonHo }) {
  return (
    <div className="flex flex-col gap-2">
      <button onClick={() => { vibraScelta(); onAMano() }}
        className="w-full py-3 bg-[#2a2a2a] text-white font-bold rounded-xl hover:bg-[#333] transition">
        Scrivo il tempo a mano
      </button>
      {onNonHo && (
        <button onClick={onNonHo} className="text-sm text-gray-500 hover:text-gray-300 py-1">
          Non ho partecipato
        </button>
      )}
    </div>
  )
}

/**
 * Il risultato salvato di una gara, sulla sua scheda: il tempo grande e, se
 * nella nota c'è il link al risultato ufficiale, le statistiche della gara —
 * posizioni, corsa, stazioni, Roxzone, la stazione migliore e quella da
 * migliorare, e tutti gli split. Il dettaglio si legge dal sito la prima
 * volta e poi resta nel telefono (`statisticheSalvate`).
 * Senza link (tempo scritto a mano, o salvato prima del 13/10/2026) mostra
 * il tempo e offre `onAggiorna`, che rifà la ricerca.
 */
export function StatisticheGara({ note, onAggiorna }) {
  const tempo = tempoDallaNota(note)
  const rif = riferimentoDallaNota(note)
  const [dettaglio, setDettaglio] = useState(null)
  const [stato, setStato] = useState(rif ? 'carico' : 'senza')

  useEffect(() => {
    if (!rif) return
    let vivo = true
    statisticheSalvate(supabase, rif).then(d => {
      if (!vivo) return
      setDettaglio(d)
      setStato(d ? 'pronto' : 'errore')
    })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rif?.stagione, rif?.idp, rif?.evento])

  if (!tempo) return null
  const r = riassuntoGara(dettaglio)
  const split = splitInOrdine(dettaglio || {})
  const url = String(note || '').split('\n').find(l => l.startsWith('🔗'))?.split(': ').slice(1).join(': ')

  return (
    <div className={`${CARD} p-5 flex flex-col gap-4`}>
      <div className="text-center">
        <p className={LABEL}>Il tuo tempo</p>
        <p className="mt-2 text-[44px] font-black tracking-[-.04em] text-white leading-none tabular-nums">{tempo.tempo}</p>
        {tempo.dettagli && <p className="mt-2 text-sm text-brand font-semibold">{tempo.dettagli}</p>}
      </div>

      {stato === 'carico' && <div className="h-24 rounded-2xl bg-[#111] border border-[#2a2a2a] animate-pulse" aria-label="Carico le statistiche" />}
      {stato === 'errore' && <p className="text-sm text-gray-400 text-center">Le statistiche della gara non si caricano adesso. Riprova più tardi.</p>}

      {stato === 'pronto' && r && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Cella etichetta="Corsa" valore={r.corsa || '—'} />
            <Cella etichetta="Stazioni" valore={r.stazioni || '—'} />
            <Cella etichetta="Roxzone" valore={r.roxzone || '—'} />
          </div>
          {(r.migliore || r.peggiore) && (
            <div className="flex flex-col gap-2">
              {r.migliore && <Rilievo etichetta="La tua stazione migliore" stazione={r.migliore} colore="text-green-400" />}
              {r.peggiore && <Rilievo etichetta="Dove hai perso di più" stazione={r.peggiore} colore="text-orange-400" />}
            </div>
          )}
          {split.length > 0 && (
            <div>
              <p className={`${LABEL} mb-1`}>Split</p>
              <ol className="flex flex-col">
                {split.map((s, i) => (
                  <li key={i} className={`flex items-center justify-between py-1.5 text-sm border-t border-[#222] ${s.corsa ? 'text-gray-400' : 'text-white font-semibold'}`}>
                    <span>{s.nome}</span>
                    <span className="tabular-nums">{s.tempo}{s.posizione ? <span className="text-muted font-normal"> · {s.posizione}°</span> : null}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}

      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 text-xs text-muted hover:text-white">
          Risultato ufficiale <ExternalLink size={12} />
        </a>
      )}

      {stato === 'senza' && onAggiorna && (
        <button onClick={() => { vibraScelta(); onAggiorna() }}
          className="w-full py-3 bg-[#2a2a2a] text-white font-bold rounded-xl hover:bg-[#333] transition flex items-center justify-center gap-2">
          <RefreshCw size={16} /> Aggiungi le statistiche della gara
        </button>
      )}
    </div>
  )
}

function Rilievo({ etichetta, stazione, colore }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-[#111] rounded-xl px-3 py-2.5">
      <span className="min-w-0">
        <span className={`block ${LABEL}`}>{etichetta}</span>
        <span className="block text-white font-semibold truncate">{stazione.nome}</span>
      </span>
      <span className={`text-right shrink-0 tabular-nums font-bold ${colore}`}>
        {tempoCorto(stazione.tempo)}<span className="block text-xs font-medium text-muted">{stazione.pos}° posto</span>
      </span>
    </div>
  )
}
