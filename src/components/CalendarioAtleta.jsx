import { useMemo, useState } from 'react'
import { format, isSameDay, isSameMonth, isToday } from 'date-fns'
import { it } from 'date-fns/locale'
import { categoriaDi } from '../lib/categorie'
import { metaWorkout, dataValida } from '../lib/rigaArchivio'
import { rpeDichiarato } from '../lib/rpe'
import {
  griglia, indicizzaPerGiorno, chiaveGiorno, segnoGiorno, riepilogoMese,
  riepilogoGiorno, etichettaSessione, etichettaGiorno, etichettaMese,
  eMeseCorrente, eEvento, etichettaCella, vociLegenda, celleSintesi,
} from '../lib/rigaCalendario'
import {
  CardMese, NavMese, LegendaCorsie, GrigliaMese, CellaGiorno, StrisciaMese,
  IntestazioneGiorno, RigaSessione, AggiungiGiorno, VuotoGiorno,
} from './CalendarioUI'
import { CalendarDays } from 'lucide-react'
import { RigaApribile } from './SchedaAtletaUI'

/**
 * Il calendario di UN atleta, nella sua scheda (27/10/2026).
 *
 * Prima c'era, ma dentro «Storico allenamenti» (chiuso sul telefono) e dietro
 * un selettore Elenco/Calendario, ancora coi pallini di prima del rework: il
 * committente non l'aveva mai trovato. Ora è una sezione sua, con gli stessi
 * pezzi della pagina Calendario (src/components/CalendarioUI.jsx).
 *
 * ⚠️ Nessuna lettura propria: `assegnazioni` è lo storico che la scheda ha già
 * caricato, righe di `athlete_workouts` col workout annidato. Qui si traducono
 * nella forma della pagina Calendario dell'atleta — il workout, più `aw_id`,
 * `status`, `notes` e la data dell'ASSEGNAZIONE — così i calcoli sono gli
 * stessi e non una seconda copia.
 *
 * Parte CHIUSO, come le righe dello storico e dei record (27/10/2026, il
 * committente: «non lo voglio sempre aperto, si apre a tendina»). Il mese
 * scelto resta mentre si chiude e si riapre: lo stato vive qui, non nel figlio.
 * La riga porta il mese mostrato, così si sa cosa c'è dentro prima di aprirla.
 *
 * 🔴 Qui lo stato c'è, a differenza del calendario del coach: la fascia conta
 * i completati e le righe dicono «da fare» / «fatto», come per l'atleta.
 */
export default function CalendarioAtleta({ nome, assegnazioni = [], onApri, onAssegna }) {
  const [aperto, setAperto] = useState(false)
  const [mese, setMese] = useState(() => new Date())
  const [giornoScelto, setGiornoScelto] = useState(() => new Date())

  const tutti = useMemo(() => assegnazioni
    .filter(aw => aw?.workouts)
    .map(aw => ({ ...aw.workouts, aw_id: aw.id, status: aw.status, notes: aw.notes, date: aw.completed_date })),
  [assegnazioni])

  const delMese = useMemo(
    () => tutti.filter(w => { const d = dataValida(w.date); return d && isSameMonth(d, mese) }),
    [tutti, mese])

  const { giorni, vuote } = useMemo(() => griglia(mese), [mese])
  const perGiorno = useMemo(() => indicizzaPerGiorno(delMese), [delMese])
  const delGiorno = perGiorno.get(chiaveGiorno(giornoScelto)) || []
  const legenda = useMemo(() => vociLegenda(delMese), [delMese])
  const celle = celleSintesi(riepilogoMese(delMese, { soloCompletati: true }), { soloCompletati: true })

  const cambiaMese = (scarto) => setMese(m => new Date(m.getFullYear(), m.getMonth() + scarto))
  const vaiAOggi = () => { const o = new Date(); setMese(o); setGiornoScelto(o) }

  return (
    <section aria-label={nome ? `Calendario di ${nome}` : 'Calendario'} className="flex flex-col gap-2.5">
      <RigaApribile
        icona={CalendarDays} titolo="Calendario" conteggio={`${etichettaMese(mese)} ${format(mese, 'yyyy')}`}
        aperta={aperto} onToggle={() => setAperto(v => !v)} />
      {aperto && (<>
        <CardMese onPrecedente={() => cambiaMese(-1)} onSuccessivo={() => cambiaMese(1)}>
          <NavMese
            onPrecedente={() => cambiaMese(-1)}
            onSuccessivo={() => cambiaMese(1)}
            onOggi={vaiAOggi}
            mostraOggi={!eMeseCorrente(mese)}
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
                  selezionato={isSameDay(giorno, giornoScelto)}
                  oggi={isToday(giorno)}
                  etichetta={etichettaCella(giorno, segno, lista)}
                  onClick={() => setGiornoScelto(giorno)}
                />
              )
            })}
          />
          <StrisciaMese celle={celle} />
        </CardMese>

        <IntestazioneGiorno data={etichettaGiorno(giornoScelto)} riepilogo={riepilogoGiorno(delGiorno)} />
        <div className="flex flex-col gap-2.5">
          {delGiorno.length === 0 && <VuotoGiorno atleta={false} />}
          {delGiorno.map(w => {
            // 🔴 `rpeDichiarato`, non `parseNotesAndRpe`: il secondo torna 5
            // quando il marcatore manca (§9-octies).
            const rpe = w.status === 'completed' ? rpeDichiarato(w.notes) : null
            const meta = [metaWorkout(w, { giorno: false }), rpe !== null ? `RPE ${rpe}` : null]
              .filter(Boolean).join(' · ')
            return (
              <RigaSessione
                key={w.aw_id}
                categoria={categoriaDi(w.sections)}
                etichetta={etichettaSessione(w)}
                titolo={w.title || 'Senza titolo'}
                meta={meta}
                // Una gara non ha «da fare» né «fatto»: resta bianca (eEvento).
                stato={eEvento(w) ? null : (w.status === 'completed' ? 'fatto' : 'da fare')}
                onApri={() => onApri(w.id)}
              />
            )
          })}
          <AggiungiGiorno
            etichetta={`Assegna il ${format(giornoScelto, 'd MMMM', { locale: it })}`}
            onClick={() => onAssegna(chiaveGiorno(giornoScelto))}
          />
        </div>
      </>)}
    </section>
  )
}
