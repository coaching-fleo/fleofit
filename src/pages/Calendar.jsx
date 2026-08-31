import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { X } from 'lucide-react'
import { format, startOfMonth, endOfMonth, isSameDay, isToday } from 'date-fns'
import { it } from 'date-fns/locale'
import { useAuth } from '../App'
import { CustomAlert } from '../components/CustomModals'
import CustomDatePicker from '../components/CustomDatePicker'
import { categoriaDi, corsia } from '../lib/categorie'
import { coloreCategoria } from '../lib/colori'
import { metaWorkout, conteggiPerCorsia } from '../lib/rigaArchivio'
import { rpeDichiarato } from '../lib/rpe'
import {
  griglia, indicizzaPerGiorno, chiaveGiorno, segnoGiorno, riepilogoMese,
  riepilogoGiorno, formattaVolume, etichettaSessione, etichettaGiorno,
  etichettaMese, eMeseCorrente,
} from '../lib/rigaCalendario'
import {
  TestataCalendario, CardMese, NavMese, LegendaCorsie, GrigliaMese, CellaGiorno,
  StrisciaMese, IntestazioneGiorno, RigaSessione, AggiungiGiorno, VuotoGiorno,
  ScheletroGiorno,
} from '../components/CalendarioUI'

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [workouts, setWorkouts] = useState([])
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const navigate = useNavigate()
  const { role, user } = useAuth()
  const isAtleta = role === 'athlete'

  useEffect(() => {
    fetchWorkouts()
  }, [currentMonth])

  const fetchWorkouts = async () => {
    setLoading(true)
    const from = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
    const to = format(endOfMonth(currentMonth), 'yyyy-MM-dd')

    if (role === 'athlete') {
      // ⚠️ `notes` serve all'RPE della riga, e arriva dall'ASSEGNAZIONE: è lì
      // che sta il marcatore `[RPE: n/10]`, non sul workout. Senza, la riga di
      // un allenamento chiuso non può dire com'è andato — che è l'unica cosa
      // per cui si riapre il calendario di ieri.
      const { data } = await supabase
        .from('athlete_workouts')
        .select('id, completed_date, status, notes, workouts (id, title, date, sections)')
        .eq('athlete_id', user.id)
        .gte('completed_date', from)
        .lte('completed_date', to)
      const mapped = (data || []).filter(aw => aw.workouts).map(aw => ({
        ...aw.workouts,
        aw_id: aw.id,
        status: aw.status,
        notes: aw.notes,
        date: aw.completed_date
      }))
      setWorkouts(mapped)
    } else {
      const { data } = await supabase
        .from('workouts')
        .select('id, title, date, sections')
        .gte('date', from)
        .lte('date', to)
      setWorkouts(data || [])
    }
    setLoading(false)
  }

  const { giorni, vuote } = useMemo(() => griglia(currentMonth), [currentMonth])
  const perGiorno = useMemo(() => indicizzaPerGiorno(workouts), [workouts])

  // I workout del giorno selezionato sono un valore DERIVATO, non uno stato:
  // erano tenuti in useState e riscritti da un effetto a ogni cambio di giorno,
  // il che significava un render in più e uno stato che poteva restare indietro.
  const dayWorkouts = useMemo(
    () => perGiorno.get(chiaveGiorno(selectedDay)) || [],
    [perGiorno, selectedDay]
  )

  // 🔴 `soloCompletati` tiene le prime due celle sullo STESSO orizzonte: per
  // l'atleta «14 di 18 fatti» e le ore di quei 14, per il coach «18
  // programmati» e le ore di quei 18. La sua query legge `workouts`, che non
  // ha nessuna colonna di stato: un «completati» per lui sarebbe sempre zero.
  const sintesi = useMemo(
    () => riepilogoMese(workouts, { soloCompletati: isAtleta }),
    [workouts, isAtleta]
  )

  const corsie = useMemo(() => conteggiPerCorsia(workouts), [workouts])

  // La legenda esiste solo per i colori che sono davvero nel mese, «Fatto»
  // compreso.
  //
  // ⚠️ La regola è sui DATI, non sul ruolo: la voce compare se qualcosa è
  // chiuso davvero. Un `isAtleta &&` in più qui sarebbe ridondante — la query
  // del coach legge `workouts`, che non ha nessuna colonna di stato, quindi
  // per lui il conteggio è zero comunque — e un guardiano che nessun caso può
  // giustificare è il modo in cui la regola vera smette di essere leggibile
  // (§9-quinquies, sul controllo di bordo tolto da `faseMoveUp`).
  const vociLegenda = useMemo(() => {
    const voci = corsie.map(({ categoria }) => ({
      chiave: categoria,
      etichetta: corsia(categoria).etichetta,
      colore: coloreCategoria(categoria),
    }))
    if (sintesi.completati > 0) {
      voci.push({ chiave: 'fatto', etichetta: 'Fatto', colore: '#22c55e' })
    }
    return voci
  }, [corsie, sintesi.completati])

  const volume = formattaVolume(sintesi.minuti, sintesi.ignote, sintesi.misurate)

  const celleSintesi = [
    isAtleta
      ? { etichetta: 'Completati', valore: String(sintesi.completati), suffisso: `/${sintesi.totale}` }
      : { etichetta: 'Programmati', valore: String(sintesi.totale) },
    { etichetta: 'Volume', valore: volume.valore, suffisso: volume.unita },
    sintesi.gara
      ? { etichetta: 'Gara', valore: sintesi.gara.giorno, evidenzia: true }
      : { etichetta: 'Gara', valore: '—' },
  ]

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  const vaiAOggi = () => { const o = new Date(); setCurrentMonth(o); setSelectedDay(o) }

  const dataSelezionata = format(selectedDay, 'yyyy-MM-dd')

  return (
    <div className="px-4 max-w-2xl mx-auto pb-[var(--fondo-pagina)] pt-[calc(env(safe-area-inset-top)+1rem)] page-transition">
      <TestataCalendario
        mese={etichettaMese(currentMonth)}
        anno={format(currentMonth, 'yyyy')}
        onCerca={() => navigate('/archive')}
        onNuovo={() => setEventModalOpen(true)}
      />

      <div className="mt-3.5">
        <CardMese>
          <NavMese
            onPrecedente={prevMonth}
            onSuccessivo={nextMonth}
            onOggi={vaiAOggi}
            mostraOggi={!eMeseCorrente(currentMonth)}
          />
          <LegendaCorsie voci={vociLegenda} />
          <GrigliaMese
            vuote={vuote}
            celle={giorni.map(giorno => {
              const lista = perGiorno.get(chiaveGiorno(giorno)) || []
              const segno = segnoGiorno(lista)
              return (
                <CellaGiorno
                  key={giorno.toISOString()}
                  numero={format(giorno, 'd')}
                  segno={segno}
                  selezionato={isSameDay(giorno, selectedDay)}
                  oggi={isToday(giorno)}
                  etichetta={etichettaCella(giorno, segno, lista)}
                  onClick={() => setSelectedDay(giorno)}
                />
              )
            })}
          />
          <StrisciaMese celle={celleSintesi} />
        </CardMese>
      </div>

      <IntestazioneGiorno
        data={etichettaGiorno(selectedDay)}
        riepilogo={loading ? '' : riepilogoGiorno(dayWorkouts)}
      />

      {loading ? (
        <ScheletroGiorno />
      ) : (
        <div className="flex flex-col gap-2.5">
          {dayWorkouts.length === 0 && <VuotoGiorno atleta={isAtleta} />}
          {dayWorkouts.map(w => {
            const categoria = categoriaDi(w.sections)
            // 🔴 L'RPE si legge con `rpeDichiarato`, non con `parseNotesAndRpe`:
            // il secondo torna 5 quando il marcatore non c'è, ed è il valore
            // giusto per il cursore della modale ma un numero inventato per
            // chiunque lo mostri come un dato (§9-octies).
            const rpe = w.status === 'completed' ? rpeDichiarato(w.notes) : null
            const meta = [metaWorkout(w, { giorno: false }), rpe !== null ? `RPE ${rpe}` : null]
              .filter(Boolean).join(' · ')
            return (
              <RigaSessione
                key={w.aw_id || w.id}
                categoria={categoria}
                etichetta={etichettaSessione(w)}
                titolo={w.title || 'Senza titolo'}
                meta={meta}
                stato={isAtleta ? (w.status === 'completed' ? 'fatto' : 'da fare') : null}
                onApri={() => navigate(`/workout/${w.id}`)}
              />
            )
          })}
          {!isAtleta && (
            <AggiungiGiorno
              etichetta={`Aggiungi al ${format(selectedDay, 'd MMMM', { locale: it })}`}
              onClick={() => navigate(`/create?date=${dataSelezionata}`)}
            />
          )}
        </div>
      )}

      {/* MODAL NUOVO EVENTO */}
      {eventModalOpen && createPortal(
        <EventModal
          athleteId={user.id}
          dataIniziale={dataSelezionata}
          onClose={() => setEventModalOpen(false)}
          onSaved={() => {
            setEventModalOpen(false);
            fetchWorkouts()
          }}
        />,
        document.body
      )}
    </div>
  )
}

/**
 * Cosa dice una cella a chi la legge con VoiceOver.
 *
 * ⚠️ Porta il numero VERO delle sessioni, non quello dei segmenti disegnati:
 * la barra si ferma a `MASSIMO_SEGMENTI`, e senza questa riga un giorno con
 * cinque allenamenti e uno con tre sarebbero indistinguibili anche a chi la
 * barra non la vede affatto.
 */
function etichettaCella(giorno, segno, lista) {
  const data = format(giorno, 'd MMMM', { locale: it })
  if (segno.n === 0) return `${data}, nessun allenamento`
  const fatti = lista.filter(w => w.status === 'completed').length
  const parti = [`${segno.n} ${segno.n === 1 ? 'allenamento' : 'allenamenti'}`]
  if (fatti > 0) parti.push(`${fatti} ${fatti === 1 ? 'completato' : 'completati'}`)
  return `${data}, ${parti.join(', ')}`
}

function EventModal({ athleteId, dataIniziale, onClose, onSaved }) {
  const [title, setTitle] = useState('')
  // La data parte da quella SELEZIONATA nel calendario, non da oggi: si apre
  // questa modale dopo aver scelto un giorno, e ripartire da oggi obbligava a
  // rifare la scelta appena fatta.
  const [date, setDate] = useState(dataIniziale || format(new Date(), 'yyyy-MM-dd'))
  const [saving, setSaving] = useState(false)
  const [alertInfo, setAlertInfo] = useState(null)

  const handleSave = async () => {
    if (!title || !date) return setAlertInfo({ title: 'Errore', message: 'Titolo e data obbligatori', type: 'error' })
    setSaving(true)
    const { data: newW, error: wError } = await supabase.from('workouts').insert({
      title,
      date,
      sections: { category: 'Event', isEvent: true, isAutonomous: true }
    }).select().single()
    if (wError) { setSaving(false); return setAlertInfo({ title: 'Errore', message: wError.message, type: 'error' }) }
    const { error: awError } = await supabase.from('athlete_workouts').insert({
      athlete_id: athleteId, workout_id: newW.id, completed_date: date, status: 'pending'
    })
    setSaving(false)
    if (awError) return setAlertInfo({ title: 'Errore', message: awError.message, type: 'error' })
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-sm flex flex-col border border-[#333] shadow-2xl modal-transition">
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
          <p className="text-white font-bold text-lg">Nuovo Evento / Gara</p>
          <button aria-label="Chiudi" onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="text-gray-400 text-xs pl-1 mb-1 block">Nome Evento *</label>
            <input type="text" placeholder="Es. Maratona di Roma" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-white text-base" />
          </div>
          <div>
            <label className="text-gray-400 text-xs pl-1 mb-1 block">Data *</label>
            <CustomDatePicker date={date} onChange={setDate} className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 hover:border-white w-full text-base" />
          </div>
          <button onClick={handleSave} disabled={saving || !title} className="w-full mt-2 py-3.5 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition disabled:opacity-50">
            {saving ? 'Salvataggio...' : 'Aggiungi al Calendario'}
          </button>
        </div>
      </div>
      {alertInfo && <CustomAlert info={alertInfo} onClose={() => setAlertInfo(null)} />}
    </div>
  )
}
