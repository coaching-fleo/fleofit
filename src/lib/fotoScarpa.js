// Prepara la foto di un modello prima del caricamento: la riduce (lato lungo
// 800 px) e dice se ha lo sfondo trasparente. Nessun Supabase qui.
// `riduciFoto` usa il canvas e si prova a mano; i pezzi puri sono testati.

/** La foto salvata ha lo sfondo (non scontornata): l'URL finisce con `#sfondo`. */
export const fotoConSfondo = (url) => typeof url === 'string' && url.endsWith('#sfondo')

/** I quattro pixel d'angolo hanno alpha < 16: la foto è già scontornata. */
export function angoliTrasparenti(dati, larghezza, altezza) {
  const alpha = (x, y) => dati[(y * larghezza + x) * 4 + 3]
  const l = larghezza - 1
  const a = altezza - 1
  return [alpha(0, 0), alpha(l, 0), alpha(0, a), alpha(l, a)].every(v => v < 16)
}

/** L'estensione dal tipo che `toBlob` ha davvero prodotto (può ignorare webp e dare png). */
export const estDelBlob = (blob) => (blob?.type === 'image/webp' ? 'webp' : 'png')

const daBlob = (canvas, tipo) => new Promise(ok => canvas.toBlob(ok, tipo))

/**
 * Ridimensiona (mai ingrandisce) e converte in webp; se il browser non lo sa
 * fare torna png. `trasparente` guarda gli angoli prima dell'eventuale scrittura.
 */
export async function riduciFoto(file, lato = 800) {
  const bitmap = await createImageBitmap(file)
  const scala = Math.min(1, lato / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scala))
  const h = Math.max(1, Math.round(bitmap.height * scala))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  const trasparente = angoliTrasparenti(ctx.getImageData(0, 0, w, h).data, w, h)
  let blob = await daBlob(canvas, 'image/webp')
  if (!blob || blob.type !== 'image/webp') blob = await daBlob(canvas, 'image/png')
  return { blob, est: estDelBlob(blob), trasparente }
}
