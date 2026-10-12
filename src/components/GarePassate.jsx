import { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { supabase } from '../supabaseClient'
import CustomDatePicker from './CustomDatePicker'
import { RicercaTempo } from './RisultatoGara'
import { vibraScelta, vibraSuccesso } from '../lib/aptica'
import { CARD, LABEL } from '../lib/stiliCard'
import {
  elencoGarePassate, cercaGarePassate, perStagione, cercaInGara, giaImportata, salvaGaraPassata,
  giornoSettimana, tempoCorto, divisioneCorta,
} from '../lib/risultatoGara'

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']

/** «25/26» → «2025/26». */
const stagioneLunga = (e) => (/^\d{2}\/\d{2}$/.test(e || '') ? `20${e}` : e)

/**
 * «Gara già corsa», dentro «Nuovo evento» del calendario (NuovoEvento.jsx):
 * i tempi delle gare HYROX corse prima di usare l'app. Fino al 12/10/2026 si
 * apriva dai Personal record; il committente l'ha voluta nel calendario.
 * Si sceglie la gara da un elenco di tutte le stagioni (results.hyrox.com,
 * Edge Function `risultato-hyrox`), l'app cerca il nome lì e chiede conferma,
 * poi il GIORNO — che il sito non dà — e salva un evento già chiuso nel
 * calendario più il record personale. Storia in docs/memoria/calendario.md.
 */
export default function GarePassate({ athleteId, onSalvato }) {
  const [gare, setGare] = useState(null)
  const [erroreElenco, setErroreElenco] = useState(null)
  const [ricerca, setRicerca] = useState('')
  const [gara, setGara] = useState(null)
  const [risultato, setRisultato] = useState(null)
  const [giorno, setGiorno] = useState('')
  const [esistente, setEsistente] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState('')
  const [salvate, setSalvate] = useState([])

  useEffect(() => {
    let vivo = true
    elencoGarePassate(supabase).then(({ gare, errore }) => {
      if (!vivo) return
      setGare(gare)
      setErroreElenco(errore)
    })
    return () => { vivo = false }
  }, [])

  const stagioni = useMemo(() => perStagione(cercaGarePassate(gare || [], ricerca)), [gare, ricerca])

  const scegli = (g) => {
    vibraScelta()
    setGara(g)
    setRisultato(null)
    setGiorno('')
    setErrore('')
    setEsistente(null)
    giaImportata(supabase, { athleteId, gara: g }).then(setEsistente).catch(() => {})
  }

  const indietro = () => {
    setGara(null)
    setRisultato(null)
  }

  const cerca = useCallback(
    (chi) => cercaInGara(supabase, { gruppo: gara.gruppo, stagione: gara.stagione, ...chi }),
    [gara],
  )

  const giornoGara = risultato ? giornoSettimana(risultato.divisione) : null
  const avviso = useMemo(() => {
    if (!giorno || !gara) return ''
    const d = parseISO(giorno)
    if (giorno.slice(0, 4) !== gara.anno) return `La gara è del ${gara.anno}: controlla l'anno.`
    if (giornoGara != null && d.getDay() !== giornoGara) return `Dai risultati hai corso di ${GIORNI[giornoGara]}, e ${[8, 11].includes(d.getDate()) ? 'l’' : 'il '}${format(d, 'd MMMM', { locale: it })} è ${GIORNI[d.getDay()]}.`
    return ''
  }, [giorno, gara, giornoGara])

  const salva = async () => {
    setSalvando(true)
    setErrore('')
    try {
      await salvaGaraPassata(supabase, { athleteId, gara, giorno, risultato })
      vibraSuccesso()
      setSalvate(v => [...v, { gara, tempo: tempoCorto(risultato.tempo) }])
      setGara(null)
      setRisultato(null)
      onSalvato?.()
    } catch (e) {
      console.error('Salvataggio della gara passata:', e)
      setErrore('Non sono riuscito a salvare la gara. Riprova.')
    } finally {
      setSalvando(false)
    }
  }

  return (
      <div className="flex flex-col gap-4">
        {salvate.length > 0 && !gara && (
          <div className={`${CARD} p-4 flex flex-col gap-2`}>
            <p className={LABEL}>Aggiunte adesso</p>
            {salvate.map((x, i) => (
              <p key={i} className="flex items-center gap-2 text-sm text-white">
                <Check size={16} className="text-green-500 shrink-0" />
                <span className="font-semibold">{x.gara.citta} {x.gara.anno}</span>
                <span className="text-gray-400 tabular-nums">{x.tempo}</span>
              </p>
            ))}
          </div>
        )}

        {!gara && (
          <>
            <p className="text-sm text-gray-400 leading-relaxed px-1">
              Scegli una gara che hai già corso: cerchiamo il tuo nome fra i risultati ufficiali, e il tempo finisce nei tuoi record e nel calendario.
            </p>
            {gare === null ? (
              <div className="flex flex-col gap-2" aria-label="Caricamento gare">
                {[0, 1, 2, 3].map(i => <div key={i} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl h-14 animate-pulse" />)}
              </div>
            ) : erroreElenco ? (
              <div className="border border-dashed border-[#333] rounded-3xl p-6 text-center">
                <p className="text-sm text-gray-400">{erroreElenco}</p>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input type="search" placeholder="Città o anno" value={ricerca} onChange={e => setRicerca(e.target.value)}
                    aria-label="Cerca una gara passata"
                    className="w-full bg-[#111] border border-[#333] text-white pl-11 pr-4 py-3 rounded-xl focus:outline-none focus:border-brand text-base" />
                </div>
                {stagioni.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-10">Nessuna gara trovata 🤷</p>
                ) : stagioni.map(st => (
                  <section key={st.stagione} aria-label={`Stagione ${stagioneLunga(st.etichetta)}`} className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between px-1">
                      <p className={LABEL}>Stagione {stagioneLunga(st.etichetta)}</p>
                      <p className="text-[11px] font-semibold text-muted">{st.gare.length} {st.gare.length === 1 ? 'gara' : 'gare'}</p>
                    </div>
                    <ul className="flex flex-col gap-1.5">
                      {st.gare.map(g => (
                        <li key={`${g.stagione}-${g.gruppo}`}>
                          <button onClick={() => scegli(g)} aria-label={`${g.citta} ${g.anno}`}
                            className="w-full text-left bg-[#161616] border border-[#2a2a2a] hover:border-brand rounded-2xl px-4 py-3 flex items-center gap-3 transition">
                            <span className="text-[11px] font-black tabular-nums text-brand w-10 shrink-0">{g.anno}</span>
                            <span className="flex-1 min-w-0 text-white font-semibold truncate">{g.citta}</span>
                            <ChevronRight size={17} className="text-[#5b6070] shrink-0" aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </>
            )}
          </>
        )}

        {gara && (
          <>
            <button onClick={indietro} className="self-start flex items-center gap-1 text-sm text-gray-400 hover:text-white">
              <ChevronLeft size={16} /> Tutte le gare
            </button>

            {!risultato ? (
              <div className={`${CARD} p-5`}>
                <RicercaTempo key={`${gara.stagione}-${gara.gruppo}`} athleteId={athleteId} citta={`${gara.citta} ${gara.anno}`}
                  etichetta={`Stagione ${stagioneLunga(gara.etichetta)}`} cerca={cerca}
                  onConferma={async (r) => { setRisultato(r); setGiorno('') }} />
                {esistente && (
                  <p className="mt-4 text-sm text-gray-400">
                    È già nei tuoi record ({esistente.value}): confermando lo aggiorni.
                  </p>
                )}
              </div>
            ) : (
              <div className={`${CARD} p-5 flex flex-col gap-4`}>
                <div>
                  <p className={LABEL}>HYROX {gara.citta} {gara.anno}</p>
                  <p className="mt-1.5 text-[40px] font-black tracking-[-.04em] text-white leading-none tabular-nums">{tempoCorto(risultato.tempo)}</p>
                  {risultato.divisione && <p className="mt-1.5 text-sm text-gray-300">{divisioneCorta(risultato.divisione)}</p>}
                </div>
                <div>
                  <p className="text-white font-bold">In che giorno era?</p>
                  <p className="text-sm text-gray-400 mt-0.5">
                    Il sito dei risultati non dà la data della gara.
                    {giornoGara != null && ` Hai corso di ${GIORNI[giornoGara]}.`}
                  </p>
                </div>
                <CustomDatePicker date={giorno} onChange={setGiorno} meseIniziale={`${gara.anno}-01-01`}
                  placeholder="Scegli il giorno della gara"
                  className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 hover:border-brand w-full text-base" />
                {avviso && <p className="text-sm text-orange-400">{avviso}</p>}
                <button onClick={salva} disabled={salvando || !giorno}
                  className="w-full py-3.5 bg-brand text-black font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50">
                  {salvando ? 'Salvataggio...' : 'Salva la gara'}
                </button>
                <button onClick={() => setRisultato(null)} className="text-sm text-gray-400 hover:text-white">
                  Torna al risultato
                </button>
                {errore && <p className="text-sm text-red-400">{errore}</p>}
              </div>
            )}
          </>
        )}
      </div>
  )
}
