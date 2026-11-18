import { describe, it, expect } from 'vitest'
import {
  linkInvito, loginConCodice, dispositivo, intentAndroid, linkApp,
  codiceDaLinkApp, codiceDaReferrer, urlPlayStore, urlAppStore,
  PLAY_STORE_PUBBLICATO, APP_STORE_ID,
} from '../linkInvito'
import { normalizzaCodice } from '../codiceInvito'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36'
const PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36'

describe('linkInvito', () => {
  it('copia il link della pagina ponte, sempre sul sito', () => {
    expect(linkInvito(' 7kq2-m4xb')).toBe('https://pushfit.it/invito/7KQ2M4XB')
  })
  it('il sito riceve il codice dove l’ha sempre ricevuto', () => {
    expect(loginConCodice('7kq2m4xb')).toBe('/login?invite=7KQ2M4XB')
  })
  // 🔴 Chi incolla il link NUOVO nelle caselle deve ottenere il codice, non
  // otto lettere dell'indirizzo.
  it('🔴 il link nuovo incollato nelle caselle dà il codice', () => {
    expect(normalizzaCodice(linkInvito('7KQ2M4XB'))).toBe('7KQ2M4XB')
  })
})

describe('dispositivo', () => {
  it('riconosce iPhone, Android e PC', () => {
    expect(dispositivo(IPHONE)).toBe('ios')
    expect(dispositivo(ANDROID)).toBe('android')
    expect(dispositivo(PC)).toBe('desktop')
  })
  it('⚠️ l’iPad che si finge Mac lo tradiscono i punti di tocco', () => {
    expect(dispositivo(IPAD, 5)).toBe('ios')
    expect(dispositivo(IPAD, 0)).toBe('desktop')
  })
})

describe('intentAndroid', () => {
  it('apre l’app col deep link e altrimenti va al fallback', () => {
    const i = intentAndroid('7kq2m4xb', 'https://fleofit.vercel.app/login?invite=7KQ2M4XB')
    expect(i).toBe('intent://invito/7KQ2M4XB#Intent;scheme=fleofit;package=it.federicoleo.fleofit;' +
      'S.browser_fallback_url=https%3A%2F%2Ffleofit.vercel.app%2Flogin%3Finvite%3D7KQ2M4XB;end')
  })
})

describe('codiceDaLinkApp', () => {
  it('legge il deep link e l’universal link', () => {
    expect(codiceDaLinkApp(linkApp('7KQ2M4XB'))).toBe('7KQ2M4XB')
    expect(codiceDaLinkApp('https://fleofit.vercel.app/invito/7kq2m4xb')).toBe('7KQ2M4XB')
    expect(codiceDaLinkApp('https://pushfit.it/invito/7kq2m4xb')).toBe('7KQ2M4XB')
    expect(codiceDaLinkApp('https://www.pushfit.it/invito/7kq2m4xb')).toBe('7KQ2M4XB')
  })
  it('🔴 lascia stare gli altri link dell’app', () => {
    expect(codiceDaLinkApp('fleofit://login-callback#access_token=x')).toBeNull()
    expect(codiceDaLinkApp('fleofit://tv/1234')).toBeNull()
    expect(codiceDaLinkApp('https://altro.it/invito/7KQ2M4XB')).toBeNull()
    expect(codiceDaLinkApp('non un url')).toBeNull()
  })
})

describe('codiceDaReferrer', () => {
  it('legge il codice che il Play Store riconsegna', () => {
    expect(codiceDaReferrer('invite=7KQ2M4XB')).toBe('7KQ2M4XB')
    expect(codiceDaReferrer('utm_source=google-play&utm_medium=organic')).toBeNull()
    expect(codiceDaReferrer('')).toBeNull()
    expect(codiceDaReferrer(undefined)).toBeNull()
  })
})

describe('Store', () => {
  it('App Store punta a FLEOFIT', () => {
    expect(urlAppStore()).toBe('https://apps.apple.com/app/id6769451686')
  })

  it('senza app pubblicata non manda a una pagina che non esiste', () => {
    if (!PLAY_STORE_PUBBLICATO) expect(urlPlayStore('7KQ2M4XB')).toBeNull()
    if (!APP_STORE_ID) expect(urlAppStore()).toBeNull()
  })
})
