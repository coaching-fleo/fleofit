import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'

/**
 * La versione desktop della web app (docs/piano-web-desktop.md, fase 2).
 *
 * Si accende con TRE condizioni insieme, e nessuna basta da sola:
 * - **web**: le app iOS e Android restano identiche, anche su iPad;
 * - **finestra ≥ 1024px**: sotto, il sito è il telefono di sempre;
 * - **ruolo coach**: decisione del committente del 13/10/2026 — l'atleta che
 *   apre il sito dal PC vede l'app mobile in una colonna centrata. Il ruolo è
 *   quello EFFETTIVO: l'admin che simula l'atleta (`adminRoleOverride`) deve
 *   vedere ciò che vede l'atleta.
 *
 * ⚠️ Chi aggiunge una schermata desktop la mette dietro `useDesktop()`, mai
 * dietro una classe `lg:` da sola: `lg:` scatterebbe anche per l'atleta e per
 * l'iPad dentro l'app nativa.
 */
export const MEDIA_DESKTOP = '(min-width: 1024px)'

const misura = () =>
  typeof window !== 'undefined' &&
  !Capacitor.isNativePlatform() &&
  !!window.matchMedia?.(MEDIA_DESKTOP).matches

/** Solo la finestra: web e larga almeno 1024px. Il ruolo lo aggiunge chi chiama. */
export function useSchermoLargo() {
  const [largo, setLargo] = useState(misura)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia || Capacitor.isNativePlatform()) return
    const mq = window.matchMedia(MEDIA_DESKTOP)
    const cambia = () => setLargo(mq.matches)
    cambia()
    mq.addEventListener?.('change', cambia)
    return () => mq.removeEventListener?.('change', cambia)
  }, [])
  return largo
}

/** La regola intera, per chi ha il ruolo in mano. */
export const eDesktop = (schermoLargo, role) => schermoLargo && !!role && role !== 'athlete'
