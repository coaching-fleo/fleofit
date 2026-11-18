// Screenshot per App Store dall'ambiente di prova. Misura con MISURA=63 (default, iPhone 6,3″ =
// 1206×2622, quella chiesta dal pannello il 18/11/2026) o MISURA=69 (6,9″ = 1320×2868).
// Servono i due server di .claude/launch.json «store-coach» (5192) e «store-atleta» (5193):
// VITE_DEMO_SPENTE=1 tiene spente Scarpe e Team, come nell'app inviata.
// puppeteer-core non è fra le dipendenze: si installa a parte e si passa la cartella.
//   node tools/app-store-schermate/cattura.mjs <cartella con node_modules/puppeteer-core> [scala]
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire(process.argv[2].replace(/\/?$/, '/') + 'x.js')
const puppeteer = require('puppeteer-core')
const SCALA = Number(process.argv[3] || 3)
const MISURA = process.env.MISURA || '63'
const [W, H] = MISURA === '69' ? [440, 956] : [402, 874]
const OUT = new URL(`./out/${W * SCALA}x${H * SCALA}/`, import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const COACH = 'http://localhost:5192', ATLETA = 'http://localhost:5193'
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' })
const dormi = (ms) => new Promise(r => setTimeout(r, ms))
const clicca = (page, testo) => page.evaluate((t) => {
  const b = [...document.querySelectorAll('button')].find(b => (b.innerText || b.getAttribute('aria-label') || '').includes(t))
  if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true
}, testo)

let cattura = async function (base, url, nome, { atleta = false, prima = [], scorri = 0, aspetta = 0, tocca = null } = {}) {
  const page = await browser.newPage()
  page.on('dialog', d => d.accept())
  if (atleta) await page.evaluateOnNewDocument(() => localStorage.setItem('adminRoleOverride', 'athlete'))
  await page.setViewport({ width: W, height: H, deviceScaleFactor: SCALA, isMobile: true, hasTouch: true })
  await page.goto(base + url, { waitUntil: 'domcontentloaded' })
  // via il bollino «AMBIENTE DI PROVA» e il cursore lampeggiante
  await page.addStyleTag({ content: '.fixed.top-0.left-0.z-\\[200\\]{display:none!important} *{caret-color:transparent!important}' })
  await dormi(3500)
  for (const p of prima) { console.log(nome, p, await clicca(page, p)); await dormi(1800) }
  if (tocca) { await page.mouse.click(tocca[0], tocca[1]); await dormi(300) }
  if (aspetta) await dormi(aspetta)
  if (scorri) { await page.evaluate((y) => window.scrollTo(0, y), scorri); await dormi(600) }
  await page.screenshot({ path: `${OUT}${nome}.png` })
  await page.close()
}

const SOLO = process.argv[4]
const _c = cattura; cattura = (b, u, n, o) => (!SOLO || n.includes(SOLO) ? _c(b, u, n, o) : null)
await cattura(ATLETA, '/', '01-atleta-home', { atleta: true })
await cattura(ATLETA, '/workout/w-completo', '02-atleta-scheda', { atleta: true })
await cattura(ATLETA, '/workout/w-completo', '03-atleta-timer', { atleta: true, prima: ['Avvia allenamento'], tocca: [W / 2, H - 111], aspetta: 14000 }) // tocca = il play
await cattura(ATLETA, '/calendar', '04-atleta-calendario', { atleta: true })
await cattura(COACH, '/', '05-coach-home')
await cattura(COACH, '/create?edit=w-completo', '06-coach-builder')
await cattura(COACH, '/create?edit=w-completo', '07-coach-ia', { prima: ['Genera con IA'] })
await cattura(COACH, '/athletes', '08-coach-atleti')
await cattura(COACH, '/athletes/at-giulia', '09-coach-atleta')
await cattura(COACH, '/report', '10-coach-report')
await browser.close()
