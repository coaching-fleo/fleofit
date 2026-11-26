// Garmin · la sezione «Recupero» della scheda atleta (26/11/2026), a tessere:
// la frase, il sonno, quattro numeri con le colonnine delle ultime 7 notti,
// come ha detto di stare. Caricata con lazy() da AthleteDetail.
// Spec: docs/superpowers/specs/2026-11-26-recupero-garmin-scheda-design.md
//
// 🔴 La card non calcola niente: tutto arriva da `riepilogoRecupero`. Un dato
// che manca non ha tessera, una notte senza dato è uno spazio vuoto, una media
// che non c'è toglie pillola e riga tratteggiata. Mai uno zero inventato.
// L'arancione (orange-400) è solo per HRV, FC e sonno con un segnale.
import { Watch, Moon, Activity, Heart, BatteryCharging, Gauge, Smile } from 'lucide-react'
import { TitoloSezione } from './SchedaAtletaUI'
import { etichettaGiorno, segno } from '../lib/recuperoGarmin'
import { DOMANDE, parolaRisposta } from '../lib/comeStai'

const ARANCIO = '#fb923c'
const TESSERA = 'relative min-w-0 overflow-hidden rounded-[26px] border px-4 pt-4 pb-[15px]'
const NORMALE = 'bg-[#18181b] border-white/[.08]'
const TINTA = 'bg-[#18181b] border-orange-400/30'
const SFUMATURA = { backgroundImage: 'linear-gradient(160deg, rgba(251,146,60,.16), rgba(251,146,60,.04) 60%)' }
const CIFRA = 'mt-3.5 flex items-baseline gap-[3px] text-[38px] leading-[.95] font-extrabold tracking-[-.045em] text-white tabular-nums'
const UNITA = 'text-[15px] font-bold tracking-normal text-gray-400'
const PILLOLA = 'mt-2.5 inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-[11.5px] font-extrabold'
const LETTERE = ['D', 'L', 'M', 'M', 'G', 'V', 'S']

const TESSERE = {
  hrv: { nome: 'HRV notte', icona: Activity, valore: v => Math.round(v), unita: 'ms' },
  fc: { nome: 'FC a riposo', icona: Heart, valore: v => Math.round(v), unita: 'bpm' },
  bb: { nome: 'Body Battery', icona: BatteryCharging, valore: v => `+${Math.round(v)}`, unita: '' },
  stress: { nome: 'Stress', icona: Gauge, valore: v => Math.round(v), unita: '/100' },
}

/** Minuti → «45m», «3h 40m». */
function minuti(m) {
  const t = Math.round(Math.abs(m))
  return t >= 60 ? `${Math.floor(t / 60)}h ${String(t % 60).padStart(2, '0')}m` : `${t}m`
}

function Tessera({ fuori, children, ...resto }) {
  return (
    <div className={`${TESSERA} ${fuori ? TINTA : NORMALE}`} style={fuori ? SFUMATURA : undefined}
      {...(fuori ? { 'data-fuori': '' } : {})} {...resto}>
      {children}
    </div>
  )
}

function Capo({ icona: Icona, nome, dettaglio, fuori }) {
  return (
    <div className="flex items-center gap-2 text-[13px] font-bold text-gray-300">
      <Icona size={17} strokeWidth={2} className={fuori ? 'text-orange-400' : ''} aria-hidden="true" />
      <span className="min-w-0 truncate">{nome}</span>
      {dettaglio && <span className="ml-auto shrink-0 text-[11.5px] font-bold text-muted">{dettaglio}</span>}
    </div>
  )
}

function Pillola({ testo, fuori }) {
  return <span className={`${PILLOLA} ${fuori ? 'bg-orange-400/15 text-orange-400' : 'bg-white/[.07] text-gray-400'}`}>{testo}</span>
}

/** Le ultime 7 notti: una colonnina per notte, la media tratteggiata. */
function Colonnine({ notti, media, fuori, etichetta }) {
  const valori = notti.map(n => n.valore).filter(v => v != null)
  const tutti = media != null ? [...valori, media] : valori
  const alto = Math.max(...tutti) * 1.05
  const basso = Math.min(...tutti) * 0.7
  const scala = alto - basso || 1
  const h = (v) => 6 + ((v - basso) / scala) * 40
  return (
    <div className="relative mt-3.5" role="img" aria-label={etichetta}>
      {media != null && (
        <div data-media-riga className="absolute -inset-x-0.5 border-t-[1.5px] border-dashed border-white/30"
          style={{ bottom: `${h(media) + 16}px` }} />
      )}
      <div className="flex h-[46px] items-end gap-[5px]">
        {notti.map(n => n.valore == null
          ? <i key={n.giorno} data-notte="" data-vuota="" className="flex-1" />
          : <i key={n.giorno} data-notte="" {...(n.fila ? { 'data-fila': '' } : {})} className="flex-1 rounded-[4px]"
            style={{ height: `${h(n.valore)}px`, background: n.fila && fuori ? ARANCIO : 'rgba(255,255,255,.22)' }} />)}
      </div>
      <div className="mt-[5px] flex gap-[5px]" aria-hidden="true">
        {notti.map((n, i) => {
          const [a, m, g] = n.giorno.split('-').map(Number)
          return (
            <span key={n.giorno} className={`flex-1 text-center text-[9.5px] font-extrabold ${i === notti.length - 1 ? 'text-white' : 'text-zinc-500'}`}>
              {LETTERE[new Date(Date.UTC(a, m - 1, g)).getUTCDay()]}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function testoScarto(chiave, scarto) {
  if (scarto == null) return null
  if (scarto === 0) return 'come la media'
  return chiave === 'hrv' ? `${segno(scarto)}% sulla media` : `${segno(scarto)} sulla media`
}

function TesseraNumero({ t }) {
  const d = TESSERE[t.chiave]
  const pillola = testoScarto(t.chiave, t.scarto)
  return (
    <Tessera fuori={t.fuori} data-tessera={t.chiave}>
      <Capo icona={d.icona} nome={d.nome} fuori={t.fuori} />
      <b className={CIFRA}>{d.valore(t.valore)}{d.unita && <small className={UNITA}>{d.unita}</small>}</b>
      {pillola && <Pillola testo={pillola} fuori={t.fuori} />}
      <Colonnine notti={t.notti} media={t.media} fuori={t.fuori} etichetta={`${d.nome}, ultime 7 notti`} />
    </Tessera>
  )
}

const FASI = [
  ['profondo', 'Profondo', '#e5e7eb'], ['rem', 'REM', '#a1a1aa'],
  ['leggero', 'Leggero', '#52525b'], ['sveglio', 'Sveglio', ARANCIO],
]

function TesseraSonno({ s, oggi }) {
  const tot = Math.round(s.ore * 60)
  const scarto = s.mediaOre == null ? null : Math.round((s.ore - s.mediaOre) * 60)
  const fasi = FASI.filter(([k]) => s.fasi[k] != null)
  return (
    <Tessera fuori={s.fuori} data-tessera="sonno">
      <Capo icona={Moon} nome="Sonno" dettaglio={etichettaGiorno(s.giorno, oggi)} fuori={s.fuori} />
      <div className="flex items-end gap-[22px]">
        <div>
          <b className={CIFRA}>{Math.floor(tot / 60)}<small className={UNITA}>h</small>&thinsp;{String(tot % 60).padStart(2, '0')}<small className={UNITA}>m</small></b>
          {scarto != null && (
            <Pillola fuori={s.fuori} testo={scarto === 0 ? 'come la media' : `${scarto > 0 ? '+' : '−'}${minuti(scarto)} dalla media`} />
          )}
        </div>
        {s.punteggio != null && (
          <div className="pb-1">
            <b className="block text-[30px] leading-none font-extrabold tracking-[-.04em] text-white tabular-nums">{Math.round(s.punteggio)}</b>
            <span className="text-[11.5px] font-bold text-muted">
              punteggio{s.mediaPunteggio != null && ` · media ${Math.round(s.mediaPunteggio)}`}
            </span>
          </div>
        )}
      </div>
      {fasi.length > 0 && (
        <>
          <div className="mt-4 flex h-2 gap-[3px]" aria-hidden="true">
            {fasi.map(([k, , colore]) => s.fasi[k] > 0 && <i key={k} className="rounded-[4px]" style={{ flex: s.fasi[k], background: colore }} />)}
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {fasi.map(([k, nome, colore]) => (
              <div key={k} className="min-w-0">
                <span className="flex items-center gap-[5px] text-[11px] font-bold text-muted">
                  <i className="size-[7px] shrink-0 rounded-full" style={{ background: colore }} />{nome}
                </span>
                <b className="mt-[5px] block text-[16px] font-extrabold tracking-[-.02em] text-white">{minuti(s.fasi[k])}</b>
              </div>
            ))}
          </div>
        </>
      )}
    </Tessera>
  )
}

const BREVE = { sonno: 'Sonno', energia: 'Energia', dolori: 'Dolori', stress: 'Stress' }

/** Le quattro risposte di oggi a «Come stai»: a parole, mai col numero (regola di comeStai.js). */
function TesseraComeStai({ risposte, proprio }) {
  const date = DOMANDE.filter(d => Number.isInteger(risposte[d.chiave]))
  if (!date.length) return null
  return (
    <Tessera fuori={false} data-tessera="come-stai">
      <Capo icona={Smile} nome={proprio ? 'Come hai detto di stare' : 'Come ha detto di stare'} dettaglio="stamattina" />
      <div className="mt-3.5 grid grid-cols-4 gap-3">
        {date.map(d => {
          const v = risposte[d.chiave]
          const basso = v <= 2
          return (
            <div key={d.chiave} className="min-w-0">
              <span className="text-[12px] font-bold text-muted">{BREVE[d.chiave]}</span>
              <b className={`mt-[3px] block truncate text-[15px] font-extrabold tracking-[-.02em] ${basso ? 'text-orange-400' : 'text-white'}`}>
                {parolaRisposta(d, v)}
              </b>
              <span className="mt-2 flex gap-[3px]" aria-hidden="true">
                {[1, 2, 3, 4, 5].map(x => (
                  <i key={x} className={`h-1.5 flex-1 rounded-[3px] ${x <= v ? (basso ? 'bg-orange-400' : 'bg-gray-200') : 'bg-white/10'}`} />
                ))}
              </span>
            </div>
          )
        })}
      </div>
    </Tessera>
  )
}

export default function CardRecupero({ riepilogo, oggi = new Date(), proprio = false }) {
  if (!riepilogo) return null
  const { stato, titolo, giorni, frase, sonno, tessere, comeStai } = riepilogo
  const ultimo = [sonno?.giorno, ...tessere.map(t => t.giorno)].filter(Boolean).sort().pop()
  const segnali = stato === 'segnali'
  return (
    <section className="flex flex-col gap-2.5" aria-label="Recupero">
      <TitoloSezione titolo="Recupero" dettaglio="da Garmin" />
      <Tessera fuori={segnali} data-stato={stato}>
        <Capo icona={Watch} nome={titolo} fuori={segnali} dettaglio={giorni ? `da ${giorni} notti` : null} />
        <p className="mt-2.5 text-[15px] leading-[1.45] text-gray-200 text-pretty">
          {frase.forte && <b className="font-extrabold text-white">{frase.forte} </b>}
          {frase.testo}
          {frase.nota && <span className="text-gray-400"> {frase.nota}</span>}
        </p>
      </Tessera>
      {sonno && <TesseraSonno s={sonno} oggi={oggi} />}
      {tessere.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5">
          {tessere.map(t => <TesseraNumero key={t.chiave} t={t} />)}
        </div>
      )}
      {comeStai && <TesseraComeStai risposte={comeStai} proprio={proprio} />}
      <p className="flex items-center gap-1.5 px-1.5 text-[11.5px] font-bold text-gray-500">
        <i className="size-1.5 rounded-full bg-gray-500" aria-hidden="true" />
        Ultimo dato: {etichettaGiorno(ultimo, oggi)}{stato !== 'pochi' && ' · medie sulle 4 settimane'}
      </p>
    </section>
  )
}
