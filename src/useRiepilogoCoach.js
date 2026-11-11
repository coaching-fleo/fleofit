// useRiepilogoCoach — i conti e le liste della Home «Riepilogo» (10/11/2026).
//
// Uno solo per le due disposizioni (telefono e desktop): stessi numeri, stesse
// liste dietro ogni numero, stesse destinazioni al tocco. Come useCruscottoCoach,
// lo importano SOLO i pezzi pigri (HomeRiepilogoTelefono/Desktop): si porta
// dietro le regole di «Dalle note» e non deve finire nel chunk d'ingresso.

import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { useCruscottoCoach } from './useCruscottoCoach'
import { corsia } from './lib/categorie'
import { oggiPerStato, oggiPerCategoria, ordinaOggi, giorniDaProgrammare, scopertiTreGiorni, CATEGORIE_RIEPILOGO } from './lib/riepilogoCoach'

const PILLOLA_OGGI = (r) => (
  r.allarme ? { testo: 'Sta male', tono: 'male' }
    : r.stato === 'in corso' ? { testo: 'In corso', tono: 'vivo' }
      : r.stato === 'completato' ? { testo: r.rpe != null ? `RPE ${r.rpe}` : 'Fatto', tono: 'ok' }
        : { testo: 'Da fare', tono: 'neutro' }
)
const giornoBreve = (d) => format(parseISO(d), 'EEE d', { locale: it })
const senzaNome = (frase, nome) => (frase || '').replace(`${nome}: `, '').replace(`${nome} `, '')

/** Un filtro per ogni categoria presente fra le persone. */
const filtriCategorie = (persone) => [...CATEGORIE_RIEPILOGO, 'Event']
  .filter(c => persone.some(p => p.categoria === c))
  .map(c => ({ etichetta: corsia(c).etichetta, prova: (p) => p.categoria === c }))

export function useRiepilogoCoach({
  atleti, assegnazioni, comeStai, estratti, righeGare, squadra, copertura,
  feedback = [], fermi = [], scaduti = [],
  onApriAtleta, onApriFeedback, onApriScaduto, onApriSeduta, onCrea,
}) {
  const cruscotto = useCruscottoCoach({ atleti, assegnazioni, comeStai, estratti, righeGare, squadra, copertura, settimana: false })
  const { oggi, piano, segnali } = cruscotto

  const conti = useMemo(() => {
    const ordinate = ordinaOggi(oggi)
    return {
      ordinate,
      stati: oggiPerStato(oggi),
      perCategoria: oggiPerCategoria(oggi),
      allarmi: ordinate.filter(r => r.allarme),
      giorni: giorniDaProgrammare(piano),
      scoperti: scopertiTreGiorni(piano),
    }
  }, [oggi, piano])

  // `squadraDelGiorno` porta solo il nome proprio (è l'etichetta sotto una foto):
  // nelle liste serve il nome intero, per cercare anche per cognome e per
  // distinguere due «Marco».
  const nomeIntero = useMemo(() => {
    const m = new Map((atleti || []).map(a => [a.id, [a.name, a.surname].filter(Boolean).join(' ').trim()]))
    return (r) => m.get(r.id) || r.nome
  }, [atleti])

  const [lista, setLista] = useState(null)

  /** Cosa mostra il foglio, e dove porta il tocco su una riga. */
  const foglio = useMemo(() => {
    if (!lista) return null
    const seduta = (p) => onApriSeduta({ workoutId: p.workoutId, atletaId: p.atletaId })
    switch (lista.tipo) {
      case 'oggi': {
        const persone = conti.ordinate.map(r => ({
          chiave: `${r.id}-${r.workoutId}`, nome: nomeIntero(r), foto: r.foto, sotto: r.titolo, categoria: r.categoria,
          stato: r.stato, pillola: PILLOLA_OGGI(r), workoutId: r.workoutId, atletaId: r.id,
        }))
        const filtri = [
          { etichetta: 'Tutti', prova: null },
          { etichetta: 'Da fare', prova: p => p.stato === 'da fare' },
          { etichetta: 'In corso', prova: p => p.stato === 'in corso' },
          { etichetta: 'Fatto', prova: p => p.stato === 'completato' },
          ...filtriCategorie(persone),
        ]
        const iniziale = { 'da fare': 1, 'in corso': 2, fatto: 3 }[lista.filtro] || 0
        return { titolo: 'In allenamento oggi', persone, filtri, filtroIniziale: iniziale, onScegli: seduta }
      }
      case 'allarmi':
        return {
          titolo: 'Stanno male oggi',
          persone: conti.allarmi.map(r => ({ chiave: `${r.id}-${r.workoutId}`, nome: nomeIntero(r), foto: r.foto, categoria: r.categoria,
            sotto: r.motivi.join(' · '), pillola: { testo: `Intensità ${r.intensita}`, tono: 'male' }, workoutId: r.workoutId, atletaId: r.id })),
          onScegli: seduta,
        }
      case 'feedback': {
        const persone = feedback.map(f => ({ chiave: f.id, nome: f.nome, foto: f.foto, categoria: f.categoria,
          sotto: `${f.titolo} · ${f.quando}`, dato: f }))
        return { titolo: 'Feedback da leggere', persone, filtri: [{ etichetta: 'Tutti', prova: null }, ...filtriCategorie(persone)],
          onScegli: (p) => onApriFeedback(p.dato) }
      }
      case 'scoperti': {
        const giorniScoperti = [...new Set(conti.scoperti.flatMap(r => r.scoperti))].sort()
        return {
          titolo: 'Da programmare',
          persone: conti.scoperti.map(r => ({ chiave: r.id, nome: r.nome, foto: r.foto, scoperti: r.scoperti,
            sotto: `Scoperto: ${r.scoperti.map(giornoBreve).join(', ')}`, atletaId: r.id, data: r.primoScoperto })),
          filtri: [{ etichetta: 'Tutti', prova: null },
            ...giorniScoperti.map(d => ({ etichetta: giornoBreve(d), prova: p => p.scoperti.includes(d) }))],
          onScegli: (p) => onCrea({ atletaId: p.atletaId, data: p.data }),
        }
      }
      case 'giorno': {
        const g = conti.giorni.find(x => x.data === lista.data)
        if (!g) return null
        const programmati = g.programmati.map(r => {
          const chip = r.celle.find(c => c.data === g.data)?.chips[0]
          return { chiave: `p-${r.id}`, nome: r.nome, foto: r.foto, categoria: chip?.categoria,
            sotto: chip?.titolo || 'Programmato', programmato: true, workoutId: chip?.workoutId, atletaId: r.id }
        })
        const vuoti = g.daProgrammare.map(r => ({ chiave: `v-${r.id}`, nome: r.nome, foto: r.foto, sotto: 'Niente in programma',
          pillola: { testo: 'Programma', tono: 'vivo' }, programmato: false, atletaId: r.id }))
        const titolo = g.oggi ? 'Oggi' : giornoBreve(g.data)
        return {
          titolo: titolo.charAt(0).toUpperCase() + titolo.slice(1),
          persone: [...vuoti, ...programmati],
          filtri: [{ etichetta: 'Da programmare', prova: p => !p.programmato }, { etichetta: 'Programmati', prova: p => p.programmato },
            { etichetta: 'Tutti', prova: null }],
          filtroIniziale: g.oggi || vuoti.length === 0 ? 1 : 0,
          onScegli: (p) => (p.programmato ? seduta(p) : onCrea({ atletaId: p.atletaId, data: g.data })),
        }
      }
      case 'fermi':
        return {
          titolo: 'Fermi da 5+ giorni',
          persone: fermi.map(f => ({ chiave: f.id, nome: f.nome, foto: f.foto,
            sotto: f.oltre ? 'Nessun allenamento completato di recente' : `Nessun allenamento da ${f.giorni} giorni`, dato: f })),
          onScegli: (p) => onApriAtleta(p.dato),
        }
      case 'scaduti':
        return {
          titolo: 'Allenamenti scaduti',
          persone: scaduti.map(s => ({ chiave: s.id, nome: s.nome, categoria: s.categoria, sotto: `${s.titolo} · ${s.quando}`, dato: s })),
          onScegli: (p) => onApriScaduto(p.dato),
        }
      case 'segnali':
        return {
          titolo: 'Da rivedere nel programma',
          persone: segnali.map(s => ({ chiave: s.chiave, nome: s.nome, foto: s.foto, sotto: senzaNome(s.frase, s.nome), atletaId: s.atletaId })),
          onScegli: (p) => onApriAtleta({ id: p.atletaId }),
        }
      default: return null
    }
  }, [lista, conti, nomeIntero, feedback, fermi, scaduti, segnali, onApriAtleta, onApriFeedback, onApriScaduto, onApriSeduta, onCrea])

  // La nota sopra il calendario conta come la card «Da programmare» (chi ha
  // almeno un giorno vuoto nei prossimi 3), non come la copertura della Home
  // classica (chi non ha NIENTE): due conti diversi a un palmo dicevano
  // «8 da programmare» e «tutti programmati» insieme.
  const n = conti.scoperti.length
  const notaCalendario = !piano?.righe?.length ? null : n > 0
    ? { avviso: true, testo: `${n} ${n === 1 ? 'atleta' : 'atleti'} con giorni da programmare nei prossimi 3 giorni` }
    : { avviso: false, testo: 'Tutti programmati per i prossimi 3 giorni' }

  return { ...cruscotto, ...conti, notaCalendario, apri: setLista, chiudi: () => setLista(null), foglio }
}
