// Il registro degli extra (spec docs/superpowers/specs/2026-11-12-sezione-extra-design.md).
//
// Un extra è una funzione fuori dal cuore dell'app (le Scarpe, più avanti palestre
// e biglietti) con un interruttore suo in `funzioni_app`. Barra dell'atleta,
// Libreria del coach, barra laterale desktop, pagina Extra e card in Home leggono
// SOLO da qui (con useExtra / useAvvisiExtra): un extra nuovo = una voce qui, una
// rotta in App.jsx dentro <SoloSeAccesa nome=interruttore>, una riga nel seme della
// demo e in funzioni_app. Lo controlla src/lib/__tests__/extra.test.js.
//
// ⚠️ Qui solo icone e testi. Pagine e letture degli extra si caricano con
// `import()` pigro: questo file finisce nel chunk d'ingresso.

import { Footprints } from 'lucide-react'

export const EXTRA = [
  {
    id: 'scarpe',
    nome: 'Scarpe da corsa',
    icona: Footprints,
    interruttore: 'scarpe',
    rotta: '/scarpe',
    ruoli: ['athlete', 'coach'],
    descrizione: { athlete: 'I km delle tue scarpe', coach: 'Il catalogo dei modelli' },
    // Ognuna: (uid, ruolo) => Promise<…>, mai un'eccezione.
    stato: () => import('./extra/scarpe').then(m => m.stato),
    avviso: () => import('./extra/scarpe').then(m => m.avviso),
  },
]

/** Il ruolo come lo intendono gli extra: admin e coach sono lo stesso pubblico. */
export const ruoloExtra = (role) => (role === 'athlete' ? 'athlete' : 'coach')
