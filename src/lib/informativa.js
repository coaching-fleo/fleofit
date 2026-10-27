import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { URL_INFORMATIVA } from './consenso'

/**
 * Apre l'informativa privacy. Sul nativo nel browser in-app (l'utente torna
 * all'app chiudendolo), sul web in una scheda nuova: chi la legge durante la
 * schermata del consenso non deve perdere le caselle già spuntate.
 */
export function apriInformativa() {
  if (Capacitor.isNativePlatform()) {
    return Browser.open({ url: URL_INFORMATIVA }).catch(() => {})
  }
  window.open(URL_INFORMATIVA, '_blank', 'noopener')
  return Promise.resolve()
}
