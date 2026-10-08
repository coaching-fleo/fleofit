// Segnala un problema — la parte che si può testare senza un telefono.
//
// Stesso patto di rigaImpostazioni: qui non entra né una `supabase` né un
// componente. Il foglio (`FoglioSegnalazione`) mostra, `Settings` spedisce,
// e questo file decide COSA si chiede e COSA parte.
//
// ⚠️ La mail la manda il server (Edge Function `segnalazione`), non l'app:
// lo schema è congelato (CLAUDE.md regola 0-bis), quindi niente tabella, e la
// policy di `notifications` non lascia scrivere a un atleta una riga del coach.
// I LIMITI qui sotto esistono due volte, qui e in
// `supabase/functions/segnalazione/regole.ts`: un test verifica che coincidano.

import { format } from 'date-fns'
import { it } from 'date-fns/locale'

export const CHIAVE_BOZZA = 'fleofit_segnalazione_bozza'

export const LIMITI = {
  descrizioneMin: 10,
  descrizioneMax: 4000,
  immaginiMax: 3,
  byteImmagineMax: 1_572_864,
  byteTecniciMax: 2048,
}

/** I sei tipi, nell'ordine del passo 1. `icona` è un nome lucide: il file resta senza React. */
export const TIPI = [
  { id: 'bug', titolo: 'Qualcosa non funziona', dettaglio: 'Un tasto, una schermata, un dato sbagliato', icona: 'Bug' },
  { id: 'lenta', titolo: 'Si blocca o è lenta', dettaglio: 'Si chiude da sola, resta ferma, carica piano', icona: 'Snail' },
  { id: 'notifiche', titolo: 'Notifiche', dettaglio: 'Promemoria e avvisi che non arrivano', icona: 'BellOff' },
  { id: 'timer', titolo: 'Timer e allenamento', dettaglio: 'Il timer guidato, i round, i suoni', icona: 'Timer' },
  { id: 'accesso', titolo: 'Accesso e account', dettaglio: 'Login, password, profilo', icona: 'KeyRound' },
  { id: 'idea', titolo: "Un'idea", dettaglio: 'Qualcosa che vorresti nell\'app', icona: 'Lightbulb' },
]

const FREQUENZA = { id: 'frequenza', testo: 'Quanto spesso?', opzioni: ['Sempre', 'A volte', 'Una volta sola'] }

const DOMANDE = {
  bug: [
    { id: 'dove', testo: 'Dove succede?', opzioni: ['Home', 'Calendario', 'Scheda allenamento', 'Profilo', 'Altro'] },
    FREQUENZA,
  ],
  lenta: [
    { id: 'cosa', testo: 'Cosa succede?', opzioni: ['Si chiude da sola', 'Resta bloccata', 'È lenta a caricare'] },
    FREQUENZA,
  ],
  notifiche: [
    { id: 'quando', testo: 'Cosa succede?', opzioni: ['Non arrivano mai', 'Arrivano in ritardo', 'Arrivano doppie'] },
    FREQUENZA,
  ],
  timer: [
    { id: 'cosa', testo: 'Cosa succede?', opzioni: ['Si ferma', 'Il suono non parte', 'I tempi sono sbagliati'] },
    FREQUENZA,
  ],
  accesso: [
    { id: 'cosa', testo: 'Cosa non riesci a fare?', opzioni: ['Entrare', 'Cambiare la password', 'Modificare il profilo'] },
    FREQUENZA,
  ],
  idea: [],
}

/** Le domande a scelta rapida del passo 2. Un tipo sconosciuto non ne ha. */
export const domandePer = (tipo) => DOMANDE[tipo] || []

export const bozzaVuota = () => ({ tipo: null, risposte: {}, descrizione: '' })

// ── Niente link né codice (committente, 08/10/2026) ───────────────────────
// ⚠️ Queste tre espressioni esistono IDENTICHE in
// `supabase/functions/segnalazione/regole.ts`, che è quello che decide davvero
// (il telefono si può aggirare). Un test fa passare gli stessi casi da tutte e
// due: se una cambia da sola, cade.
// Caratteri di controllo (tranne a capo e tab) e invisibili: zero-width e i
// controlli di direzione, che servono a far leggere un testo diverso da com'è.
// eslint-disable-next-line no-control-regex -- i caratteri di controllo sono proprio ciò che si cerca
const CARATTERI_PROIBITI = new RegExp('[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]')
// Un tag HTML: «<» seguito da una lettera, «/», «!» o «?». «<3» resta permesso.
const CODICE = /<\s*\/?\s*[a-z!?]/i
// Indirizzi web ed email. I domini «nudi» solo con i suffissi più comuni, così
// «9.5 kg» o «a.b» non vengono presi per link.
const LINK = /(https?:\/\/|ftp:\/\/|javascript:|www\.|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\b[a-z0-9-]{2,}\.(com|it|net|org|io|ly|me|co|app|xyz|ru|cn|info|biz|link|click|top|site|online|shop|eu|de|fr|uk|us|tk|gl|gg|to|be)\b)/i

/** Il messaggio d'errore se il testo contiene qualcosa che non deve partire, o `null`. */
export function testoProibito(testo) {
  const t = String(testo ?? '')
  if (CARATTERI_PROIBITI.test(t)) return 'Il testo contiene caratteri non ammessi'
  if (CODICE.test(t)) return 'Il testo non può contenere codice'
  if (LINK.test(t)) return 'Togli i link e gli indirizzi: non si possono inviare'
  return null
}

/**
 * Si può proseguire? Lavora sul testo RIFILATO: dieci spazi sono una mail
 * muta, e non devono passare il controllo che li conta come dieci caratteri.
 */
export function validaSegnalazione({ tipo, descrizione, immagini = [] }) {
  const testo = (descrizione || '').trim()
  let errore = null
  if (!tipo) errore = 'Scegli di cosa si tratta'
  else if (testo.length < LIMITI.descrizioneMin) errore = `Scrivi almeno ${LIMITI.descrizioneMin} caratteri`
  else if (testoProibito(testo)) errore = testoProibito(testo)
  else if (testo.length > LIMITI.descrizioneMax) errore = 'Massimo 4.000 caratteri'
  else if (immagini.length > LIMITI.immaginiMax) errore = `Massimo ${LIMITI.immaginiMax} immagini`
  return { ok: errore === null, errore }
}

/**
 * I dati tecnici che partono con la segnalazione, e che l'utente vede prima.
 * Una riga che non si conosce SPARISCE (la versione sul web): «Versione: null»
 * direbbe una cosa falsa. Uno zero in coda invece è un dato, e resta.
 */
export function datiTecnici({ versione, piattaforma, userAgent, ruolo, online, inCoda, ora, lingua, fuso }) {
  const righe = [
    ['Versione', versione],
    ['Piattaforma', piattaforma],
    ['Dispositivo', userAgent],
    ['Ruolo', ruolo],
    ['Rete', online == null ? null : (online ? 'online' : 'offline')],
    ['In coda offline', inCoda == null ? null : String(inCoda)],
    ['Data e ora', ora ? format(ora, 'd MMM yyyy, HH:mm', { locale: it }) : null],
    ['Lingua', lingua],
    ['Fuso orario', fuso],
  ]
  return righe
    .filter(([, valore]) => valore != null && valore !== '')
    .map(([etichetta, valore]) => ({ etichetta, valore }))
}

/** Il body per `functions.invoke('segnalazione')`: testi al posto degli id, nell'ordine delle domande. */
export function corpoRichiesta({ tipo, risposte = {}, descrizione, tecnici = [], immagini = [] }) {
  return {
    tipo,
    risposte: domandePer(tipo)
      .filter(d => risposte[d.id])
      .map(d => ({ domanda: d.testo, risposta: risposte[d.id] })),
    descrizione: (descrizione || '').trim(),
    tecnici: Object.fromEntries(tecnici.map(r => [r.etichetta, r.valore])),
    immagini: immagini.map(({ nome, base64 }) => ({ nome, base64 })),
  }
}
