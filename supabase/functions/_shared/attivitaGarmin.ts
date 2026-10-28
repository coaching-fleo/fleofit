// Le attività di Garmin lette dal Push, senza Deno né rete.
//
// Garmin manda i riepiloghi in un lotto: `{ activities: [...] }` (dall'orologio)
// e `{ manuallyUpdatedActivities: [...] }` (create o modificate a mano su Connect).
// ⚠️ DA VERIFICARE al primo Push vero (docs/memoria/garmin.md, «Fase 1»).
// Salviamo solo i numeri che ci servono: mai la posizione di partenza né il nome
// e la descrizione scritti dall'atleta.

export type AttivitaGarmin = {
  garminUserId: string;
  garmin_id: string;
  inizio: string; // ISO UTC
  giorno: string; // yyyy-MM-dd, giorno locale dell'atleta
  tipo: string;
  durata_s: number | null;
  distanza_m: number | null;
  dati: Record<string, unknown>;
};

const CHIAVI_LOTTO = ['activities', 'manuallyUpdatedActivities'];

const CAMPI_DATI: [string, string][] = [
  ['fc_media', 'averageHeartRateInBeatsPerMinute'],
  ['fc_max', 'maxHeartRateInBeatsPerMinute'],
  ['velocita_media_ms', 'averageSpeedInMetersPerSecond'],
  ['dislivello_m', 'totalElevationGainInMeters'],
  ['calorie', 'activeKilocalories'],
];

const numero = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

const testo = (v: unknown): string | null =>
  typeof v === 'string' && v !== '' ? v : typeof v === 'number' ? String(v) : null;

/** Il giorno (yyyy-MM-dd) a cui appartiene l'istante, nel fuso dell'atleta: somma l'offset e prende la data UTC. Non dipende dal fuso della macchina. */
export function giornoLocale(inizioSec: number, offsetSec: number): string {
  return new Date((inizioSec + offsetSec) * 1000).toISOString().slice(0, 10);
}

function leggiVoce(v: unknown): AttivitaGarmin | null {
  if (!v || typeof v !== 'object') return null;
  const a = v as Record<string, unknown>;
  const garminUserId = testo(a.userId);
  const garmin_id = testo(a.summaryId);
  const tipo = testo(a.activityType);
  const inizioSec = numero(a.startTimeInSeconds);
  if (!garminUserId || !garmin_id || !tipo || inizioSec === null) return null;

  const dati: Record<string, unknown> = {};
  for (const [chiave, campo] of CAMPI_DATI) {
    const n = numero(a[campo]);
    if (n !== null) dati[chiave] = n;
  }
  const dispositivo = testo(a.deviceName);
  if (dispositivo) dati.dispositivo = dispositivo;
  if (a.manual === true) dati.manuale = true;

  const inizio = new Date(inizioSec * 1000);
  if (Number.isNaN(inizio.getTime())) return null;
  return {
    garminUserId,
    garmin_id,
    inizio: inizio.toISOString(),
    giorno: giornoLocale(inizioSec, numero(a.startTimeOffsetInSeconds) ?? 0),
    tipo,
    durata_s: numero(a.durationInSeconds),
    distanza_m: numero(a.distanceInMeters),
    dati,
  };
}

/** Le attività di un corpo del Push. Le voci malformate si scartano senza lanciare. */
export function leggiAttivita(corpo: unknown): AttivitaGarmin[] {
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return [];
  const c = corpo as Record<string, unknown>;
  const fuori: AttivitaGarmin[] = [];
  for (const chiave of CHIAVI_LOTTO) {
    const lotto = c[chiave];
    if (!Array.isArray(lotto)) continue;
    for (const v of lotto) {
      const a = leggiVoce(v);
      if (a) fuori.push(a);
    }
  }
  return fuori;
}
