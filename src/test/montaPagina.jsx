import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { render } from '@testing-library/react'
import { AuthContext } from '../App'

export const UTENTE = {
  id: 'u1',
  email: 'atleta@fleofit.it',
  user_metadata: { first_name: 'Marco' },
}

/**
 * Monta una pagina dentro router e AuthContext veri.
 *
 * ⚠️ `percorso` + `rotta` servono alle pagine che leggono `useParams()`. Senza,
 * `useParams()` torna vuoto e la pagina ricade sull'utente loggato — che per
 * `AthleteDetail` vuol dire credersi sul PROPRIO profilo anche montata come
 * coach, e nascondere metà dell'interfaccia. Un test così passa lo stesso, e
 * verifica un'altra pagina (§9-sexies).
 */
export function montaPagina(elemento, { user = UTENTE, role = 'athlete', percorso = null, rotta = null } = {}) {
  const contenuto = percorso
    ? <Routes><Route path={rotta || percorso} element={elemento} /></Routes>
    : elemento
  return render(
    <MemoryRouter initialEntries={[percorso || '/']}>
      <AuthContext.Provider value={{ user, role }}>{contenuto}</AuthContext.Provider>
    </MemoryRouter>
  )
}

/** Data di oggi nel formato che l'app usa in athlete_workouts.completed_date. */
export const oggi = () => new Date().toISOString().split('T')[0]
