// PrevisioneUI.jsx — i pezzi visivi del modello predittivo del carico.
//
// Stesso patto degli altri file `*UI.jsx`: SOLA PRESENTAZIONE. Ricevono un
// avviso già calcolato da `src/lib/previsione.js` e non sanno cosa voglia dire
// «da scaricare». Se qui dentro compare una soglia, è finita nel file
// sbagliato.
//
// ⚠️ I due fogli di assegnazione NON sono stati ridisegnati (CLAUDE.md
// §9-duodecies, §9-terdecies): questi pezzi si innestano nelle righe che ci
// sono, senza riscriverle. Non è la sessione del loro redesign.
//
// 🔴 IL SEMAFORO NON HA IL VERDE, ed è la regola che tiene in piedi tutto il
// resto: `avvisoAssegnazione` torna `null` per chi non ha niente da segnalare,
// e questi componenti non rendono niente. Con dodici nomi in elenco, un «tutto
// ok» accanto a undici di loro rende invisibile l'unico ambra.
//
// ⚠️ Il tono NON è l'unica cosa che dice che c'è un avviso: `testoAvviso` esiste
// perché la riga entri nell'`aria-label` del bottone che la contiene. Chi legge
// con VoiceOver non ha modo di sapere che una frazione è arancione, ed è
// l'unica informazione della riga che chiede un'azione (§9-septdecies punto 2).
//
// ⚠️ `testoAvviso` sta in `src/lib/previsione.js` e NON qui, anche se è testo:
// un file di componenti che esporta una funzione perde il Fast Refresh per
// intero (CLAUDE.md §9-octies punto 3).

import { AlertTriangle, Pause, Info, TrendingUp } from 'lucide-react'

/** Il pallino, che è l'unica parte colorata: il testo resta leggibile. */
const TONO_PUNTO = {
  allarme: 'bg-orange-500',
  attenzione: 'bg-amber-400',
  buono: 'bg-green-500',
  neutro: 'bg-[#5b6070]',
}

const TONO_TESTO = {
  allarme: 'text-orange-400',
  attenzione: 'text-gray-300',
  buono: 'text-green-400',
  neutro: 'text-[#5b6070]',
}

const ICONA = {
  carico: AlertTriangle,
  pausa: Pause,
  rientro: AlertTriangle,
  aderenza: AlertTriangle,
  accumulo: AlertTriangle,
  bias: TrendingUp,
  occasione: TrendingUp,
  senzaCarico: Info,
  storico: Info,
}

/**
 * L'avviso compatto, sotto il nome dell'atleta (o del workout) nel passo 1.
 *
 * Una riga sola e un motivo solo: è la lista in cui si sceglie, non quella in
 * cui si legge.
 */
export function RigaAvviso({ avviso }) {
  if (!avviso) return null
  const Icona = ICONA[avviso.chiave] || Info
  return (
    <span className={`flex items-center gap-1.5 mt-0.5 text-[11.5px] font-semibold leading-tight
                      ${TONO_TESTO[avviso.tono]}`}>
      <span aria-hidden="true"
        className={`shrink-0 w-1.5 h-1.5 rounded-full ${TONO_PUNTO[avviso.tono]}`} />
      <Icona size={12} aria-hidden="true" className="shrink-0 opacity-80" />
      <span className="min-w-0">{avviso.riga}</span>
    </span>
  )
}

/**
 * L'avviso per esteso, nel passo 2 — dove gli atleti scelti sono pochi e c'è
 * lo spazio per dire il perché.
 *
 * ⚠️ La frase porta sempre il numero da cui esce. È la condizione che rende
 * l'avviso rifiutabile: un avviso che non si può verificare non si discute, si
 * subisce, e la prima volta che sbaglia si smette di leggerlo.
 */
export function AvvisoEsteso({ avviso, nome }) {
  if (!avviso) return null
  const Icona = ICONA[avviso.chiave] || Info
  return (
    <div className={`rounded-2xl border p-3 flex gap-2.5 ${
      avviso.tono === 'allarme'
        ? 'bg-orange-500/[.09] border-orange-500/[.28]'
        : 'bg-white/[.04] border-white/[.09]'}`}>
      <Icona size={15} aria-hidden="true"
        className={`shrink-0 mt-0.5 ${TONO_TESTO[avviso.tono]}`} />
      <div className="min-w-0 flex flex-col gap-1">
        <p className={`text-[12.5px] font-bold leading-tight ${TONO_TESTO[avviso.tono]}`}>
          {nome ? `${nome} · ${avviso.riga}` : avviso.riga}
        </p>
        <p className="text-[12px] leading-[1.45] text-gray-400">{avviso.frase}</p>
      </div>
    </div>
  )
}

/**
 * Il velo che spiega perché i semafori non ci sono.
 *
 * ⚠️ Serve perché la lettura in più può fallire, e in quel caso l'assegnazione
 * deve continuare a funzionare esattamente come prima. Il silenzio da solo si
 * leggerebbe come «nessuno ha problemi», che è la cosa che questo modello esiste
 * per non dire mai.
 */
export function PrevisioneNonDisponibile() {
  return (
    <p className="text-[11.5px] text-[#5b6070] leading-tight px-1">
      Storico non disponibile: nessun avviso sul carico in questa lista.
    </p>
  )
}
