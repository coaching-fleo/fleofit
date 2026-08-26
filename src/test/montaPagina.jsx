import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'
import { AuthContext } from '../App'

export const UTENTE = {
  id: 'u1',
  email: 'atleta@fleofit.it',
  user_metadata: { first_name: 'Marco' },
}

/** Monta una pagina dentro router e AuthContext veri. */
export function montaPagina(elemento, { user = UTENTE, role = 'athlete' } = {}) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ user, role }}>{elemento}</AuthContext.Provider>
    </MemoryRouter>
  )
}

/** Data di oggi nel formato che l'app usa in athlete_workouts.completed_date. */
export const oggi = () => new Date().toISOString().split('T')[0]
