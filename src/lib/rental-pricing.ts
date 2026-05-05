// Mappa rental_type (enum DB) → slug servizio nel listino
// Usata alla chiusura uscita per calcolare il costo del noleggio

import type { Service } from './types';

export const RENTAL_TYPE_TO_SLUG: Record<string, string> = {
  completo: 'noleggio_kite_tavola',           // Kite + tavola, €35
  solo_kite: 'noleggio_kite',                 // Kite, €30
  solo_tavola: 'noleggio_tavola',             // Tavola, €10
  solo_trapezio: 'noleggio_trapezio',         // Trapezio, €5
  solo_muta: 'noleggio_muta',                 // Muta, €10
  solo_giubbotto: 'noleggio_giubbotto_casco', // Giubbotto/casco, €5
  wing_completo: 'noleggio_wingfoil',         // Wingfoil tavola+ala, €60
  // 'solo_barra' e 'altro' non hanno mappatura: nessun addebito automatico
};

/** Trova il servizio corrispondente a un rental_type */
export function findRentalService(
  rentalType: string,
  services: Service[]
): Service | null {
  const slug = RENTAL_TYPE_TO_SLUG[rentalType];
  if (!slug) return null;
  return services.find((s) => s.slug === slug) || null;
}

/** Trova il servizio "lift singolo" della disciplina richiesta */
export function findSingleLiftService(
  discipline: string,
  services: Service[],
  isUnder18: boolean = false
): Service | null {
  const wantSlug = isUnder18 ? 'lift_singolo_under18_kw' : 'lift_singolo_kw';
  const direct = services.find((s) => s.slug === wantSlug);
  if (direct && direct.discipline === discipline) return direct;
  // Fallback: primo lift singolo della disciplina giusta
  return services.find((s) =>
    s.discipline === discipline &&
    s.included_lifts === 1 &&
    s.category === 'lift_singolo'
  ) || null;
}
