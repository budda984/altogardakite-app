// Sveglia l'invio delle push sul portale. Fire-and-forget: se fallisce, gli
// avvisi restano comunque in coda (li prenderebbe un invio successivo), e
// soprattutto NON deve far fallire l'azione dello staff che l'ha innescata.
export async function spingiPush() {
  const url = process.env.PORTALE_PUSH_URL;
  const secret = process.env.PUSH_CRON_SECRET;
  if (!url || !secret) return; // push non configurate: silenzioso

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'x-push-secret': secret },
      // non aspettiamo la fine dell'invio: bastano un paio di secondi di timeout
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // Ignorato di proposito: la coda resta, l'azione dello staff e' gia' riuscita.
  }
}
