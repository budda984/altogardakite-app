import { createClient } from '@/lib/supabase/server';

export interface SeasonSettings {
  start_month_day: string; // "MM-DD"
  end_month_day: string;
}

const DEFAULT_SEASON: SeasonSettings = {
  start_month_day: '04-01',
  end_month_day: '10-31',
};

/**
 * Calcola la finestra stagionale corrente o successiva a partire da una data.
 * Se la data e' prima dell'inizio stagione → torna stagione di quest'anno.
 * Se e' dentro la stagione → torna stagione corrente.
 * Se e' dopo la fine → torna stagione del prossimo anno.
 */
export function computeSeasonWindow(
  fromDate: Date,
  settings: SeasonSettings = DEFAULT_SEASON
): { valid_from: string; valid_until: string } {
  const year = fromDate.getFullYear();
  const seasonStart = new Date(`${year}-${settings.start_month_day}T00:00:00`);
  const seasonEnd = new Date(`${year}-${settings.end_month_day}T00:00:00`);

  if (fromDate > seasonEnd) {
    // Stagione gia finita → propone la prossima
    return {
      valid_from: `${year + 1}-${settings.start_month_day}`,
      valid_until: `${year + 1}-${settings.end_month_day}`,
    };
  }

  // Dentro la stagione o prima dell'inizio: validita = oggi → fine stagione corrente
  // (oppure inizio se siamo prima dell'apertura)
  const start = fromDate < seasonStart
    ? `${year}-${settings.start_month_day}`
    : fromDate.toISOString().slice(0, 10);

  return {
    valid_from: start,
    valid_until: `${year}-${settings.end_month_day}`,
  };
}

export async function getSeasonSettings(): Promise<SeasonSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'season')
    .single();
  return (data?.value as SeasonSettings) || DEFAULT_SEASON;
}
