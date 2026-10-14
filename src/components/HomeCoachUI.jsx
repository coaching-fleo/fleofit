// HomeCoachUI.jsx — i pezzi visivi della Home del coach.
//
// Stesso patto di HomeAtletaUI.jsx: SOLA PRESENTAZIONE. Ricevono numeri già
// calcolati (src/lib/statisticheCoach.js) e callback già esistenti. Se qui
// dentro compare una `supabase`, un `useEffect` o una regola su cosa conta
// come "fermo", è finito nel file sbagliato.
//
// Dal 14/10/2026 qui restano solo testata, barra di ricerca, Live Coach Cam e
// la riga di destinazione: il corpo della Home coach (polso, oggi, segnali,
// da smaltire, settimana, gare) sta in CruscottoCoachUI.jsx, condiviso con il
// desktop. L'eroe dei feedback, la squadra, i fermi, la copertura e gli
// scaduti di prima sono usciti con il loro codice: la storia è in
// docs/memoria/home-coach.md.

import { FolderArchive, ChevronRight, Mic, Search } from 'lucide-react'
import { META } from '../lib/stiliCard'

// ── Header ────────────────────────────────────────────────────────────────
// Il logo resta, al contrario della Home atleta: il coach usa anche la web app,
// e qui il marchio distingue le due superfici. Ma perde una taglia e guadagna
// sopra la riga che serve davvero — la data e quanti atleti segue.
export function HeaderCoach({ dataOggi, atleti, inPausa = 0, azioni }) {
  return (
    <div className="flex items-center justify-between gap-3 px-0.5 pt-1.5 pb-0.5">
      <div className="min-w-0">
        <p className={`${META} mb-[3px] first-letter:uppercase`}>
          {dataOggi}{atleti > 0 ? ` · ${atleti} ${atleti === 1 ? 'atleta' : 'atleti'}` : ''}
          {inPausa > 0 && <span className="text-[#5b6070]"> · {inPausa} in pausa</span>}
        </p>
        <h1 className="text-[26px] font-black tracking-[-.03em] leading-none text-white">
          FLEO<span className="text-brand">FIT</span>{' '}
          <span className="text-[19px] font-extrabold tracking-[-.02em] text-muted">Coach</span>
        </h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">{azioni}</div>
    </div>
  )
}

// ── «Cerca con l'IA» (09/10/2026) ─────────────────────────────────────────
// Una barra sotto la testata, e non un terzo bottone tondo accanto a
// notifiche e impostazioni: con tre bottoni la riga «ven 9 ottobre · 10
// atleti · 1 in pausa» andava a capo. E una barra che dice cosa si può cercare
// si scopre da sola, un'icona no. Apre il foglio: il microfono sta lì dentro.
export function BarraRicerca({ onApri }) {
  return (
    <button type="button" onClick={onApri} aria-label="Cerca con l'IA"
      className="mt-3 w-full h-11 px-3.5 rounded-2xl bg-white/[.05] border border-white/10 backdrop-blur-xl
                 flex items-center gap-2.5 text-left transition active:scale-[.99] hover:border-ia/45
                 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]">
      <Search size={17} className="text-ia shrink-0" aria-hidden="true" />
      <span className="flex-1 min-w-0 truncate text-[14px] font-medium text-muted">Cerca atleti, workout, note…</span>
      <Mic size={17} className="text-ia shrink-0" aria-hidden="true" />
    </button>
  )
}

// ── Live Coach Cam ────────────────────────────────────────────────────────
// Era una sezione con titolo e card alte 76px; è diventata una barra. Non
// perché conti meno, ma perché dura quanto un allenamento: una sezione che per
// 23 ore al giorno non c'è lascia un buco nella pagina, una barra no.
export function BannerLive({ nome, dettaglio, onGuarda }) {
  return (
    <button onClick={onGuarda} aria-label={`Guarda ${nome} in allenamento`}
      className="w-full text-left rounded-[18px] px-3.5 py-3 flex items-center gap-3 transition active:scale-[.99]
                 bg-gradient-to-r from-red-500/[.16] to-red-500/[.05] border border-red-500/30
                 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] hover:border-red-500/60">
      <span aria-hidden="true" className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-pulse shadow-[0_0_10px_rgba(239,68,68,.9)]" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-extrabold text-white truncate">{nome} è in allenamento</p>
        {dettaglio && <p className="mt-0.5 text-xs font-medium text-red-300 truncate">{dettaglio}</p>}
      </div>
      <span className="shrink-0 px-3.5 py-1.5 rounded-[11px] bg-red-500 text-white text-xs font-extrabold">Guarda</span>
    </button>
  )
}


/**
 * Una destinazione in forma di riga.
 *
 * L'archivio ci arriva dall'essere una barra piena `#2a2a2a` alta 56px: è
 * materiale di lavoro del coach, non una destinazione da promuovere. Le card
 * «Calendario» e «Atleti» invece sono uscite del tutto — sono già due voci
 * della navbar (corollario della Regola dell'Eroe Unico).
 */
export function RigaDestinazione({ icona: Icona = FolderArchive, titolo, sottotitolo, onClick, label }) {
  return (
    <button onClick={onClick} aria-label={label || titolo}
      className="w-full text-left rounded-[18px] px-4 py-3.5 bg-white/[.05] border border-white/[.09]
                 shadow-[inset_0_1px_0_rgba(255,255,255,.06)] flex items-center gap-3
                 transition active:scale-[.99] hover:border-brand/40">
      <span className="w-[38px] h-[38px] rounded-full bg-white/[.07] border border-white/[.11] text-gray-200 shrink-0 flex items-center justify-center">
        <Icona size={18} aria-hidden="true" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-extrabold tracking-[-.01em] text-white truncate">{titolo}</span>
        {sottotitolo && <span className="block mt-0.5 text-xs font-medium text-muted truncate">{sottotitolo}</span>}
      </span>
      <ChevronRight size={17} className="text-[#5b6070] shrink-0" aria-hidden="true" />
    </button>
  )
}
