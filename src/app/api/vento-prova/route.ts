import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';

// Chiede al portale cosa vedono le previsioni, senza mandare niente a nessuno
// (modalita' prova). Serve a tarare le soglie confrontandole con Windguru
// dal tablet, senza prompt dei comandi.
export async function POST() {
  const auth = await getAuth();
  if (!auth || !auth.isStaff) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const base = process.env.PORTALE_PUSH_URL;
  const secret = process.env.PUSH_CRON_SECRET;
  if (!base || !secret) {
    return NextResponse.json({
      ok: false,
      messaggio:
        'Mancano PORTALE_PUSH_URL o PUSH_CRON_SECRET nelle variabili di questo progetto Vercel.',
    });
  }

  // Stesso portale dell'invio push, altro indirizzo: niente variabili in piu'.
  let url: string;
  try {
    url = `${new URL(base).origin}/api/vento/controlla?prova=1`;
  } catch {
    return NextResponse.json({
      ok: false,
      messaggio: `PORTALE_PUSH_URL non e' un indirizzo valido: ${base}`,
    });
  }

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'x-push-secret': secret },
      signal: AbortSignal.timeout(25000),
    });
    const testo = await r.text();
    try {
      return NextResponse.json({ ok: r.ok, ...JSON.parse(testo) });
    } catch {
      return NextResponse.json({
        ok: false,
        messaggio: `Il portale ha risposto ${r.status}: ${testo.slice(0, 300)}`,
      });
    }
  } catch (e) {
    return NextResponse.json({
      ok: false,
      messaggio: `Non riesco a raggiungere il portale: ${(e as Error).message}`,
    });
  }
}
