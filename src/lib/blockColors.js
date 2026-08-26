// Codifica colore dei blocchi e delle categorie: LA fonte unica.
//
// Esistevano 4 copie divergenti (WorkoutDetail, CreateWorkout, TVDashboard e una
// forma diversa in Calendar). Il builder usava border-[#444] dove le altre usavano
// #333, e TVDashboard non aveva il campo hex. Unificate su #333, che è il bordo di
// default del design system e il valore di 2 file su 3.
//
// È La Regola della Corsia di DESIGN.md: ogni categoria ha un colore e uno solo,
// e quel colore attraversa puntino, bordo in hover, pillola, icona e glow.
import { RUNNING, CUSTOM, EVENTO } from './colori'

export const TYPE_COLORS = {
  'WarmUp':   { text: 'text-gray-400', bg: 'bg-[#2a2a2a]', border: 'border-[#383838]', hex: '#9ca3af' },
  'Rest':     { text: 'text-muted',    bg: 'bg-[#1e1e1e]', border: 'border-[#2a2a2a]', hex: '#848d9c' },
  'Cash In':  { text: 'text-gray-300', bg: 'bg-[#222]',    border: 'border-[#444]',    hex: '#d1d5db' },
  'Cash Out': { text: 'text-gray-300', bg: 'bg-[#222]',    border: 'border-[#444]',    hex: '#d1d5db' },
  'ON/OFF':   { text: 'text-gray-200', bg: 'bg-[#222]',    border: 'border-[#333]',    hex: '#e5e5e5' },
  'EMOM':     { text: 'text-gray-200', bg: 'bg-[#222]',    border: 'border-[#333]',    hex: '#e5e5e5' },
  'AMRAP':    { text: 'text-gray-200', bg: 'bg-[#222]',    border: 'border-[#333]',    hex: '#e5e5e5' },
  'For Time': { text: 'text-gray-200', bg: 'bg-[#222]',    border: 'border-[#333]',    hex: '#e5e5e5' },
  'Interval': { text: 'text-gray-200', bg: 'bg-[#222]',    border: 'border-[#333]',    hex: '#e5e5e5' },
  'Running':  { text: 'text-running', bg: 'bg-running/10', border: 'border-running/30', hex: RUNNING },
  'Custom':   { text: 'text-custom', bg: 'bg-custom/10', border: 'border-custom/30', hex: CUSTOM },
  'Event':    { text: 'text-white',     bg: 'bg-white/10',     border: 'border-white/30',     hex: EVENTO },
}
