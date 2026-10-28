import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { format, startOfMonth, endOfMonth, isSameDay, isSameMonth, isToday, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { useAuth } from '../App'
import { useRipresa, useRicorda } from '../useRipresa'
import NuovoEvento from '../components/NuovoEvento'
import FoglioSposta from '../components/FoglioSposta'
import { puoSpostare, spostaAssegnazione, avvisaCoachSpostamento, nomeAtleta } from '../lib/spostaAllenamento'
import { mostraErrore } from '../lib/alert'
import { vibraSuccesso } from '../lib/aptica'
import { categoriaDi } from '../lib/categorie'
import { metaWorkout } from '../lib/rigaArchivio'
import { rpeDichiarato } from '../lib/rpe'
import { leggiAttivitaPeriodo, vociLibere, candidatiAbbina, abbinaA } from '../lib/attivitaGarmin'
import {
  griglia, indicizzaPerGiorno, chiaveGiorno, segnoGiorno, riepilogoMese,
  riepilogoGiorno, etichettaSessione, etichettaGiorno, etichettaMese,
  eMeseCorrente, eEvento, etichettaCella, vociLegenda, celleSintesi,
} from '../lib/rigaCalendario'
import {
  TestataCalendario, CardMese, NavMese, LegendaCorsie, GrigliaMese, CellaGiorno,
  StrisciaMese, IntestazioneGiorno, RigaSessione, AggiungiGiorno, VuotoGiorno,
  ScheletroGiorno, RigaGarmin,
} from '../components/CalendarioUI'
import { useSchermoLargo, eDesktop } from '../useDesktop'

// Pigro: il foglio serve solo a chi tocca una voce Garmin, e porta con sé
// le righe e il foglio a scomparsa (~4 KB) che il calendario non usa.
const FoglioAttivitaGarmin = lazy(() => import('../components/FoglioAttivitaGarmin'))

// La settimana del team sul desktop (src/useDesktop.js): pigra, il telefono
// non la scarica mai.
const CalendarioTeam = lazy(() => import('./CalendarioTeam'))

export default function Calendar() {
  const navigate = useNavigate()
  const { role, user } = useAuth()
  const isAtleta = role === 'athlete'
  const desktop = eDesktop(useSchermoLargo(), role)
  // Sul desktop si apre la settimana del team; «Mese» riporta qui sotto.
  const [vistaMese, setVistaMese] = useState(false)
  // Tornando indietro da una scheda il calendario riprende mese, giorno scelto
  // e posizione (13/10/2026: «devo tornare a dove ero»), come archivio e
  // rubrica (src/useRipresa.js). Le date viaggiano come numeri: la memoria è
  // di modulo, ma un Date condiviso fra due montaggi è un invito a mutarlo.
  const ripresa = useRipresa('calendario', user?.id)
  const [currentMonth, setCurrentMonth] = useState(() => ripresa ? new Date(ripresa.mese) : new Date())
  const [workouts, setWorkouts] = useState(() => ripresa?.workouts ?? [])
  const [selectedDay, setSelectedDay] = useState(() => ripresa ? new Date(ripresa.giorno) : new Date())
  const [loading, setLoading] = useState(!ripresa)
  const [eventModalOpen, setEventModalOpen] = useState(false)
  // L'allenamento che l'atleta sta spostando a un altro giorno (FoglioSposta).
  const [daSpostare, setDaSpostare] = useState(null)
  // Le attività dell'orologio non abbinate a niente, del mese mostrato
  // (spec Garmin §3), e quella aperta nel foglio «Abbina a…».
  const [libere, setLibere] = useState([])
  const [attivitaAperta, setAttivitaAperta] = useState(null)
  useRicorda('calendario', user?.id, ripresa, {
    mese: currentMonth.getTime(), giorno: selectedDay.getTime(), workouts, caricato: !loading,
  })

  useEffect(() => {
    fetchWorkouts()
  }, [currentMonth])

  // Al ritorno il mese ripreso è già in pagina: la sua ricarica è silenziosa,
  // senza scheletro (che è corto e schiaccerebbe lo scorrimento in cima).
  const primoCaricamento = useRef(true)

  const fetchWorkouts = async () => {
    const silenziosa = ripresa && primoCaricamento.current
    primoCaricamento.current = false
    if (!silenziosa) setLoading(true)
    const from = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
    const to = format(endOfMonth(currentMonth), 'yyyy-MM-dd')

    if (role === 'athlete') {
      // ⚠️ `notes` serve all'RPE della riga, e arriva dall'ASSEGNAZIONE: è lì
      // che sta il marcatore `[RPE: n/10]`, non sul workout. Senza, la riga di
      // un allenamento chiuso non può dire com'è andato — che è l'unica cosa
      // per cui si riapre il calendario di ieri.
      // Le attività Garmin libere viaggiano con le assegnazioni: una lettura
      // per mese, e un errore vale come «nessuna» (leggiAttivitaPeriodo).
      const [{ data }, attivita] = await Promise.all([
        supabase
          .from('athlete_workouts')
          .select('id, completed_date, status, notes, workouts (id, title, date, sections)')
          .eq('athlete_id', user.id)
          .gte('completed_date', from)
          .lte('completed_date', to),
        leggiAttivitaPeriodo(supabase, user.id, from, to),
      ])
      setLibere(attivita)
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

  const legenda = useMemo(() => vociLegenda(workouts), [workouts])
  const celle = celleSintesi(sintesi, { soloCompletati: isAtleta })

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  const vaiAOggi = () => { const o = new Date(); setCurrentMonth(o); setSelectedDay(o) }

  const dataSelezionata = format(selectedDay, 'yyyy-MM-dd')
  // Solo l'atleta: il calendario del coach è la programmazione, non le
  // giornate di un atleta (le sue le vede nella scheda atleta).
  const vociGarmin = isAtleta ? vociLibere(libere, dataSelezionata) : []

  // «Abbina a…»: l'attività va su quell'assegnazione, che si completa. Poi si
  // ricarica il mese, come dopo un evento nuovo: la voce grigia sparisce e la
  // riga diventa «fatto».
  const abbina = async (awId) => {
    const { error } = await abbinaA(supabase, attivitaAperta, awId)
    if (error) {
      mostraErrore("Non sono riuscito ad abbinare l'attività. Controlla la connessione e riprova.")
      fetchWorkouts()
      return false
    }
    vibraSuccesso()
    fetchWorkouts()
    return true
  }

  // Sposta la SUA assegnazione (`aw_id`), non il workout: è condiviso con
  // gli altri atleti. Il calendario va al giorno nuovo, che è dove l'atleta
  // vuole vedere l'allenamento finire.
  const sposta = async (data) => {
    const w = daSpostare
    const { error } = await spostaAssegnazione(supabase, w.aw_id, data)
    if (error) {
      mostraErrore("Non sono riuscito a spostare l'allenamento. Controlla la connessione e riprova.")
      return false
    }
    setDaSpostare(null)
    vibraSuccesso()
    avvisaCoachSpostamento(supabase, {
      athleteName: nomeAtleta(user),
      workoutTitle: w.title, data,
      route: `/workout/${w.id}?athlete_id=${user.id}`,
    })
    const nuovo = parseISO(data)
    setSelectedDay(nuovo)
    if (isSameMonth(nuovo, currentMonth)) {
      setWorkouts(lista => lista.map(x => (x.aw_id === w.aw_id ? { ...x, date: data } : x)))
    } else {
      setCurrentMonth(nuovo)
    }
    return true
  }

  if (desktop && !vistaMese) {
    return (
      <Suspense fallback={<div className="min-h-screen" />}>
        <CalendarioTeam onVistaMese={() => setVistaMese(true)} />
      </Suspense>
    )
  }

  return (
    /* ⚠️ Niente `page-transition`: la pagina non sale più tutta insieme.
       `cascata` fa entrare i suoi figli uno dopo l'altro (src/index.css).
       Al ritorno da una scheda la pagina c'è già: niente cascata, come l'archivio. */
    <div className={`px-4 max-w-2xl mx-auto pb-[var(--fondo-pagina)] pt-[calc(env(safe-area-inset-top)+1rem)] ${ripresa ? 'ritorno-entra' : 'cascata'}`}>
      {desktop && (
        <button type="button" onClick={() => setVistaMese(false)}
          className="mb-3 h-9 px-3.5 rounded-xl border border-[#383838] text-gray-300 text-[13px] font-bold hover:text-white">
          ← Settimana del team
        </button>
      )}
      <TestataCalendario
        mese={etichettaMese(currentMonth)}
        anno={format(currentMonth, 'yyyy')}
        onCerca={() => navigate('/archive')}
        onNuovo={() => setEventModalOpen(true)}
      />

      <div className="mt-3.5">
        <CardMese onPrecedente={prevMonth} onSuccessivo={nextMonth}>
          <NavMese
            onPrecedente={prevMonth}
            onSuccessivo={nextMonth}
            onOggi={vaiAOggi}
            mostraOggi={!eMeseCorrente(currentMonth)}
          />
          <LegendaCorsie voci={legenda} />
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
          <StrisciaMese celle={celle} />
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
          {dayWorkouts.length === 0 && vociGarmin.length === 0 && <VuotoGiorno atleta={isAtleta} />}
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
                // Una gara non ha «da fare» né «fatto»: resta bianca (eEvento).
                stato={isAtleta && !eEvento(w) ? (w.status === 'completed' ? 'fatto' : 'da fare') : null}
                // ⚠️ All'atleta serve `athlete_id`: senza, la scheda non carica la SUA
                // assegnazione (nota, stato, RPE, tempo di gara) e mostra il workout
                // nudo (corretto il 13/10/2026). Il coach qui vede la programmazione.
                onApri={() => navigate(isAtleta ? `/workout/${w.id}?athlete_id=${user.id}` : `/workout/${w.id}`)}
                onSposta={isAtleta && w.aw_id && puoSpostare({ status: w.status, evento: eEvento(w) })
                  ? () => setDaSpostare(w) : undefined}
              />
            )
          })}
          {vociGarmin.map(v => (
            <RigaGarmin key={v.id} testo={v.testo} onApri={() => setAttivitaAperta(v.attivita)} />
          ))}
          {!isAtleta && (
            <AggiungiGiorno
              etichetta={`Aggiungi al ${format(selectedDay, 'd MMMM', { locale: it })}`}
              onClick={() => navigate(`/create?date=${dataSelezionata}`)}
            />
          )}
        </div>
      )}

      {daSpostare && (
        <FoglioSposta titolo={daSpostare.title} dataAttuale={daSpostare.date}
          onChiudi={() => setDaSpostare(null)} onConferma={sposta} />
      )}

      {attivitaAperta && (
        <Suspense fallback={null}>
        <FoglioAttivitaGarmin
          attivita={attivitaAperta}
          candidati={candidatiAbbina(workouts, String(attivitaAperta.giorno).slice(0, 10), libere)}
          onAbbina={abbina}
          onChiudi={() => setAttivitaAperta(null)} />
        </Suspense>
      )}

      {/* MODAL NUOVO EVENTO */}
      {eventModalOpen && createPortal(
        <NuovoEvento
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

