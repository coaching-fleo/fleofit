import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Il promemoria delle notifiche compare nel «momento giusto»: per il coach,
// subito dopo un'assegnazione riuscita. Ogni punto che avvisa l'atleta di
// un'assegnazione (`mode: 'immediate'`) deve anche segnalare il momento.
// CalendarioTeam no: è solo desktop, cioè web, dove il foglio non esiste.
const leggi = (f) => readFileSync(join(__dirname, '../../pages', f), 'utf8')
const conta = (s, ago) => s.split(ago).length - 1

describe('momenti delle notifiche', () => {
  it.each(['CreateWorkout.jsx', 'WorkoutDetail.jsx', 'AthleteDetail.jsx'])(
    '%s segnala il coach a ogni assegnazione', (file) => {
      const s = leggi(file)
      const assegnazioni = conta(s, "mode: 'immediate'")
      expect(assegnazioni).toBeGreaterThan(0)
      expect(conta(s, "segnalaMomentoNotifiche('coach')")).toBe(assegnazioni)
    })

  it('la Home segnala l\'atleta solo se ha allenamenti da fare', () => {
    const s = leggi('Home.jsx')
    expect(s).toMatch(/if \(haAllenamentiDaFare\(.*\) segnalaMomentoNotifiche\('athlete'\)/)
  })

  it('dopo consenso e registrazione il turno di questa apertura è già preso', () => {
    const s = readFileSync(join(__dirname, '../../App.jsx'), 'utf8')
    expect(conta(s, 'usaApertura()')).toBe(2)
  })
})
