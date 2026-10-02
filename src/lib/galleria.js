import { Capacitor } from '@capacitor/core'
import { Media } from '@capacitor-community/media'

/**
 * Salva un'immagine nella galleria del telefono, su iOS e su Android.
 *
 * 🔴 SU ANDROID IL PLUGIN VUOLE UN ALBUM, E SENZA RIFIUTA (02/10/2026).
 * `Media.savePhoto({ path })` su iOS scrive nel Rullino; su Android
 * `@capacitor-community/media` risponde «Album identifier required» e non
 * salva niente. L'album è una cartella dentro la memoria multimediale
 * dell'app (`getAlbumsPath()`): Android la indicizza, quindi la foto compare
 * in Google Foto e in Files sotto quel nome — e non serve nessun permesso,
 * perché è spazio dell'app e non la galleria pubblica.
 */
export const ALBUM_ANDROID = 'FLEOFIT'

export async function salvaInGalleria(path, nomeFile) {
  if (Capacitor.getPlatform() !== 'android') {
    await Media.savePhoto({ path })
    return
  }
  const { path: radice } = await Media.getAlbumsPath()
  // ⚠️ `createAlbum` RIFIUTA se l'album esiste già: dalla seconda volta in poi
  // è il caso normale, quindi l'errore si ignora e il salvataggio prosegue.
  await Media.createAlbum({ name: ALBUM_ANDROID }).catch(() => {})
  await Media.savePhoto({
    path,
    albumIdentifier: `${radice}/${ALBUM_ANDROID}`,
    // Senza nome il plugin scrive «IMG_<data>»; con l'estensione tolta,
    // perché la aggiunge lui.
    ...(nomeFile ? { fileName: nomeFile.replace(/\.[^.]+$/, '') } : {}),
  })
}
