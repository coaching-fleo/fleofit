// Come si legge una riga della rubrica atleti: l'aderenza della settimana, il
// meta anagrafico compresso, le iniziali dell'avatar e il conto alla rovescia
// del cestino.
//
// Perché esiste: `Atleti` era una rubrica, non uno strumento di lavoro. Ogni
// riga mostrava nome, peso, altezza ed età — dati che si consultano una volta
// al mese — mentre la domanda per cui il coach apre quella schermata è «chi
// sta seguendo il piano e chi si è fermato», e quella informazione non c'era:
// bisognava entrare in ogni scheda, una per una, per scoprirlo.
//
// ⚠️ Gli atleti fermi NON si calcolano qui. Li dà `atletiFermi` di
// `statisticheCoach.js`, la stessa funzione che alimenta «Richiedono
// attenzione» nella Home coach, con la stessa `GIORNI_FERMO`. Una seconda
// soglia qui dentro darebbe due numeri diversi per lo stesso concetto in due
// schermate della stessa app, e nessuno dei due sarebbe sbagliato da solo —
// cioè il difetto impossibile da notare.

import { format, parseISO, differenceInYears, startOfWeek, endOfWeek, isValid } from 'date-fns'
import { it } from 'date-fns/locale'
import { parseNotePausa, inPausa } from './pausa'

/**
 * Quante tacche si disegnano al massimo accanto a un atleta.
 *
 * ⚠️ Non è un vezzo grafico: le tacche sono una per allenamento assegnato, e
 * su 393px una riga con quattordici tacche (due sedute al giorno per una
 * settimana) sfonda la colonna di destra e mangia il nome. Oltre la soglia si
 * passa a una barra proporzionale, che dice la stessa cosa in larghezza fissa.
 */
export const MASSIMO_TACCHE = 7

/** Dopo quanti giorni nel cestino un atleta viene cancellato per sempre. */
export const GIORNI_CESTINO = 7

/** L'aderenza di chi questa settimana non ha nulla in programma. */
export const NESSUNA_ADERENZA = Object.freeze({
  assegnati: 0, completati: 0, tacche: [], compresso: false, quota: null,
})

const iso = (d) => format(d, 'yyyy-MM-dd')

/**
 * La settimana in corso, lunedì→domenica, in 'yyyy-MM-dd'.
 *
 * Lunedì e non domenica perché è la settimana con cui il coach programma, ed è
 * la stessa su cui la Home atleta disegna l'anello: due settimane diverse nella
 * stessa app farebbero due «3 su 5» che non coincidono.
 */
export function settimanaDi(oggi = new Date()) {
  return {
    da: iso(startOfWeek(oggi, { weekStartsOn: 1 })),
    a: iso(endOfWeek(oggi, { weekStartsOn: 1 })),
  }
}

/**
 * Quanti allenamenti ha assegnati e quanti ne ha chiusi ogni atleta nella
 * settimana in corso.
 *
 * ⚠️ Gli assegnati comprendono anche i giorni ANCORA DA VENIRE della settimana:
 * il martedì, il workout di venerdì è già programmato e fa parte del piano. La
 * conseguenza da conoscere prima di dirla un bug: il lunedì mattina sono tutti
 * a 0/5, ed è corretto. È anche il motivo per cui il colore d'allarme della
 * riga NON viene da questa frazione ma da `atletiFermi` — altrimenti ogni
 * lunedì la rubrica sarebbe interamente arancione.
 *
 * Torna una `Map` per `athlete_id`: chi non compare non ha niente in programma,
 * che è diverso da «ha fallito» e va detto in modo diverso (vedi
 * `NESSUNA_ADERENZA`).
 */
export function aderenzaSettimana(assegnazioni = [], { oggi = new Date() } = {}) {
  const { da, a } = settimanaDi(oggi)
  const grezze = new Map()

  for (const ass of assegnazioni) {
    const data = ass?.completed_date
    if (!data || !ass.athlete_id || data < da || data > a) continue
    const voce = grezze.get(ass.athlete_id) || { assegnati: 0, completati: 0 }
    voce.assegnati++
    if (ass.status === 'completed') voce.completati++
    grezze.set(ass.athlete_id, voce)
  }

  const finale = new Map()
  for (const [id, voce] of grezze) finale.set(id, aderenzaDi(voce.assegnati, voce.completati))
  return finale
}

/** La forma che la riga disegna: frazione, tacche, ed eventuale compressione. */
export function aderenzaDi(assegnati = 0, completati = 0) {
  const totale = Math.max(0, Math.trunc(assegnati) || 0)
  if (totale === 0) return { ...NESSUNA_ADERENZA }
  // Un completato in più degli assegnati non è un dato: è un conteggio andato
  // storto. Si tronca invece di disegnare sei tacche piene su cinque.
  const fatti = Math.min(Math.max(0, Math.trunc(completati) || 0), totale)
  const compresso = totale > MASSIMO_TACCHE
  return {
    assegnati: totale,
    completati: fatti,
    compresso,
    tacche: compresso ? [] : Array.from({ length: totale }, (_, i) => i < fatti),
    quota: fatti / totale,
  }
}

/** L'età in anni compiuti, o `null` se la data manca o è illeggibile. */
export function etaDi(birthDate, oggi = new Date()) {
  if (!birthDate) return null
  const nascita = parseISO(String(birthDate))
  if (!isValid(nascita)) return null
  const anni = differenceInYears(oggi, nascita)
  return Number.isFinite(anni) && anni >= 0 ? anni : null
}

/**
 * Il meta compresso di una riga: «78kg · 182cm · 31a».
 *
 * I campi vuoti spariscono invece di stampare «N/A»: una cella che dice «non lo
 * so» occupa lo stesso spazio di una che dice qualcosa. Se non si sa niente la
 * riga resta senza seconda riga, che è più onesto di tre puntini.
 */
export function metaAtleta(atleta, oggi = new Date()) {
  const eta = etaDi(atleta?.birth_date, oggi)
  return [
    atleta?.weight ? `${atleta.weight}kg` : null,
    atleta?.height ? `${atleta.height}cm` : null,
    eta != null ? `${eta}a` : null,
  ].filter(Boolean).join(' · ')
}

/** Il nome composto, con ripiego: è l'etichetta della riga, non può mancare. */
export const nomeAtleta = (a) =>
  [a?.name, a?.surname].filter(Boolean).join(' ').trim() || 'Atleta'

/**
 * Le iniziali per l'avatar senza foto.
 *
 * ⚠️ Non è decorazione: quattro cerchi grigi con la stessa icona utente
 * generica, uno sotto l'altro, non permettono di distinguere nessuno — e la
 * foto, nella rubrica reale, manca quasi sempre.
 */
export function iniziali(atleta) {
  const primo = (atleta?.name || '').trim().charAt(0)
  const secondo = (atleta?.surname || '').trim().charAt(0)
  const sigla = `${primo}${secondo}`.toUpperCase().trim()
  return sigla || '?'
}

/**
 * Cosa dice la riga di un atleta in pausa, oltre alla pillola.
 *
 * ⚠️ Dice DA QUANDO, non «rientro previsto»: il marcatore `[PAUSA: …]` registra
 * il giorno in cui la pausa è cominciata (`src/lib/pausa.js`), e una data di
 * rientro non esiste da nessuna parte nei dati. Stamparla sarebbe un dato
 * plausibile e inventato, che è il caso peggiore.
 *
 * ⚠️ Torna `null`, non «In pausa», quando la data manca: la pillola accanto
 * dice già «Pausa», e una seconda riga che la ripete è rumore travestito da
 * informazione.
 */
export function etichettaPausa(atleta) {
  const { dal } = parseNotePausa(atleta?.notes)
  if (!dal) return null
  const d = parseISO(dal)
  return isValid(d) ? `In pausa dal ${format(d, 'd MMM', { locale: it })}` : null
}

/**
 * Quanti giorni restano prima della cancellazione definitiva.
 *
 * ⚠️ `adesso` si passa: `Date.now()` chiamato durante il render è impuro, e
 * due render consecutivi darebbero conteggi diversi. L'istante si fissa quando
 * i dati arrivano, ed è anche più corretto nel merito — il conto alla rovescia
 * è relativo al momento in cui la lista è stata caricata.
 */
export function giorniRimastiCestino(deletedAt, adesso, giorni = GIORNI_CESTINO) {
  const trascorsi = (Number(adesso) - Number(deletedAt)) / 86400000
  if (!Number.isFinite(trascorsi)) return giorni
  return Math.max(0, Math.ceil(giorni - trascorsi))
}

/** Quanti sono, per stato. È il numero dentro i chip e sotto il titolo. */
export function conteggiStato(atleti = [], eliminati = []) {
  const pausa = atleti.filter(a => a && inPausa(a)).length
  return { attivi: atleti.length - pausa, pausa, eliminati: eliminati.length }
}

/**
 * La ricerca per nome.
 *
 * ⚠️ Le parole si cercano una per una, non come una stringa sola: la rubrica è
 * ordinata per nome, quindi chi cerca un atleta scrive tanto «rossi marco»
 * quanto «marco rossi», e un `includes` sull'intera frase trova solo il
 * secondo — senza dire niente, restituendo una lista vuota che sembra
 * «non c'è».
 */
export function filtraPerNome(atleti = [], termine = '') {
  const parole = String(termine || '').trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (parole.length === 0) return atleti
  return atleti.filter(a => {
    const nome = nomeAtleta(a).toLowerCase()
    return parole.every(p => nome.includes(p))
  })
}
