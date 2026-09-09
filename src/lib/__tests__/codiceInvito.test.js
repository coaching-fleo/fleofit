import { describe, it, expect } from 'vitest'
import {
  normalizzaCodice, codiceCompleto, celleCodice, LUNGHEZZA_CODICE,
} from '../codiceInvito'

describe('normalizzaCodice', () => {
  it('porta a maiuscolo e butta via tutto ciò che non è del codice', () => {
    expect(normalizzaCodice(' 7kq2-m4xb ')).toBe('7KQ2M4XB')
  })

  // 🔴 Il caso che conta di più. Impostazioni offre «Copia codice» E «Copia
  // link», e il link è quello che si manda su WhatsApp perché apre l'app da
  // solo. Senza questo ramo, chi lo incolla nelle caselle ottiene otto
  // caratteri presi dall'indirizzo — un codice sbagliato che ha tutta l'aria di
  // essere quello giusto, e un errore che non spiega niente.
  it('🔴 estrae il codice da un LINK invece di leggerne l’indirizzo', () => {
    expect(normalizzaCodice('https://fleofit.vercel.app/?invite=7KQ2M4XB')).toBe('7KQ2M4XB')
  })

  // Il ritorno di OAuth usa l'altro nome (App.jsx costruisce `?inviteCode=`):
  // sono due nomi per lo stesso parametro e passano tutti e due di qui.
  it('riconosce anche ?inviteCode= del ritorno OAuth', () => {
    expect(normalizzaCodice('fleofit://login-callback?inviteCode=ab12cd34&x=1')).toBe('AB12CD34')
  })

  it('non supera mai la lunghezza del codice', () => {
    expect(normalizzaCodice('ABCDEFGHIJKLMNO')).toHaveLength(LUNGHEZZA_CODICE)
  })

  // Arriva da `navigator.clipboard.readText()` e da `searchParams.get()`, che
  // possono tornare qualsiasi cosa: qui non si lancia mai.
  it('regge un valore che non è una stringa', () => {
    expect(normalizzaCodice(null)).toBe('')
    expect(normalizzaCodice(undefined)).toBe('')
    expect(normalizzaCodice(42)).toBe('')
  })

  it('è completo solo agli otto caratteri veri', () => {
    expect(codiceCompleto('7KQ2M4X')).toBe(false)
    expect(codiceCompleto('7kq2-m4xb')).toBe(true)
  })
})

describe('celleCodice', () => {
  it('la cella attiva è quella in cui finirà il prossimo carattere', () => {
    const celle = celleCodice('7KQ')
    expect(celle).toHaveLength(LUNGHEZZA_CODICE)
    expect(celle.map(c => c.carattere).join('')).toBe('7KQ')
    expect(celle.findIndex(c => c.attiva)).toBe(3)
  })

  // ⚠️ A codice pieno nessuna cella è attiva: la nona non esiste, e lasciare
  // il cursore acceso mentre la verifica sta già partendo si legge come «ne
  // manca ancora uno».
  it('a codice pieno nessuna cella è attiva', () => {
    expect(celleCodice('7KQ2M4XB').some(c => c.attiva)).toBe(false)
  })
})
