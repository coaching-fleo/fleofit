/**
 * Il plugin nativo che legge il testo di una foto, tutto sul telefono: Apple
 * Vision su iOS (`ios/App/App/LettoreTesto.swift`), ML Kit su Android
 * (`android/app/src/main/java/it/federicoleo/fleofit/LettoreTestoPlugin.java`).
 * Sul web non c'è: `fotoDisponibile()` lo dice, e il bottone non compare.
 */

import { Capacitor, registerPlugin } from '@capacitor/core'
import { HYROX_EXERCISES } from './esercizi'
import { ERGOMETERS } from './constants'
import { testoDaRighe } from './testoDaFoto'

const LettoreTesto = registerPlugin('LettoreTesto')

/**
 * Le parole del gergo da proteggere: con la correzione linguistica accesa,
 * Vision «correggerebbe» SkiErg o EMOM nella parola italiana più vicina.
 */
export const PAROLE_GERGO = [
  ...new Set([
    ...HYROX_EXERCISES, ...ERGOMETERS,
    'EMOM', 'E2MOM', 'E3MOM', 'AMRAP', 'RFT', 'For Time', 'Tabata', 'Cash In', 'Cash Out',
    'Buy In', 'Buy Out', 'Warm Up', 'Rest', 'Rec', 'WB', 'BBJ', 'KB', 'KBS', 'DU', 'T2B', 'HSPU',
    'Ski', 'Row', 'Sled', 'RPE', 'Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'cal', 'kg', 'rpm',
  ]),
]

/** Il telefono sa leggere le foto? */
export const fotoDisponibile = () => {
  try {
    return Capacitor.isPluginAvailable('LettoreTesto')
  } catch {
    return false
  }
}

/**
 * Il testo di una foto, già in ordine di lettura.
 * @param {string} base64 JPEG senza il prefisso `data:`
 * @returns {Promise<string>} '' se nella foto non c'è testo
 */
export async function leggiFoto(base64) {
  const { righe } = await LettoreTesto.leggi({ base64, parole: PAROLE_GERGO })
  return testoDaRighe(righe)
}
