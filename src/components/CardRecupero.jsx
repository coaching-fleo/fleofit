// Garmin · Recupero (29/10/2026): la card dell'andamento a 4 settimane di
// sonno, HRV notturna e FC a riposo, dalle righe di `garmin_giornate`.
// Caricata con lazy() da AthleteDetail (coach su /athletes/:id, atleta su /profile).
//
// 🔴 Nessuno zero inventato: un giorno senza dato interrompe la linea, una
// media che non c'è (meno di 14 valori) è «—», una metrica senza nessun valore
// non ha riga, e senza righe la card non esiste. Solo grigi e bianchi.
import { serieRecupero, METRICHE } from '../lib/recuperoGarmin'

const L = 280, A = 44, M = 4

/** 7.33 ore → `7 h 20′`. */
function oreEMinuti(ore) {
  const minuti = Math.round(ore * 60)
  return `${Math.floor(minuti / 60)} h ${String(minuti % 60).padStart(2, '0')}′`
}

const decimale = (n) => String(Math.round(n * 10) / 10).replace('.', ',')

function formatta(chiave, v) {
  if (v == null) return '—'
  return chiave === 'sonno' ? oreEMinuti(v) : `${Math.round(v)} ${chiave === 'hrv' ? 'ms' : 'bpm'}`
}

function Linea28({ punti, media, etichetta }) {
  const validi = punti.map(p => p.valore).filter(v => v != null)
  const min = Math.min(...validi, media ?? Infinity)
  const max = Math.max(...validi, media ?? -Infinity)
  const piatta = max === min
  const scala = piatta ? 1 : max - min
  const x = (i) => M + (i * (L - 2 * M)) / (punti.length - 1)
  const y = (v) => (piatta ? A / 2 : M + (1 - (v - min) / scala) * (A - 2 * M))
  const tratti = []
  let cur = []
  punti.forEach((p, i) => {
    if (p.valore == null) { if (cur.length) tratti.push(cur); cur = [] } else cur.push([x(i), y(p.valore)])
  })
  if (cur.length) tratti.push(cur)
  return (
    <svg viewBox={`0 0 ${L} ${A}`} className="w-full h-11" role="img" aria-label={etichetta}>
      {media != null && <line data-media x1={M} x2={L - M} y1={y(media)} y2={y(media)} stroke="#444" strokeWidth="1" strokeDasharray="3 3" />}
      {tratti.map((t, i) => t.length > 1
        ? <path key={i} data-linea d={`M${t.map(([a, b]) => `${a},${b}`).join('L')}`} fill="none" stroke="#fff" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
        : <circle key={i} cx={t[0][0]} cy={t[0][1]} r="2" fill="#fff" />)}
    </svg>
  )
}

export default function CardRecupero({ righe, oggi = new Date() }) {
  if (!righe || righe.length === 0) return null
  const serie = serieRecupero(righe, oggi)
  const visibili = METRICHE.map(m => ({ m, s: serie[m.chiave], ultimo: [...serie[m.chiave].punti].reverse().find(p => p.valore != null) }))
    .filter(x => x.ultimo)
  if (visibili.length === 0) return null
  return (
    <section className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-5" aria-label="Recupero">
      <h3 className="text-sm font-black tracking-tight text-white">Recupero · da Garmin</h3>
      <div className="mt-3 flex flex-col gap-4">
        {visibili.map(({ m, s, ultimo }) => (
          <div key={m.chiave} data-metrica={m.chiave}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-bold text-gray-400">{m.etichetta}</span>
              <span className="text-base font-black text-white">{formatta(m.chiave, ultimo.valore)}</span>
            </div>
            <Linea28 punti={s.punti} media={s.media} etichetta={`${m.etichetta}, ultimi 28 giorni`} />
            <p className="text-[11px] font-semibold text-gray-500">
              media 4 sett. <span data-media-testo className="text-gray-300">{s.media == null ? '—' : m.chiave === 'sonno' ? oreEMinuti(s.media) : decimale(s.media) + (m.chiave === 'hrv' ? ' ms' : ' bpm')}</span>
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
