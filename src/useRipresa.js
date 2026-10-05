import { useState, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// 🔴 TORNANDO INDIETRO UNA LISTA RIPRENDE DOV'ERA (archivio 02/10/2026,
// rubrica 05/10/2026). `ScrollInCima` non tocca lo scorrimento sui ritorni
// (POP), ma non bastava: la pagina si rimontava con lo scheletro, che è corto,
// quindi il browser schiacciava lo scorrimento in cima — e quando la lista
// arrivava non c'era più niente da riprendere. Si tiene perciò in memoria lo
// stato della pagina e la posizione, **per voce di history** (`location.key`):
// così vale solo per il ritorno a QUESTA voce, mai per un'apertura nuova, che
// deve partire dall'inizio. La chiave `default` (prima pagina della sessione)
// non si memorizza: non c'è nessuna voce da cui tornarci.
//
// ⚠️ È memoria di modulo, non localStorage: dura quanto l'app aperta, ed è
// giusto così — dopo un riavvio non esiste nessun «indietro» verso la lista.
// ⚠️ `nome` separa le pagine: due liste diverse non devono mai potersi
// scambiare lo stato, nemmeno se un giorno condividessero una voce.
const memoria = new Map()

/**
 * Due hook, e non uno: la pagina inizializza i suoi `useState` con ciò che
 * `useRipresa` restituisce, quindi quello va chiamato PRIMA degli stati —
 * mentre `useRicorda` ha bisogno dei loro valori, quindi va chiamato DOPO.
 *
 * @param {string} nome  la pagina («archivio», «atleti»)
 * @param {string} uid   l'utente: la memoria di un altro account non si riprende
 * @returns lo stato memorizzato (con `scrollY`), o `null` se non è un ritorno
 */
export function useRipresa(nome, uid) {
  const { key } = useLocation()
  const tipo = useNavigationType()
  // Letta una volta al montaggio: una ricarica di sfondo non deve ritirarla.
  const [ripresa] = useState(() => {
    const m = tipo === 'POP' && key !== 'default' ? memoria.get(`${nome}:${key}`) : null
    return m && m.uid === uid ? m : null
  })
  return ripresa
}

/**
 * Rimette la posizione al ritorno e memorizza `stato` all'uscita.
 * `stato` deve contenere `caricato`: una pagina uscita a metà caricamento non
 * si memorizza, o il ritorno mostrerebbe una lista vuota.
 */
export function useRicorda(nome, uid, ripresa, stato) {
  const { key } = useLocation()
  // Lo stato sta in un ref: la scrittura avviene all'USCITA, e la pulizia di un
  // effetto vede solo i valori del montaggio. Si aggiorna in un effetto e non
  // durante il render, dove un ref non si scrive.
  const ultimo = useRef(stato)
  useLayoutEffect(() => { ultimo.current = stato })

  // ⚠️ Dipendenze vuote di proposito: `key` e `ripresa` sono quelli del
  // montaggio, ed è a quella voce di history che la posizione appartiene.
  // ⚠️ `useLayoutEffect` e non `useEffect`, in tutti e due i versi. All'uscita:
  // la sua pulizia gira prima che `ScrollInCima` porti in cima la pagina nuova,
  // quindi legge ancora la posizione vera. All'entrata: la posizione si rimette
  // prima del primo fotogramma, senza un lampo in cima.
  useLayoutEffect(() => {
    if (ripresa) window.scrollTo(0, ripresa.scrollY)
    const corrente = ultimo
    return () => {
      if (key === 'default' || !corrente.current.caricato) return
      memoria.set(`${nome}:${key}`, { ...corrente.current, uid, scrollY: window.scrollY })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
