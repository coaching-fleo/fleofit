import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { BRAND, RUNNING, CUSTOM, IA, EVENTO, coloreCategoria, conVelo, coloreDaClasse } from '../colori'

// Perché questi test esistono
// ────────────────────────────
// BACKLOG #18. I colori del marchio erano scritti a mano in 584 punti; ora
// stanno in due posti — i token di `src/index.css` per le classi Tailwind, e
// questo modulo per canvas, SVG e style inline, dove una variabile CSS non
// verrebbe risolta.
//
// Due elenchi sono due elenchi: se divergono, l'app diventa di due colori e
// nessuno se ne accorge finché non guarda due schermate vicine. Il primo test
// qui sotto è l'unica ragione per cui è accettabile averne due.

// ⚠️ Percorso dalla radice del progetto, non da import.meta.url: sotto vitest
// quello non è un URL `file:` e fileURLToPath lo rifiuta.
const css = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf8')
const token = (nome) => {
  const m = css.match(new RegExp(`--color-${nome}:\\s*(#[0-9a-fA-F]{3,8})`))
  return m ? m[1].toLowerCase() : null
}

describe('i due elenchi di colori devono coincidere', () => {
  it.each([
    ['brand', BRAND],
    ['running', RUNNING],
    ['custom', CUSTOM],
    ['ia', IA],
  ])('--color-%s in index.css è lo stesso valore del modulo JS', (nome, valore) => {
    expect(token(nome)).toBe(valore.toLowerCase())
  })

  it('i token esistono davvero: un nome inventato non risolve', () => {
    // Controprova: senza, il test sopra passerebbe anche se la regex non
    // trovasse mai niente e confrontasse null con null.
    expect(token('inesistente')).toBeNull()
  })
})

describe('coloreCategoria', () => {
  it.each([
    ['Hyrox', BRAND],
    ['Running', RUNNING],
    ['Custom', CUSTOM],
    ['Autonomo', CUSTOM],
    ['Event', EVENTO],
  ])('%s → %s', (categoria, atteso) => {
    expect(coloreCategoria(categoria)).toBe(atteso)
  })

  it('una categoria sconosciuta ricade sul giallo, non su undefined', () => {
    expect(coloreCategoria('Boh')).toBe(BRAND)
    expect(coloreCategoria(undefined)).toBe(BRAND)
  })
})

describe('conVelo', () => {
  // ⚠️ Questi tre valori erano scritti a mano dentro uno style inline della
  // story Instagram, con i canali copiati a occhio: invisibili a qualunque
  // ricerca di "#f1ba17". Devono restare IDENTICI a com'erano, o la grafica
  // cambia senza che nessuno l'abbia deciso.
  it('riproduce esattamente i valori che erano scritti a mano', () => {
    expect(conVelo(BRAND, 0.2)).toBe('rgba(241, 186, 23, 0.2)')
    expect(conVelo(RUNNING, 0.2)).toBe('rgba(0, 148, 198, 0.2)')
    expect(conVelo(CUSTOM, 0.2)).toBe('rgba(209, 17, 73, 0.2)')
  })

  it('regge il bianco e il nero', () => {
    expect(conVelo('#ffffff', 1)).toBe('rgba(255, 255, 255, 1)')
    expect(conVelo('#000000', 0)).toBe('rgba(0, 0, 0, 0)')
  })
})

describe('coloreDaClasse', () => {
  // 🔴 Nasce da una regressione vera, del 26/08/2026. Un componente riceveva la
  // classe come prop e faceva `activeColor.includes('f1ba17')` — confrontava il
  // nome di una classe con un codice esadecimale. Nel momento in cui la classe
  // è diventata `bg-brand`, il confronto ha smesso di funzionare in silenzio e
  // TUTTI gli slider di intensità hanno cominciato a brillare di rosso, perché
  // cadevano sull'ultimo ramo del ternario.
  it.each([
    ['bg-brand', BRAND],
    ['bg-running', RUNNING],
    ['bg-custom', CUSTOM],
    ['bg-ia', IA],
    ['hover:bg-running/20', RUNNING],
    // ⚠️ `via-brand` contiene la sottostringa "ia": con un includes() ingenuo
    // un gradiente giallo diventava viola. Trovato per mutazione.
    ['via-brand', BRAND],
    ['from-brand via-brand to-custom', BRAND],
    ['bg-ia/20', IA],
  ])('%s → %s', (classe, atteso) => {
    expect(coloreDaClasse(classe)).toBe(atteso)
  })

  it('una classe sconosciuta o assente ricade sul giallo', () => {
    expect(coloreDaClasse('bg-[#333]')).toBe(BRAND)
    expect(coloreDaClasse('')).toBe(BRAND)
    expect(coloreDaClasse(undefined)).toBe(BRAND)
  })

  it('non si fa ingannare da una classe che contiene un altro token', () => {
    // "running" prima di "brand": l'ordine dei controlli conta.
    expect(coloreDaClasse('bg-running shadow-brand/30')).toBe(RUNNING)
  })
})

