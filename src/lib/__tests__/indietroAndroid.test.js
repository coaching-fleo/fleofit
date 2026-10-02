import { describe, it, expect, vi, afterEach } from 'vitest'
import { gestisciIndietro, puoTornareIndietro } from '../indietroAndroid'

// jsdom non fa layout, quindi `elementFromPoint` non esiste: lo si finge,
// dicendo quale elemento sta in cima allo schermo.
function scena(html) {
  document.body.innerHTML = html
  return (sel) => {
    const el = sel ? document.querySelector(sel) : null
    document.elementFromPoint = () => el
  }
}
const finestra = { innerWidth: 400 }

afterEach(() => { document.body.innerHTML = ''; delete document.elementFromPoint })

describe('il tasto indietro di Android', () => {
  // Il velo chiude solo se React gli ha dato un onClick: lo si finge come lo
  // attacca React, con la chiave `__reactProps$…` sul nodo.
  it('con un velo che chiude, tocca il velo e NON cambia pagina', () => {
    const inCima = scena('<div id="root"><p>pagina</p></div><div id="velo"></div>')
    inCima('#velo')
    const chiudi = vi.fn()
    const velo = document.getElementById('velo')
    velo['__reactProps$abc'] = { onClick: chiudi }
    velo.addEventListener('click', chiudi)
    const torna = vi.fn()

    expect(gestisciIndietro({ puoTornare: true, finestra, torna, esci: vi.fn() })).toBe('modale')
    expect(chiudi).toHaveBeenCalled()
    expect(torna).not.toHaveBeenCalled()
  })

  // 🔴 È il caso di «Assegna workout»: il velo non fa niente, chiude la X.
  it('con un velo che NON chiude, preme la X', () => {
    const inCima = scena(`<div id="root"></div>
      <div id="velo"><div><p>Assegna Workout</p><button id="x" aria-label="Chiudi">x</button>
      <button>Conferma</button></div></div>`)
    inCima('#velo')
    const x = vi.fn()
    document.getElementById('x').addEventListener('click', x)
    expect(gestisciIndietro({ puoTornare: true, finestra, torna: vi.fn(), esci: vi.fn() })).toBe('modale')
    expect(x).toHaveBeenCalledTimes(1)
  })

  it("riconosce la X anche senza nome, dall'icona", () => {
    const inCima = scena(`<div id="root"></div>
      <div id="velo"><button id="x"><svg class="lucide lucide-x"></svg></button></div>`)
    inCima('#velo')
    const x = vi.fn()
    document.getElementById('x').addEventListener('click', x)
    gestisciIndietro({ puoTornare: true, finestra, torna: vi.fn(), esci: vi.fn() })
    expect(x).toHaveBeenCalledTimes(1)
  })

  it('senza X preme «Annulla», ma mai una frase che lo contiene', () => {
    const inCima = scena(`<div id="root"></div>
      <div id="velo"><button id="esci">No, esci</button><button id="elimina">Elimina</button>
      <button id="annulla"> Annulla </button></div>`)
    inCima('#velo')
    const premuti = []
    for (const id of ['esci', 'elimina', 'annulla'])
      document.getElementById(id).addEventListener('click', () => premuti.push(id))
    gestisciIndietro({ puoTornare: true, finestra, torna: vi.fn(), esci: vi.fn() })
    expect(premuti).toEqual(['annulla'])
  })

  // ⚠️ Una modale che sta salvando ha i bottoni spenti: niente da premere, e
  // la pagina sotto resta dov'è.
  it('se non trova come chiudere, non fa niente e non cambia pagina', () => {
    const inCima = scena(`<div id="root"></div>
      <div id="velo"><button id="x" aria-label="Chiudi" disabled>x</button><button>Salvo…</button></div>`)
    inCima('#velo')
    const x = vi.fn()
    document.getElementById('x').addEventListener('click', x)
    const torna = vi.fn()
    expect(gestisciIndietro({ puoTornare: true, finestra, torna, esci: vi.fn() })).toBe('modale')
    expect(x).not.toHaveBeenCalled()
    expect(torna).not.toHaveBeenCalled()
  })

  it('senza modali torna alla pagina precedente', () => {
    const inCima = scena('<div id="root"><header id="h"></header></div>')
    inCima('#h')
    const torna = vi.fn()
    expect(gestisciIndietro({ puoTornare: true, finestra, torna, esci: vi.fn() })).toBe('indietro')
    expect(torna).toHaveBeenCalledTimes(1)
  })

  it('dalla prima pagina esce invece di non fare niente', () => {
    const inCima = scena('<div id="root"><header id="h"></header></div>')
    inCima('#h')
    const esci = vi.fn()
    expect(gestisciIndietro({ puoTornare: false, finestra, torna: vi.fn(), esci })).toBe('esci')
    expect(esci).toHaveBeenCalledTimes(1)
  })
})

// 🔴 Il canGoBack della WebView diceva «no» con tre pagine dietro: la verità è
// nella cronologia di React Router.
describe('puoTornareIndietro', () => {
  it("legge l'indice di React Router", () => {
    expect(puoTornareIndietro({ idx: 2, key: 'x' })).toBe(true)
    expect(puoTornareIndietro({ idx: 0, key: 'default' })).toBe(false)
  })
  it("senza stato (pagina aperta da un deep link) non c'è niente dietro", () => {
    expect(puoTornareIndietro(null)).toBe(false)
  })
})
