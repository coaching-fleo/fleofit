import { describe, it, expect, vi, beforeEach } from 'vitest'

const piattaforma = vi.hoisted(() => ({ valore: 'android' }))
const media = vi.hoisted(() => ({
  savePhoto: vi.fn(async () => ({})),
  getAlbumsPath: vi.fn(async () => ({ path: '/storage/media/it.federicoleo.fleofit' })),
  createAlbum: vi.fn(async () => {}),
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => piattaforma.valore } }))
vi.mock('@capacitor-community/media', () => ({ Media: media }))

import { salvaInGalleria, ALBUM_ANDROID } from '../galleria'

beforeEach(() => { vi.clearAllMocks(); piattaforma.valore = 'android' })

describe('salvaInGalleria', () => {
  // È il difetto: senza albumIdentifier il plugin su Android rifiuta.
  it('su Android passa sempre l\'album', async () => {
    await salvaInGalleria('file:///cache/x.png', 'Allenamento_storia.png')
    expect(media.savePhoto).toHaveBeenCalledWith({
      path: 'file:///cache/x.png',
      albumIdentifier: `/storage/media/it.federicoleo.fleofit/${ALBUM_ANDROID}`,
      fileName: 'Allenamento_storia',
    })
  })

  it('un album che esiste già non blocca il salvataggio', async () => {
    media.createAlbum.mockRejectedValueOnce(new Error('Album already exists'))
    await salvaInGalleria('file:///cache/x.png')
    expect(media.savePhoto).toHaveBeenCalledTimes(1)
  })

  it('su iOS resta la chiamata di sempre', async () => {
    piattaforma.valore = 'ios'
    await salvaInGalleria('file:///cache/x.png', 'x.png')
    expect(media.savePhoto).toHaveBeenCalledWith({ path: 'file:///cache/x.png' })
    expect(media.getAlbumsPath).not.toHaveBeenCalled()
  })
})
