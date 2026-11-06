// Gli interruttori delle funzioni (06/11/2026): accendere una funzione per tutti
// senza aggiornare l'app. La tabella `funzioni_app` (supabase/schema/scarpe_2026-11-02.sql
// §6) ha una riga per funzione, con uno stato fra:
//   'spenta' — nascosta a tutti · 'admin' — la vedono solo gli admin · 'tutti'.
//
// Regole:
//   · si legge UNA volta per avvio (la promessa resta in memoria): cambiare la riga
//     vale dal prossimo avvio dell'app, non a metà sessione;
//   · nel dubbio è spenta: riga assente, tabella assente o database che non risponde
//     danno l'ultima risposta salvata su questo dispositivo, e senza quella 'spenta'.
//     Una funzione non annunciata non deve comparire per sbaglio;
//   · il ruolo è quello dell'interfaccia (`role` di AuthContext): un admin che
//     simula l'atleta vede quello che vede un atleta.

import { supabase } from '../supabaseClient'
import { leggiJson, scriviJson } from './offlineQueue'

export const STATI_FUNZIONE = ['spenta', 'admin', 'tutti']
const CHIAVE = 'fleofit_funzioni'

/** Pura: con questo stato, chi ha questo ruolo vede la funzione? */
export function funzioneVisibile(stato, ruolo) {
  if (stato === 'tutti') return true
  if (stato === 'admin') return ruolo === 'admin'
  return false
}

const letture = new Map()

/** Lo stato di una funzione ('spenta' | 'admin' | 'tutti'), letto una volta per avvio. */
export function statoFunzione(nome) {
  if (!letture.has(nome)) letture.set(nome, leggiStato(nome))
  return letture.get(nome)
}

async function leggiStato(nome) {
  const salvati = leggiJson(CHIAVE, {})
  const ultimo = STATI_FUNZIONE.includes(salvati[nome]) ? salvati[nome] : 'spenta'
  try {
    const { data, error } = await supabase.from('funzioni_app').select('stato').eq('nome', nome).maybeSingle()
    if (error) return ultimo
    const stato = STATI_FUNZIONE.includes(data?.stato) ? data.stato : 'spenta'
    scriviJson(CHIAVE, { ...leggiJson(CHIAVE, {}), [nome]: stato })
    return stato
  } catch {
    return ultimo
  }
}

// Il ruolo lo fissa chi tiene AuthContext (App.jsx), così anche chi non è un
// componente (scarpeDb.js) può chiedere se la funzione è accesa.
let ruoloCorrente = null
export function impostaRuoloFunzioni(ruolo) { ruoloCorrente = ruolo }

/** La funzione è accesa per chi sta usando l'app? */
export async function funzioneAttiva(nome) {
  return funzioneVisibile(await statoFunzione(nome), ruoloCorrente)
}

/** Solo per i test: dimentica le letture fatte. */
export function azzeraFunzioni() { letture.clear(); ruoloCorrente = null }
