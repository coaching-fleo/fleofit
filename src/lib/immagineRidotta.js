// Gli screenshot allegati a una segnalazione, ridotti PRIMA di partire.
//
// Uno screenshot di un iPhone recente è 1290×2796, cioè 3–4 MB in base64:
// oltre il limite del server (LIMITI.byteImmagineMax) e lento da caricare
// proprio quando la rete è spesso il problema che si sta segnalando.

const LATO_MAX = 1280
const QUALITA = 0.7

/** Il lato lungo a `max`, senza deformare; un'immagine già piccola non si ingrandisce. */
export function dimensioniRidotte(larghezza, altezza, max = LATO_MAX) {
  const scala = Math.min(1, max / Math.max(larghezza, altezza))
  return { larghezza: Math.round(larghezza * scala), altezza: Math.round(altezza * scala) }
}

/**
 * Legge un File dalla galleria e lo restituisce come JPEG ridotto, in base64
 * senza il prefisso `data:` (è il formato che Resend vuole negli allegati).
 * @returns {Promise<{ nome: string, base64: string }>}
 */
export function riduciImmagine(file) {
  return new Promise((risolvi, rifiuta) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const { larghezza, altezza } = dimensioniRidotte(img.naturalWidth, img.naturalHeight)
        const tela = document.createElement('canvas')
        tela.width = larghezza
        tela.height = altezza
        tela.getContext('2d').drawImage(img, 0, 0, larghezza, altezza)
        const base64 = tela.toDataURL('image/jpeg', QUALITA).split(',')[1]
        const nome = `${(file.name || 'screenshot').replace(/\.[^.]+$/, '')}.jpg`
        risolvi({ nome, base64 })
      } catch (e) {
        rifiuta(e)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      rifiuta(new Error('Immagine non leggibile'))
    }
    img.src = url
  })
}
