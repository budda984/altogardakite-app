import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { spingiPush } from '@/lib/spingiPush';

// Bottone di prova: uno staff loggato forza l'invio delle push in coda,
// senza dover usare curl. Utile per verificare la catena portale->telefono.
// Restituisce la risposta grezza dell'endpoint del portale, cosi' si vede
// se ha spedito o dove si e' inceppato.
export async function POST() {
  const auth = await getAuth();
  if (!auth || !auth.isStaff) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const url = process.env.PORTALE_PUSH_URL;
  const secret = process.env.PUSH_CRON_SECRET;

  if (!url || !secret) {
    return NextResponse.json({
      ok: false,
      dove: 'gestionale',
      messaggio:
        'Mancano PORTALE_PUSH_URL o PUSH_CRON_SECRET nelle variabili di questo progetto Vercel (agk-test).',
    });
  }

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'x-push-secret': secret },
      signal: AbortSignal.timeout(15000),
    });
    const testo = await r.text();
    return NextResponse.json({
      ok: r.ok,
      stato_http: r.status,
      risposta_portale: testo,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      dove: 'collegamento',
      messaggio: `Non riesco a raggiungere il portale: ${(e as Error).message}`,
    });
  }
}
