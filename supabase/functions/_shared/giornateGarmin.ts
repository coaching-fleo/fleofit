// Sonno, HRV e dati della giornata di Garmin letti dal Push, senza Deno né rete.
//
// Garmin manda un lotto per tipo: `{ dailies: [...] }`, `{ sleeps: [...] }`,
// `{ hrv: [...] }`. Ogni riepilogo diventa UNA voce che riempie UNA colonna di
// `garmin_giornate` (giornata, sonno, hrv): il webhook tocca solo quella.
// Formato dallo Swagger del portale (29/10/2026).
// ⚠️ DA VERIFICARE al primo Push vero: i nomi delle chiavi del lotto.
// Salviamo solo i numeri elencati qui sotto: mai peso né composizione corporea,
// mai le serie di campioni (battiti, livelli del sonno).

export type ColonnaGiornata = 'giornata' | 'sonno' | 'hrv';

export type VoceGiornata = {
  garmin_user_id: string;
  giorno: string; // yyyy-MM-dd, il calendarDate di Garmin (giorno locale dell'atleta)
  colonna: ColonnaGiornata;
  valore: Record<string, number | string>;
};

/** Chiave del lotto → colonna. `bodyComps` NON c'è, di proposito. */
export const CHIAVI_GIORNATE: Record<string, ColonnaGiornata> = {
  dailies: 'giornata',
  sleeps: 'sonno',
  hrv: 'hrv',
};

const numero = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

const testo = (v: unknown): string | null =>
  typeof v === 'string' && v !== '' ? v : typeof v === 'number' ? String(v) : null;

const GIORNO = /^\d{4}-\d{2}-\d{2}$/;

type Voce = Record<string, unknown>;
type Estrattore = (r: Voce) => Record<string, number | string>;

/** Aggiunge `chiave` solo se il valore è un numero. */
function metti(o: Record<string, number | string>, chiave: string, v: number | null): void {
  if (v !== null) o[chiave] = v;
}

const giornata: Estrattore = (r) => {
  const o: Record<string, number | string> = {};
  metti(o, 'passi', numero(r.steps));
  metti(o, 'calorie', numero(r.activeKilocalories));
  const mod = numero(r.moderateIntensityDurationInSeconds);
  const vig = numero(r.vigorousIntensityDurationInSeconds);
  // Come Garmin conta gli intensi: i vigorosi valgono doppio.
  if (mod !== null || vig !== null) o.minuti_intensi = Math.round(((mod ?? 0) + 2 * (vig ?? 0)) / 60);
  metti(o, 'fc_riposo', numero(r.restingHeartRateInBeatsPerMinute));
  const stress = numero(r.averageStressLevel);
  if (stress !== null && stress >= 0) o.stress_medio = stress; // −1 = non misurato
  metti(o, 'body_battery_carica', numero(r.bodyBatteryChargedValue));
  metti(o, 'body_battery_scarica', numero(r.bodyBatteryDrainedValue));
  return o;
};

const sonno: Estrattore = (r) => {
  const o: Record<string, number | string> = {};
  const profondo = numero(r.deepSleepDurationInSeconds);
  const leggero = numero(r.lightSleepDurationInSeconds);
  const rem = numero(r.remSleepInSeconds);
  // Le ore sono le fasi di sonno; lo sveglio non conta. Senza fasi, la durata totale.
  const fasi = profondo !== null || leggero !== null || rem !== null;
  const secondi = fasi ? (profondo ?? 0) + (leggero ?? 0) + (rem ?? 0) : numero(r.durationInSeconds);
  if (secondi !== null) o.ore = Math.round((secondi / 3600) * 100) / 100;
  const min = (s: number | null) => (s === null ? null : Math.round(s / 60));
  metti(o, 'profondo_min', min(profondo));
  metti(o, 'leggero_min', min(leggero));
  metti(o, 'rem_min', min(rem));
  metti(o, 'sveglio_min', min(numero(r.awakeDurationInSeconds)));
  const punteggio = r.overallSleepScore && typeof r.overallSleepScore === 'object'
    ? r.overallSleepScore as Voce : null;
  if (punteggio) {
    metti(o, 'punteggio', numero(punteggio.value));
    const q = testo(punteggio.qualifierKey);
    if (q) o.qualita = q;
  }
  return o;
};

const hrv: Estrattore = (r) => {
  const o: Record<string, number | string> = {};
  metti(o, 'media_notte', numero(r.lastNightAvg));
  metti(o, 'picco_5min', numero(r.lastNight5MinHigh));
  return o;
};

const ESTRATTORI: Record<ColonnaGiornata, Estrattore> = { giornata, sonno, hrv };

function leggiVoce(v: unknown, colonna: ColonnaGiornata): VoceGiornata | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Voce;
  const garmin_user_id = testo(r.userId);
  const giorno = typeof r.calendarDate === 'string' && GIORNO.test(r.calendarDate) ? r.calendarDate : null;
  if (!garmin_user_id || !giorno) return null;
  return { garmin_user_id, giorno, colonna, valore: ESTRATTORI[colonna](r) };
}

/** Le voci di recupero di un corpo del Push. Le malformate si scartano senza lanciare. */
export function leggiGiornate(corpo: unknown): VoceGiornata[] {
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return [];
  const c = corpo as Record<string, unknown>;
  const fuori: VoceGiornata[] = [];
  for (const [chiave, colonna] of Object.entries(CHIAVI_GIORNATE)) {
    const lotto = c[chiave];
    if (!Array.isArray(lotto)) continue;
    for (const v of lotto) {
      const voce = leggiVoce(v, colonna);
      if (voce) fuori.push(voce);
    }
  }
  return fuori;
}
