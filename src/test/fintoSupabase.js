import { vi } from 'vitest'

/**
 * Finto client Supabase, quanto basta per montare una pagina.
 *
 * Il client vero è una catena fluente che si può chiudere in molti punti
 * (`.limit()`, `.single()`, `await` diretto), e ogni pagina la usa in modo
 * diverso. Invece di riprodurre l'API si usa un Proxy: qualunque metodo torna
 * la catena, e la catena è "thenable", così `await` funziona ovunque la si
 * chiuda.
 *
 * @param risposte  { nomeTabella: [righe] } — cosa deve tornare ogni tabella.
 * @param opzioni.erroreSu  nomi di tabelle che devono fallire, per provare i
 *                          rami di fallback (per esempio la cache offline).
 *                          Può essere una FUNZIONE, valutata a ogni query: serve
 *                          per far fallire il fetch a metà test, che è l'unico
 *                          modo di riprodurre davvero lo scenario offline —
 *                          con un fetch che riesce, la cache viene sovrascritta
 *                          con dati validi e il ramo di fallback non si esercita
 *                          mai (scoperto il 26/08/2026: due test passavano per
 *                          il motivo sbagliato).
 */
export function fintoSupabase(risposte = {}, { erroreSu = [] } = {}) {
  const chiamate = []

  const catena = (tabella) => {
    const righe = typeof risposte === 'function' ? (risposte()[tabella] ?? []) : (risposte[tabella] ?? [])
    const tabelleInErrore = typeof erroreSu === 'function' ? erroreSu() : erroreSu
    const risultato = tabelleInErrore.includes(tabella)
      ? { data: null, error: { message: 'rete assente' }, count: null }
      : { data: righe, error: null, count: righe.length }

    // .single() e .maybeSingle() cambiano la FORMA della risposta: un oggetto
    // invece di un array. Senza questa distinzione una pagina che carica un
    // singolo record riceve un array, `workout.sections` è undefined e la
    // pagina ricade sui default senza segnalare niente — sembra funzionare ma
    // sta mostrando un'altra cosa (successo il 26/08/2026 con WorkoutDetail).
    let singolo = false

    const proxy = new Proxy({}, {
      get(_, prop) {
        if (prop === 'then') {
          const finale = singolo
            ? { ...risultato, data: risultato.data ? (risultato.data[0] ?? null) : null }
            : risultato
          return (ok, ko) => Promise.resolve(finale).then(ok, ko)
        }
        return (...args) => {
          if (prop === 'single' || prop === 'maybeSingle') singolo = true
          chiamate.push({ tabella, metodo: String(prop), args })
          return proxy
        }
      },
    })
    return proxy
  }

  const canale = {
    on: vi.fn(() => canale),
    subscribe: vi.fn((cb) => { cb?.('SUBSCRIBED'); return canale }),
    track: vi.fn(() => Promise.resolve()),
    send: vi.fn(() => Promise.resolve()),
    unsubscribe: vi.fn(() => Promise.resolve()),
    presenceState: vi.fn(() => ({})),
  }

  return {
    chiamate,
    /** Le chiamate a una tabella, per verificare cosa è stato scritto. */
    chiamateA: (tabella, metodo) =>
      chiamate.filter(c => c.tabella === tabella && (!metodo || c.metodo === metodo)),
    supabase: {
      from: vi.fn(catena),
      auth: {
        getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'u1' } } })),
        updateUser: vi.fn(() => Promise.resolve({ error: null })),
        signOut: vi.fn(() => Promise.resolve({ error: null })),
      },
      functions: { invoke: vi.fn(() => Promise.resolve({ data: null, error: null })) },
      storage: { from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve({ error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://esempio/x.aac' } })),
        remove: vi.fn(() => Promise.resolve({ error: null })),
      })) },
      channel: vi.fn(() => canale),
      removeChannel: vi.fn(),
    },
  }
}

