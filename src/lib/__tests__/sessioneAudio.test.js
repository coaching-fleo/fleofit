import { describe, it, expect, afterEach } from 'vitest'

import { suonaSopraLaMusica, ripristinaSessioneAudio } from '../sessioneAudio'

// Perché questi test esistono
// ────────────────────────────
// I beep del timer fermavano Spotify (anche su una cassa Bluetooth). Su iPhone
// la cura è chiedere a WebKit una sessione «ambient», che si mescola con la
// musica; alla chiusura del timer si torna ad «auto», o le note vocali e il
// resto dell'app resterebbero in «ambient».

afterEach(() => { delete navigator.audioSession })

describe('sessioneAudio — i beep sopra la musica', () => {
  it('col timer aperto chiede «ambient», alla chiusura torna «auto»', () => {
    navigator.audioSession = { type: 'auto' }
    suonaSopraLaMusica()
    expect(navigator.audioSession.type).toBe('ambient')
    ripristinaSessioneAudio()
    expect(navigator.audioSession.type).toBe('auto')
  })

  it('dove l\'API non c\'è (Android, browser vecchi) non fa niente e non si rompe', () => {
    expect(() => { suonaSopraLaMusica(); ripristinaSessioneAudio() }).not.toThrow()
  })
})
