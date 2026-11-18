// Creative asset di App Store Connect (iOS 27) per intestazione della pagina prodotto e risultati
// di ricerca. Specifiche (18/11/2026, creative-assets-specifications), PNG senza alfa:
//   universale    16:9  5244×2950  area sicura 1402×962 a (1921, 660)  → intestazione + ricerca
//   intestazione  21:9  3840×1646  area sicura 1646×661 a (1097, 493)
// Nell'area sicura solo logo e frase; i telefoni stanno fuori, possono essere tagliati.
// Scelte del committente (18/11): logo molto grande, «Allenati. Migliora.», Home coach + Home
// atleta, niente persone, niente timer.
//   node tools/app-store-schermate/universale.mjs <cartella con node_modules/puppeteer-core> [--guide]
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
const require = createRequire(process.argv[2].replace(/\/?$/, '/') + 'x.js')
const puppeteer = require('puppeteer-core')
const GUIDE = process.argv.includes('--guide')
const QUI = new URL('./', import.meta.url).pathname
const OUT = QUI + 'out/universale/'
mkdirSync(OUT, { recursive: true })
const b64 = (p) => 'data:image/png;base64,' + readFileSync(QUI + p).toString('base64')
const LOGO = b64('../../src/assets/marchio/pushfit-logo.png')
const COACH = b64('out/1206x2622/05-coach-home.png')
const ATLETA = b64('out/1206x2622/01-atleta-home.png')

const FORMATI = [
  { nome: 'pushfit-universale-5244x2950', W: 5244, H: 2950, S: { x: 1921, y: 660, w: 1402, h: 962 } },
  { nome: 'pushfit-intestazione-3840x1646', W: 3840, H: 1646, S: { x: 1097, y: 493, w: 1646, h: 661 } },
]

function pagina({ W, H, S }) {
  const cx = S.x + S.w / 2, cy = S.y + S.h / 2
  const logoW = S.w * 0.92                      // il logo riempie quasi tutta l'area sicura
  const fraseFs = Math.round(S.h * 0.105)
  const telH = H * 0.92                         // telefoni alti quasi quanto l'immagine
  const telW = telH * 1206 / 2622
  const scarto = S.w / 2 + telW * 0.62          // dal centro ai telefoni, fuori dall'area sicura
  const tel = (img, lato) => `<div class="tel" style="height:${telH}px;left:${cx + lato * scarto - telW / 2}px;top:${H * 0.12}px;transform:rotate(${lato * 8}deg)"><img src="${img}"></div>`
  return `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@800;900&display=swap" rel="stylesheet">
<style>
*{margin:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;background:#0B0B0B;font-family:Inter,sans-serif;position:relative}
.alone{position:absolute;left:${cx}px;top:${cy}px;width:${W * 0.75}px;height:${H * 1.1}px;transform:translate(-50%,-50%);
  background:radial-gradient(closest-side,rgba(241,197,23,.30),rgba(241,197,23,0))}
.tel{position:absolute;aspect-ratio:1206/2622;border-radius:${telW * 0.11}px;overflow:hidden;border:${telW * 0.018}px solid #2a2a2a;
  box-shadow:0 ${H * 0.02}px ${H * 0.06}px rgba(0,0,0,.8),0 0 0 2px #444;opacity:.9}
.tel img{display:block;width:100%;height:100%}
.velo{position:absolute;inset:0;background:radial-gradient(ellipse ${S.w * 0.75}px ${S.h * 0.75}px at ${cx}px ${cy}px,rgba(11,11,11,.85),rgba(11,11,11,0))}
.centro{position:absolute;left:${S.x}px;top:${S.y}px;width:${S.w}px;height:${S.h}px;display:flex;flex-direction:column;align-items:center;justify-content:center}
.logo{width:${logoW}px;filter:drop-shadow(0 ${S.h * 0.02}px ${S.h * 0.05}px rgba(0,0,0,.6))}
.frase{color:#fff;font-weight:900;font-size:${fraseFs}px;letter-spacing:-.02em;margin-top:${S.h * 0.06}px}
.frase b{color:#f1c517}
.guida{position:absolute;outline:6px dashed #0f0;left:${S.x}px;top:${S.y}px;width:${S.w}px;height:${S.h}px}
</style></head><body>
<div class="alone"></div>
${tel(COACH, -1)}${tel(ATLETA, 1)}
<div class="velo"></div>
<div class="centro"><img class="logo" src="${LOGO}"><div class="frase">Allenati. <b>Migliora.</b></div></div>
${GUIDE ? '<div class="guida"></div>' : ''}
</body></html>`
}

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' })
for (const f of FORMATI) {
  const page = await browser.newPage()
  await page.setViewport({ width: f.W, height: f.H, deviceScaleFactor: 1 })
  await page.setContent(pagina(f), { waitUntil: 'networkidle0' })
  await page.evaluate(() => document.fonts.ready)
  const file = OUT + f.nome + (GUIDE ? '-guida' : '') + '.png'
  await page.screenshot({ path: file })
  console.log(file)
  await page.close()
}
await browser.close()
