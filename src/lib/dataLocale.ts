// La data di "oggi" per il circolo, in ora italiana.
//
// new Date().toISOString() e' UTC: alle 13:32 italiane di luglio restituisce
// le 11:32, e tra mezzanotte e le 2 addirittura IL GIORNO PRIMA. Il planning
// usava quella data come "oggi", per questo le sessioni sembravano gia'
// finite due ore prima del tempo.
//
// en-CA e' l'unico locale che formatta nativamente come YYYY-MM-DD.
export function oggiItalia(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });
}
