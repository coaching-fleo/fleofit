import logo from '../assets/marchio/pushfit-logo.webp'
import { NOME_APP } from '../lib/marchio'

/**
 * Il logo PUSHFIT: «PUSH» bianco + «FIT» giallo, corsivo, in un'immagine sola
 * (2000×249, sfondo trasparente). Sta bene solo su fondo scuro.
 *
 * `altezza` in px è l'altezza delle lettere: la larghezza segue (×8,03).
 * È un `<img>` vero, quindi html-to-image (la story) lo copia così com'è.
 */
export default function Logo({ altezza = 24, className = '', style }) {
  return (
    <img src={logo} alt={NOME_APP} draggable={false}
      className={`inline-block select-none ${className}`}
      style={{ height: altezza, width: 'auto', ...style }} />
  )
}
