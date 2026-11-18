/**
 * Il codice d'invito dopo un'installazione dal Play Store (16/11/2026).
 *
 * Il link del coach manda chi non ha l'app al Play Store con il codice nel
 * referrer (`urlPlayStore` di src/lib/linkInvito.js). Al PRIMO avvio l'app lo
 * rilegge con il plugin nativo `InstallReferrer`
 * (android/…/InstallReferrerPlugin.java) e apre la card dell'invito.
 *
 * ⚠️ Si legge UNA volta per installazione (`pushfit_referrer_letto`): il Play
 * Store riconsegna lo stesso referrer per 90 giorni, e senza la memoria chi
 * esce dall'account si ritroverebbe il codice di allora a ogni avvio.
 * Solo Android: su iOS e sul web il plugin non c'è e non succede niente.
 */
import { Capacitor, registerPlugin } from '@capacitor/core'
import { leggiJson, scriviJson } from './offlineQueue'
import { codiceDaReferrer } from './linkInvito'

const InstallReferrer = registerPlugin('InstallReferrer')
export const CHIAVE_REFERRER = 'pushfit_referrer_letto'

/**
 * Il codice arrivato dal Play Store, o `null`. Non rilancia mai.
 * @param {{ piattaforma?: string, plugin?: { leggi: () => Promise<{referrer?: string}> } }} [opz] per i test
 */
export async function codiceDalPlayStore({ piattaforma = Capacitor.getPlatform(), plugin = InstallReferrer } = {}) {
  if (piattaforma !== 'android') return null
  if (leggiJson(CHIAVE_REFERRER, false)) return null
  try {
    const { referrer } = await plugin.leggi()
    scriviJson(CHIAVE_REFERRER, true)
    return codiceDaReferrer(referrer)
  } catch {
    // Plugin assente (app vecchia) o Play Store giù: si riprova al prossimo avvio.
    return null
  }
}
