// Le catture di cattura.mjs con un titolo sopra, per lo Store (stessa misura delle catture).
//   node tools/app-store-schermate/intestazioni.mjs <cartella con node_modules/puppeteer-core> [cartella catture]
// Titoli in TITOLI: **parola** = in giallo. Niente «Hyrox» nei titoli (marchio registrato).
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
const require = createRequire(process.argv[2].replace(/\/?$/, '/') + 'x.js')
const puppeteer = require('puppeteer-core')
const QUI = new URL('./', import.meta.url).pathname
const DA = process.argv[3] || QUI + 'out/1206x2622/'
const A = DA.replace(/\/?$/, '-titoli/')
mkdirSync(A, { recursive: true })
const [W, H] = DA.includes('1320x2868') ? [1320, 2868] : [1206, 2622]
const LOGO = 'data:image/png;base64,' + readFileSync(QUI + '../../src/assets/marchio/pushfit-logo.png').toString('base64')

const TITOLI = {
  '01-atleta-home': ['ATLETA', 'Il tuo allenamento di oggi, **pronto**.'],
  '02-atleta-scheda': ['ATLETA', 'Ogni blocco **chiaro**, prima di partire.'],
  '03-atleta-timer': ['ATLETA', 'Il timer ti **guida**, giro dopo giro.'],
  '04-atleta-calendario': ['ATLETA', 'Tutta la settimana **sott’occhio**.'],
  '05-coach-home': ['COACH', 'Chi si allena oggi, **a colpo d’occhio**.'],
  '06-coach-builder': ['COACH', 'Crea un workout in **pochi tocchi**.'],
  '07-coach-ia': ['COACH', 'Chiedi all’**IA**: riscrive i blocchi per te.'],
  '08-coach-atleti': ['COACH', 'Tutti i tuoi atleti, **in una lista**.'],
  '09-coach-atleta': ['COACH', 'Carico e andamento di **ogni atleta**.'],
  '10-coach-report': ['COACH', 'Il report della settimana, **già fatto**.'],
}
const s = W / 1206 // le misure sotto sono pensate per 1206 di larghezza
const pagina = (nome, [etichetta, titolo], img) => `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@600;800;900&display=swap" rel="stylesheet">
<style>
*{margin:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;background:#0B0B0B;font-family:Inter,sans-serif;position:relative}
.alone{position:absolute;left:50%;top:${560 * s}px;width:${1500 * s}px;height:${1500 * s}px;transform:translate(-50%,-50%);
  background:radial-gradient(closest-side,rgba(241,197,23,.22),rgba(241,197,23,0))}
.testa{position:absolute;top:${150 * s}px;left:${90 * s}px;right:${90 * s}px;text-align:center}
.logo{height:${64 * s}px;margin-bottom:${44 * s}px}
.etichetta{display:inline-block;color:#f1c517;font-weight:800;font-size:${34 * s}px;letter-spacing:.18em;
  border:${3 * s}px solid rgba(241,197,23,.45);border-radius:999px;padding:${12 * s}px ${30 * s}px;margin-bottom:${40 * s}px}
h1{color:#fff;font-weight:900;font-size:${104 * s}px;line-height:1.04;letter-spacing:-.035em}
h1 b{color:#f1c517;font-weight:900}
.tel{position:absolute;left:50%;top:${790 * s}px;width:${940 * s}px;transform:translateX(-50%);
  border-radius:${66 * s}px;overflow:hidden;border:${10 * s}px solid #2a2a2a;
  box-shadow:0 ${40 * s}px ${120 * s}px rgba(0,0,0,.7),0 0 0 ${2 * s}px #444}
.tel img{display:block;width:100%}
</style></head><body>
<div class="alone"></div>
<div class="testa"><img class="logo" src="${LOGO}"><br><span class="etichetta">${etichetta}</span>
<h1>${titolo.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</h1></div>
<div class="tel"><img src="${img}"></div></body></html>`

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' })
for (const [nome, t] of Object.entries(TITOLI)) {
  const img = 'data:image/png;base64,' + readFileSync(`${DA}${nome}.png`).toString('base64')
  const page = await browser.newPage()
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 })
  await page.setContent(pagina(nome, t, img), { waitUntil: 'networkidle0' })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `${A}${nome}.png` })
  await page.close()
}
await browser.close()
console.log(A)
