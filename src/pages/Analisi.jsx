// La pagina Analisi — solo versione desktop, solo coach
// (docs/superpowers/plans/2026-10-13-desktop-analisi-e-confronto.md, fase 1).
//
// Il Report dice «cosa fare questa settimana»; Analisi dice «come sta andando»
// su un periodo di settimane, per la squadra o per un atleta. Le due pagine
// stanno una accanto all'altra (decisione del committente, 13/10/2026).
//
// Nessuna colonna nuova, nessuna scrittura: due letture su tabelle esistenti.
// Il calcolo sta in `src/lib/analisi.js`, il disegno in `AnalisiUI.jsx` e nei
// grafici di `src/components/grafici/`; qui restano la rete e i filtri.
//
// ⚠️ I filtri vivono nell'URL (`?periodo=8&atleta=<id>&categoria=Hyrox`):
// si può tornare indietro col browser e mandare il link a sé stessi.

import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'
import { useSchermoLargo, eDesktop } from '../useDesktop'
import { COACHING_ID } from '../lib/constants'
import { BRAND, coloreCategoria } from '../lib/colori'
import {
  PERIODI, PERIODO_PREDEFINITO, CATEGORIE_ANALISI,
  settimaneDelPeriodo, periodoPrecedente, filtraRighe, numeriPeriodo, confrontoPeriodi,
  aderenzaPerSettimana, mappaAderenza, caricoPerCategoria, gradimentoPerSettimana, tabellaAnalisi,
} from '../lib/analisi'
import { ACWR_BASSO, ACWR_ALTO } from '../lib/reportSettimanale'
import {
  TestataAnalisi, NumeriAnalisi, Riquadro, TabellaAnalisi, ScheletroAnalisi,
} from '../components/AnalisiUI'
import { VuotoReport } from '../components/ReportUI'
import { CORSIA } from '../lib/categorie'
import Linea from '../components/grafici/Linea'
import BarreImpilate from '../components/grafici/BarreImpilate'
import Mappa from '../components/grafici/Mappa'
import Striscia from '../components/grafici/Striscia'
import StoricoEsercizio from '../components/StoricoEsercizio'
import { leggiEstratti } from '../lib/noteEstratte'

/** Righe per lettura: il massimo che Supabase restituisce di serie. */
export const PAGINA = 1000

const etichetta = (s) => format(s.inizio, 'd MMM', { locale: it })

/**
 * Tutte le assegnazioni fra due date, a pagine.
 * 🔴 Una lettura sola si ferma a mille righe SENZA dirlo: con dodici atleti e
 * ventisei settimane ci si arriva, e l'aderenza mostrata sarebbe più bassa del
 * vero. Si legge finché una pagina torna piena.
 */
async function leggiAssegnazioni(da, a) {
  const tutte = []
  for (let pagina = 0; ; pagina++) {
    const { data, error } = await supabase.from('athlete_workouts')
      .select('id, athlete_id, completed_date, status, notes, voice_note_url, workouts(id, title, sections)')
      .gte('completed_date', da).lte('completed_date', a)
      .order('completed_date', { ascending: true })
      .order('id', { ascending: true })
      .range(pagina * PAGINA, pagina * PAGINA + PAGINA - 1)
    if (error) return { data: null, error }
    tutte.push(...(data || []))
    if (!data || data.length < PAGINA) return { data: tutte, error: null }
  }
}

export default function Analisi() {
  const { role } = useAuth()
  const desktop = eDesktop(useSchermoLargo(), role)
  const navigate = useNavigate()
  const [parametri, setParametri] = useSearchParams()

  const periodo = PERIODI.includes(Number(parametri.get('periodo'))) ? Number(parametri.get('periodo')) : PERIODO_PREDEFINITO
  const categoria = CATEGORIE_ANALISI.includes(parametri.get('categoria')) ? parametri.get('categoria') : null
  const atletaId = parametri.get('atleta')

  const [atleti, setAtleti] = useState([])
  const [assegnazioni, setAssegnazioni] = useState([])
  const [stato, setStato] = useState('carico') // 'carico' | 'errore' | 'pronto'
  const [caricatoIl, setCaricatoIl] = useState(() => Date.now())

  useEffect(() => {
    if (!desktop) return
    let vivo = true
    const carica = async () => {
      setStato('carico')
      const adesso = new Date()
      // Il periodo, quello prima per il confronto (il cronico dell'ACWR ci
      // sta dentro: quattro settimane, e il periodo più corto è di quattro).
      const da = periodoPrecedente(periodo, adesso)[0].da
      const a = settimaneDelPeriodo(periodo, adesso).at(-1).a
      const [atletiRes, assRes] = await Promise.all([
        supabase.from('athletes').select('id, name, surname, photo_url, notes').is('deleted_at', null),
        leggiAssegnazioni(da, a),
      ])
      if (!vivo) return
      // ⚠️ Una lettura fallita non si inghiotte: senza righe la pagina
      // mostrerebbe una squadra ferma, che è un guasto travestito da dato.
      const guasto = atletiRes.error || assRes.error
      if (guasto) {
        console.error('Analisi, lettura fallita:', guasto)
        setStato('errore')
        return
      }
      // Il coach non è un atleta da seguire: stesso filtro del Report.
      setAtleti((atletiRes.data || []).filter(x => x?.id && x.id !== COACHING_ID))
      setAssegnazioni(assRes.data || [])
      setCaricatoIl(Date.now())
      setStato('pronto')
    }
    carica()
    return () => { vivo = false }
  }, [desktop, periodo])

  // I risultati che l'atleta ha scritto nelle note («Dalle note»), solo con un
  // atleta scelto: servono allo storico di un esercizio. Se la lettura fallisce
  // o la tabella non c'è, lo storico mostra la sola prescrizione.
  const [estratti, setEstratti] = useState({ di: null, dati: [] })
  useEffect(() => {
    if (!desktop || !atletaId) return
    let vivo = true
    leggiEstratti(atletaId).then(r => { if (vivo) setEstratti({ di: atletaId, dati: r.dati }) })
    return () => { vivo = false }
  }, [desktop, atletaId])

  const oggi = useMemo(() => new Date(caricatoIl), [caricatoIl])
  const settimane = useMemo(() => settimaneDelPeriodo(periodo, oggi), [periodo, oggi])
  const precedenti = useMemo(() => periodoPrecedente(periodo, oggi), [periodo, oggi])

  const scelto = atletaId ? atleti.find(a => a.id === atletaId) || null : null
  const visti = useMemo(() => (scelto ? [scelto] : atleti), [scelto, atleti])
  const righe = useMemo(
    () => filtraRighe(assegnazioni, { atletaId: scelto?.id, categoria, atleti }),
    [assegnazioni, scelto, categoria, atleti]
  )

  const analisi = useMemo(() => {
    const corrente = numeriPeriodo(visti, righe, settimane)
    const prima = numeriPeriodo(visti, righe, precedenti)
    const tabella = tabellaAnalisi(visti, righe, settimane)
    return {
      numeri: confrontoPeriodi(corrente, prima),
      aderenza: aderenzaPerSettimana(visti, righe, settimane),
      mappa: mappaAderenza(visti, righe, settimane),
      minuti: caricoPerCategoria(righe, settimane),
      gradimento: gradimentoPerSettimana(righe, settimane),
      tabella,
    }
  }, [visti, righe, settimane, precedenti])

  if (role === 'athlete') return <Navigate to="/" replace />
  if (!desktop) return <Navigate to="/report" replace />

  const cambia = (chiave, valore) => {
    const nuovi = new URLSearchParams(parametri)
    if (valore == null || valore === '') nuovi.delete(chiave)
    else nuovi.set(chiave, String(valore))
    setParametri(nuovi)
  }

  const categorieVisibili = categoria ? [categoria] : CATEGORIE_ANALISI
  const colonne = settimane.map(etichetta)
  const intervallo = `${format(settimane[0].inizio, 'd MMM', { locale: it })} – ${format(settimane.at(-1).fine, 'd MMM yyyy', { locale: it })}`
  const ordinati = [...analisi.tabella].sort((a, b) => a.nome.localeCompare(b.nome))

  return (
    <div className="px-8 max-w-[1400px] mx-auto pb-[var(--fondo-pagina)]">
      <TestataAnalisi
        titolo={scelto ? `${scelto.name} ${scelto.surname || ''}`.trim() : 'La squadra'}
        sottotitolo={`Ultime ${periodo} settimane · ${intervallo}`}
        periodi={PERIODI} periodo={periodo} onPeriodo={(p) => cambia('periodo', p === PERIODO_PREDEFINITO ? null : p)}
        categorie={CATEGORIE_ANALISI} categoria={categoria} onCategoria={(c) => cambia('categoria', c)}
        atleta={scelto} onTogliAtleta={() => cambia('atleta', null)}
        onApriScheda={() => scelto && navigate(`/athletes/${scelto.id}`)}
      />

      <div className="cascata flex flex-col gap-3">
        {stato === 'carico' ? <ScheletroAnalisi /> : stato === 'errore' ? (
          <VuotoReport
            titolo="Non sono riuscito a leggere gli allenamenti"
            dettaglio="Controlla la connessione e riprova: meglio nessun grafico che un grafico di una squadra ferma che ferma non è." />
        ) : atleti.length === 0 ? (
          <VuotoReport titolo="Nessun atleta in rubrica"
            dettaglio="L'analisi nasce dagli allenamenti che assegni: aggiungi un atleta per cominciare." />
        ) : (
          <>
            <NumeriAnalisi numeri={analisi.numeri} />

            <div className="grid grid-cols-12 gap-3">
              <Riquadro className="col-span-5" titolo="Aderenza per settimana"
                spiega="Allenamenti chiusi su quelli assegnati nei giorni già passati. Le settimane di pausa non contano.">
                <Linea titolo="Aderenza per settimana" colore={BRAND}
                  punti={analisi.aderenza.map((p, i) => ({ etichetta: colonne[i], valore: p.valore }))} />
              </Riquadro>
              <Riquadro className="col-span-7" titolo={scelto ? 'Le sue settimane' : 'Atleti × settimane'}
                spiega="Più è pieno il giallo, più allenamenti chiusi. Grigio: niente in programma. A righe: in pausa."
                legenda={null}>
                <Mappa colonne={colonne} onScegli={(id) => id && cambia('atleta', id)}
                  righe={analisi.mappa.map(r => ({ id: r.atleta.id, nome: r.atleta.nome, celle: r.celle }))} />
              </Riquadro>
            </div>

            <div className="grid grid-cols-12 gap-3">
              <Riquadro className="col-span-7" titolo="Minuti per categoria"
                spiega="Minuti degli allenamenti chiusi, settimana per settimana."
                legenda={categorieVisibili.map(c => ({ nome: CORSIA[c].etichetta, colore: coloreCategoria(c) }))}>
                <BarreImpilate titolo="Minuti per categoria"
                  colonne={analisi.minuti.map((m, i) => ({
                    etichetta: colonne[i],
                    parti: categorieVisibili.map(c => ({ nome: CORSIA[c].etichetta, valore: m[c], colore: coloreCategoria(c) })),
                  }))} />
              </Riquadro>
              <Riquadro className="col-span-5" titolo="Gradimento"
                spiega="Quota di «mi è piaciuto» fra chi ha risposto alla domanda del recap.">
                <Linea titolo="Gradimento" colore={BRAND}
                  punti={analisi.gradimento.map((p, i) => ({ etichetta: colonne[i], valore: p.valore }))} />
              </Riquadro>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Riquadro titolo="Carico: ACWR della settimana in corso"
                spiega={`La fascia chiara va da ${String(ACWR_BASSO).replace('.', ',')} a ${String(ACWR_ALTO).replace('.', ',')}: sopra si rischia, sotto si perde forma.`}>
                <Striscia titolo="ACWR per atleta" fascia={[ACWR_BASSO, ACWR_ALTO]} minimo={0} massimo={2.5}
                  voci={ordinati.map(r => ({ id: r.id, nome: r.nome, valore: r.acwr }))} />
              </Riquadro>
              <Riquadro titolo="RPE dichiarato contro previsto"
                spiega="Sopra lo zero l'atleta ha sentito gli allenamenti più duri di come li avevi pensati.">
                <Striscia titolo="Scarto RPE per atleta" fascia={[-1.5, 1.5]} minimo={-4} massimo={4}
                  formato={(v) => `${v > 0 ? '+' : ''}${String(v).replace('.', ',')}`}
                  voci={ordinati.map(r => ({ id: r.id, nome: r.nome, valore: r.scartoRpe }))} />
              </Riquadro>
            </div>

            {scelto && (
              <Riquadro titolo="Storico di un esercizio"
                spiega="Quello che hai prescritto, seduta per seduta, e quello che ha scritto nelle note.">
                <StoricoEsercizio righe={righe} estratti={estratti.di === scelto.id ? estratti.dati : []} />
              </Riquadro>
            )}

            <Riquadro titolo="Atleti" spiega="Clicca un atleta per vedere solo i suoi numeri. Clicca un'intestazione per ordinare.">
              <TabellaAnalisi righe={analisi.tabella} onScegli={(id) => cambia('atleta', id)} />
            </Riquadro>
          </>
        )}
      </div>
    </div>
  )
}
