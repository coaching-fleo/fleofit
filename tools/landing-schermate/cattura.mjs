import puppeteer from 'puppeteer-core'
const B = 'http://localhost:5174'
const W = 402, H = 820
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' })
const dormi = (ms) => new Promise(r => setTimeout(r, ms))
async function apri(url, { largo = false } = {}) {
  const page = await browser.newPage()
  page.on('dialog', d => d.accept())
  if (largo) await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 })
  else await page.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await page.goto(B + url, { waitUntil: 'domcontentloaded' })
  await page.addStyleTag({ content: '.fixed.top-0.left-0.z-\\[200\\]{display:none!important} *{caret-color:transparent!important}' })
  await dormi(3500)
  return page
}
const clicca = (page, testo) => page.evaluate((t) => {
  const b = [...document.querySelectorAll('button')].find(b => (b.innerText || b.getAttribute('aria-label') || '').includes(t))
  if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true
}, testo)

// Schermata che «scorre»: la pagina intera senza gli elementi fissi, più la striscia in fondo (tab bar).
async function scorrevole(url, nome) {
  const page = await apri(url)
  await page.screenshot({ path: `out/${nome}-fondo.png`, clip: { x: 0, y: H - 120, width: W, height: 120 } })
  await page.evaluate(() => { for (const el of document.querySelectorAll('body *')) { const p = getComputedStyle(el).position; if (p === 'fixed') el.style.visibility = 'hidden' } })
  await page.screenshot({ path: `out/${nome}-pagina.png`, fullPage: true })
  await page.close()
}
// Schermata ferma, così com'è a schermo (con fogli aperti).
async function ferma(url, nome, prima) {
  const page = await apri(url)
  if (prima) { for (const p of prima) { console.log(nome, p, await clicca(page, p)); await dormi(1800) } }
  await page.evaluate(() => window.scrollTo(0, 0))
  await dormi(400)
  await page.screenshot({ path: `out/${nome}.png` })
  await page.close()
}

await scorrevole('/', 'home')
await scorrevole('/create?edit=w-completo', 'builder')
await scorrevole('/athletes/at-giulia', 'atleta')
await ferma('/create?edit=w-completo', 'tipo', ['Cambia tipo di blocco'])
await ferma('/create?edit=w-completo', 'ia', ['Genera con IA'])
await ferma('/report', 'report')
const p = await apri('/create?edit=w-completo', { largo: true })
await p.screenshot({ path: 'out/desktop-builder.png' })
await p.close()
await browser.close()
