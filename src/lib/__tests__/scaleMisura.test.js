import { describe, it, expect } from 'vitest'
import { SCALE, grandezza, indiceVicino, valoreDaTesto, testoDaValore, etichettaDi, unitaDi, eVoce } from '../scaleMisura'
import { parseDuration } from '../timerSequence'
import { durataBlocco, durataEsercizio } from '../stimaWorkout'

// Perché questi test esistono
// ────────────────────────────
// Il righello cambia il GESTO con cui si scrive un numero, e non deve cambiare
// il DATO: ogni stringa che una scala produce finisce in `workouts.sections`,
// che la web app in produzione legge così com'è (CLAUDE.md §1.1). Un formato
// nuovo non darebbe nessun errore: darebbe una scheda letta storta.
//
// Le liste qui sotto sono COPIATE dal builder di prima del righello, apposta:
// sono la fotografia del vocabolario che il database già contiene.

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const VECCHIE = {
  reps: Array.from({ length: 100 }, (_, i) => `${i + 1}`),
  kg: Array.from({ length: 300 }, (_, i) => `${i + 1} kg`),
  kgDoppi: [4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32].map(w => `2x${w} kg`),
  metri: ['50m', '100m', '150m', '200m', '250m', '300m', '400m', '500m', '600m', '750m', '1000m', '1500m', '2000m',
    ...Array.from({ length: 50 }, (_, i) => `${(i + 1) * 10}m`)],
  tempo: [...Array.from({ length: 120 }, (_, i) => mmss((i + 1) * 5)), ...Array.from({ length: 220 }, (_, i) => mmss(600 + (i + 1) * 30))],
  rest: Array.from({ length: 90 }, (_, i) => mmss((i + 1) * 10)),
  round: Array.from({ length: 40 }, (_, i) => `${i + 1}`),
  passoCorsa: Array.from({ length: 96 }, (_, i) => `${mmss(120 + i * 5)} /km`),
  passoErgo: Array.from({ length: 61 }, (_, i) => `${mmss(90 + i * 5)} /500m`),
  cadenza: Array.from({ length: 17 }, (_, i) => `${40 + i * 5} RPM`),
  velocita: Array.from({ length: 41 }, (_, i) => `${(5 + i * 0.5).toFixed(1)} km/h`),
  durataCorsa: [...Array.from({ length: 60 }, (_, i) => `${i + 1} min`), ...Array.from({ length: 12 }, (_, i) => `${(i + 1) * 5} sec`)],
  distanzaCorsa: [...Array.from({ length: 10 }, (_, i) => `${(i + 1) * 10}m`),
    '150m', '200m', '250m', '300m', '400m', '500m', '600m', '800m', '1 km', '1.5 km', '2 km', '3 km', '4 km', '5 km', '10 km', '15 km', '21 km', '42 km'],
}

describe('il righello scrive il vocabolario di prima', () => {
  // Ogni voce di ogni scala deve avere la FORMA di una voce delle liste di
  // prima: stessa unità, stesso spazio, stesso separatore.
  const forme = {
    ripetizioni: /^\d+$/, round: /^\d+$/, ripetute: /^\d+$/,
    peso: /^\d+(\.\d)?\d? kg$/, pesoDoppio: /^2x\d+ kg$/,
    metri: /^\d+m$/, tempo: /^\d+:\d\d$/, recupero: /^\d+:\d\d$/,
    passoCorsa: /^\d+:\d\d \/km$/, passoErgo: /^\d+:\d\d \/500m$/,
    cadenza: /^\d+ RPM$/, velocita: /^\d+\.\d km\/h$/,
    durataCorsa: /^\d+ (min|sec)$/, distanzaCorsa: /^(\d+m|\d+(\.\d)? km)$/,
  }
  for (const [nome, forma] of Object.entries(forme)) {
    it(`«${nome}» ha la forma di sempre`, () => {
      for (const v of SCALE[nome].voci) expect(v.valore).toMatch(forma)
    })
  }

  it('dove la scala ha la stessa misura, ripete ESATTAMENTE le voci di prima', () => {
    // Non tutte le vecchie voci devono essere tacche (il tempo sopra la mezz'ora
    // va ora di minuto in minuto), ma quelle comuni devono coincidere carattere
    // per carattere: «1:00» e non «01:00», «12.0 km/h» e non «12 km/h».
    const coppie = [
      ['ripetizioni', 'reps'], ['round', 'round'], ['passoCorsa', 'passoCorsa'],
      ['passoErgo', 'passoErgo'], ['cadenza', 'cadenza'], ['velocita', 'velocita'],
    ]
    for (const [scala, vecchia] of coppie) {
      const voci = SCALE[scala].voci.map(v => v.valore)
      expect(voci).toEqual(VECCHIE[vecchia])
    }
  })

  it('ogni scala ha valori unici e in ordine crescente', () => {
    for (const [nome, scala] of Object.entries(SCALE)) {
      const g = scala.voci.map(v => grandezza(v.valore))
      expect(new Set(scala.voci.map(v => v.valore)).size, nome).toBe(scala.voci.length)
      g.forEach((x, i) => { if (i > 0) expect(x, `${nome} ${scala.voci[i].valore}`).toBeGreaterThan(g[i - 1]) })
    }
  })

  it('la voce di partenza esiste in ogni scala', () => {
    for (const [nome, scala] of Object.entries(SCALE)) expect(eVoce(scala, scala.partenza), nome).toBe(true)
  })
})

describe('i lettori della durata capiscono ogni voce', () => {
  it('parseDuration legge i tempi come secondi giusti', () => {
    for (const v of SCALE.tempo.voci) expect(parseDuration(v.valore)).toBe(grandezza(v.valore))
    for (const v of SCALE.recupero.voci) expect(parseDuration(v.valore)).toBe(grandezza(v.valore))
    for (const v of SCALE.durataCorsa.voci) expect(parseDuration(v.valore)).toBe(grandezza(v.valore))
  })

  it('la stima del blocco segue i metri del righello', () => {
    // «350m» non era nella lista di prima, ed è proprio il tipo di valore
    // nuovo che il righello produce: la stima deve leggerlo come una distanza.
    // Un blocco che SOMMA gli esercizi (AMRAP no, Cash In no: quelli vanno a forfait).
    const conMetri = (meters) => durataBlocco({ type: 'For Time', params: {}, exercises: [] }) +
      durataEsercizio({ name: 'SkiErg', meters })
    expect(conMetri('350m')).toBeGreaterThan(conMetri('300m'))
    expect(conMetri('400m')).toBeGreaterThan(conMetri('350m'))
  })
})

describe('il righello si posa sul valore, o vicino', () => {
  it('un valore che è una voce prende la sua tacca', () => {
    const i = indiceVicino(SCALE.peso, '82.5 kg')
    expect(SCALE.peso.voci[i].valore).toBe('82.5 kg')
  })

  it('ogni voce delle liste di prima trova una tacca vicina', () => {
    const casi = [
      ['ripetizioni', 'reps'], ['peso', 'kg'], ['pesoDoppio', 'kgDoppi'], ['metri', 'metri'], ['tempo', 'tempo'],
      ['recupero', 'rest'], ['round', 'round'], ['passoCorsa', 'passoCorsa'], ['passoErgo', 'passoErgo'],
      ['cadenza', 'cadenza'], ['velocita', 'velocita'], ['durataCorsa', 'durataCorsa'], ['distanzaCorsa', 'distanzaCorsa'],
    ]
    for (const [scala, vecchia] of casi) {
      for (const valore of VECCHIE[vecchia]) {
        const voce = SCALE[scala].voci[indiceVicino(SCALE[scala], valore)]
        const errore = Math.abs(grandezza(voce.valore) - grandezza(valore))
        // Vicino vuol dire entro mezzo scatto della scala in quel punto: la
        // distanza dalla tacca accanto è uno scatto intero.
        const i = SCALE[scala].voci.indexOf(voce)
        const vicine = [SCALE[scala].voci[i - 1], SCALE[scala].voci[i + 1]].filter(Boolean)
        const scatto = Math.max(...vicine.map(v => Math.abs(grandezza(v.valore) - grandezza(voce.valore))))
        expect(errore, `${scala}: ${valore} → ${voce.valore}`).toBeLessThanOrEqual(scatto / 2)
      }
    }
  })

  it('un «1:37» scritto a mano si posa sulla tacca vicina, non sullo zero', () => {
    // Sopra il minuto la scala va di quindici secondi: 1:30 è la più vicina.
    expect(SCALE.tempo.voci[indiceVicino(SCALE.tempo, '1:37')].valore).toBe('1:30')
  })

  it('un valore che non è una misura apre sulla voce di partenza', () => {
    for (const vuoto of ['-', 'Max', '', undefined, 'Z2']) {
      expect(SCALE.ripetizioni.voci[indiceVicino(SCALE.ripetizioni, vuoto)].valore).toBe('10')
    }
  })
})

describe('scritto a mano', () => {
  it('i tempi si scrivono come sul microonde', () => {
    expect(valoreDaTesto('tempo', '130')).toBe('1:30')
    expect(valoreDaTesto('tempo', '1:30')).toBe('1:30')
    expect(valoreDaTesto('tempo', '1.30')).toBe('1:30')
    expect(valoreDaTesto('tempo', '2')).toBe('2:00')
    expect(valoreDaTesto('tempo', '1230')).toBe('12:30')
    expect(valoreDaTesto('recupero', '45')).toBe('45:00')
  })

  it('un tempo impossibile non passa', () => {
    expect(valoreDaTesto('tempo', '190')).toBeNull()   // 1:90
    expect(valoreDaTesto('tempo', 'abc')).toBeNull()
    expect(valoreDaTesto('tempo', '')).toBeNull()
    expect(valoreDaTesto('tempo', '0')).toBeNull()
  })

  it('il passo prende la sua unità', () => {
    expect(valoreDaTesto('passoCorsa', '350')).toBe('3:50 /km')
    expect(valoreDaTesto('passoErgo', '1:58')).toBe('1:58 /500m')
  })

  it('il peso accetta la virgola e resta esatto', () => {
    expect(valoreDaTesto('peso', '83')).toBe('83 kg')
    expect(valoreDaTesto('peso', '82,5')).toBe('82.5 kg')
    expect(valoreDaTesto('pesoDoppio', '24')).toBe('2x24 kg')
  })

  it('le ripetizioni sono intere', () => {
    expect(valoreDaTesto('ripetizioni', '15')).toBe('15')
    expect(valoreDaTesto('ripetizioni', '15,5')).toBeNull()
    expect(valoreDaTesto('ripetizioni', '0')).toBeNull()
  })

  it('la distanza di corsa capisce da sola metri e chilometri', () => {
    expect(valoreDaTesto('distanzaCorsa', '400')).toBe('400m')
    expect(valoreDaTesto('distanzaCorsa', '5')).toBe('5 km')
    expect(valoreDaTesto('distanzaCorsa', '21,1')).toBe('21.1 km')
  })

  it('la velocità ha sempre un decimale, come la lista di prima', () => {
    expect(valoreDaTesto('velocita', '12')).toBe('12.0 km/h')
  })

  it('la digitazione riparte dal numero, senza unità', () => {
    expect(testoDaValore('82.5 kg')).toBe('82,5')
    expect(testoDaValore('2x24 kg')).toBe('24')
    expect(testoDaValore('3:50 /km')).toBe('3:50')
    expect(testoDaValore('250m')).toBe('250')
    expect(testoDaValore('-')).toBe('')
    expect(testoDaValore('Max')).toBe('')
  })
})

describe('il numero grande', () => {
  it('si legge all italiana e senza unità', () => {
    expect(etichettaDi(SCALE.peso, '82.5 kg')).toBe('82,5')
    expect(etichettaDi(SCALE.peso, '83 kg')).toBe('83')          // scritto a mano, non è una tacca
    expect(etichettaDi(SCALE.pesoDoppio, '2x24 kg')).toBe('2×24')
    expect(etichettaDi(SCALE.passoCorsa, '3:50 /km')).toBe('3:50')
    expect(etichettaDi(SCALE.durataCorsa, '45 min')).toBe('45′')
    expect(etichettaDi(SCALE.ripetizioni, '-')).toBe('—')
  })

  it('la distanza di corsa dice la sua unità', () => {
    expect(unitaDi('distanzaCorsa', '400m')).toBe('m')
    expect(unitaDi('distanzaCorsa', '5 km')).toBe('km')
    expect(unitaDi('peso', '9 kg')).toBe('kg')
  })
})
