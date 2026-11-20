import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { NOME_APP, MARCHIO_PRIMA, MARCHIO_SECONDA } from '../marchio'

// Il nome vecchio non deve tornare in una schermata (17/11/2026, FLEOFIT → PUSHFIT).
// Si guardano le righe di CODICE: i commenti possono raccontare la storia.
const RADICE = join(__dirname, '..', '..')
const SALTA = new Set(['__tests__', 'assets'])
// Gli unici file dove il prefisso vecchio deve esserci: il trasloco.
const TRASLOCO = new Set(['lib/chiaviLocali.js', 'lib/traslocoChiavi.js', 'main.jsx'])

function fileDi(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return SALTA.has(n) ? [] : fileDi(p)
    return /\.(jsx?|tsx?)$/.test(n) ? [p] : []
  })
}

const eCommento = (riga) => /^\s*(\/\/|\*|\/\*|\{\/\*)/.test(riga)

function righeCon(cerca, salta = new Set()) {
  return fileDi(RADICE).flatMap((p) => {
    const nome = relative(RADICE, p)
    if (salta.has(nome)) return []
    return readFileSync(p, 'utf8').split('\n')
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => !eCommento(r) && cerca.test(r))
      .map(({ i }) => `${nome}:${i + 1}`)
  })
}

describe('marchio', () => {
  it('il nome è le due metà del logo', () => {
    expect(NOME_APP).toBe('PUSHFIT')
    expect(MARCHIO_PRIMA + MARCHIO_SECONDA).toBe(NOME_APP)
  })

  it('nessuna schermata scrive più FLEOFIT né il logo FLEO+FIT', () => {
    expect(righeCon(/FLEOFIT|FLEO<|>FLEO\b|'FLEO'/)).toEqual([])
  })

  // 20/11/2026: la Live Activity del timer scriveva ancora «FLEO»+«FIT» in Swift, e
  // l'estensione del timer si chiamava FLEOFIT. Il test sopra guarda solo src/.
  it('il timer iOS e i nomi delle app native non scrivono più FLEOFIT', () => {
    const ios = join(RADICE, '..', 'ios', 'App')
    const file = [
      join(ios, 'FleoTimer', 'TimerLiveActivity.swift'),
      join(ios, 'App.xcodeproj', 'project.pbxproj'),
    ]
    const trovate = file.flatMap((p) => readFileSync(p, 'utf8').split('\n')
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => !/^\s*\/\//.test(r) && /"FLEO"|DisplayName = FLEOFIT/.test(r))
      .map(({ i }) => `${relative(ios, p)}:${i + 1}`))
    expect(trovate).toEqual([])
  })

  it('nessuna chiave del dispositivo usa più il prefisso fleofit_', () => {
    expect(righeCon(/fleofit_/, TRASLOCO)).toEqual([])
  })
})
