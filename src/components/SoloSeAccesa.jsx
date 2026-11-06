import { Navigate } from 'react-router-dom'
import { useFunzione } from '../useFunzione'

// Una pagina di una funzione con l'interruttore (funzioni_app): spenta, chi ci
// arriva da un link torna alla Home; finché non si sa, niente (un attimo).
export default function SoloSeAccesa({ nome, children }) {
  const accesa = useFunzione(nome)
  if (accesa === null) return null
  if (!accesa) return <Navigate to="/" replace />
  return children
}
