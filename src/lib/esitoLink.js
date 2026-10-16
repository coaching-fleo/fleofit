/**
 * 🔴 Un link della mail che NON apre la sessione deve dirlo.
 *
 * Il guasto del 16/10/2026: l'atleta si registra col codice, conferma dalla
 * mail, l'app si riapre… e resta ferma sulla schermata di prima, senza un
 * avviso. Al login successivo con email e password entra e crea il profilo:
 * la mail era confermata, è il RITORNO nell'app che non portava una sessione.
 *
 * Succede quando Supabase rimanda indietro un errore al posto dei token —
 * il caso tipico è `otp_expired`: il link è già stato aperto una volta (da un
 * secondo tocco, o dall'antivirus della posta che lo visita prima di noi, e
 * così conferma l'indirizzo) — oppure quando i token non arrivano o non
 * bastano. In tutti questi casi DeeplinkHandler mandava a /login e il login
 * non guardava l'errore: nessun messaggio, nessuna via d'uscita indicata.
 *
 * Questo modulo tiene l'errore finché il login non lo mostra:
 *  - sull'app lo segnala DeeplinkHandler (`segnalaLinkFallito`);
 *  - sul web si legge dall'indirizzo al caricamento, PRIMA che `createClient`
 *    tocchi l'hash (`supabaseClient.js` importa questo file in testa, come
 *    `recuperoPassword.js`).
 */

/** L'errore di un ritorno da Supabase, dalla query o dall'hash; `null` se non c'è. */
export const leggiErroreLink = (search, hash) => {
  const da = (s, togli) => new URLSearchParams(String(s || '').replace(togli, ''))
  for (const p of [da(hash, /^#/), da(search, /^\?/)]) {
    const codice = p.get('error_code')
    const descrizione = p.get('error_description')
    // `error` da solo è anche un nostro parametro (`?error=unauthorized`):
    // conta solo se Supabase ci ha messo accanto un codice o una descrizione.
    if (codice || descrizione) return { codice: codice || p.get('error') || '', descrizione: descrizione || '' }
  }
  return null
}

/** Il testo dell'avviso, in italiano: cosa è successo e cosa fare adesso. */
export const messaggioErroreLink = (errore) => {
  const scaduto = errore?.codice === 'otp_expired' || /expired|invalid/i.test(errore?.descrizione || '')
  if (scaduto) {
    return {
      title: 'Link scaduto o già usato',
      message: 'Il link della mail è già stato aperto o non è più valido. Se avevi già confermato l\'indirizzo, entra con email e password; altrimenti ripeti la registrazione per riceverne uno nuovo.',
      type: 'error',
    }
  }
  return {
    title: 'Il link non ha aperto l\'app',
    message: 'Non siamo riusciti ad accedere dal link della mail. Prova a entrare con email e password: se l\'indirizzo è confermato, entri subito.'
      + (errore?.descrizione ? ` (Dettaglio: ${errore.descrizione})` : ''),
    type: 'error',
  }
}

let inAttesa = typeof window !== 'undefined'
  ? leggiErroreLink(window.location.search, window.location.hash)
  : null
let ascoltatore = null

/** DeeplinkHandler: il link è tornato senza una sessione. */
export const segnalaLinkFallito = (errore) => {
  inAttesa = errore || { codice: '', descrizione: '' }
  if (ascoltatore) consegna()
}

const consegna = () => {
  const e = inAttesa
  inAttesa = null
  ascoltatore(e)
}

/**
 * Il login si mette in ascolto: riceve subito l'errore in attesa, se c'è, e
 * quelli che arrivano dopo mentre è aperto (l'app riaperta dal link mentre il
 * login era già a schermo — il caso del guasto). Torna la funzione che smette.
 */
export const ascoltaErroreLink = (cb) => {
  ascoltatore = cb
  if (inAttesa) consegna()
  return () => { if (ascoltatore === cb) ascoltatore = null }
}
