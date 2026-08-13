import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// Annuncio a tutti i soci con le notifiche attive.
// GET  -> quanti dispositivi/soci riceverebbero (per la conferma).
// POST -> { testo }: crea un avviso per ognuno di loro e spinge la coda.

async function sociConPush() {
  // push_iscrizioni sta dietro RLS: serve l'admin.
  const admin = createAdminClient();
  const { data, error } = await admin
    .schema('portale')
    .from('push_iscrizioni')
    .select('member_id');
  if (error) throw new Error(error.message);
  // Un socio puo' avere piu' dispositivi: conto i soci distinti.
  const soci = new Set((data ?? []).map((r) => r.member_id as string));
  return { soci: Array.from(soci), dispositivi: (data ?? []).length };
}

export async function GET() {
  const auth = await getAuth();
  if (!auth?.isStaff) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }
  try {
    const { soci, dispositivi } = await sociConPush();
    return NextResponse.json({ soci: soci.length, dispositivi });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuth();
  if (!auth?.isStaff) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  let testo = '';
  let titolo = 'Comunicazione dal circolo';
  try {
    const body = await request.json();
    testo = typeof body.testo === 'string' ? body.testo.trim() : '';
    if (typeof body.titolo === 'string' && body.titolo.trim()) {
      titolo = body.titolo.trim().slice(0, 80);
    }
  } catch {
    // corpo assente
  }

  if (!testo) {
    return NextResponse.json({ error: 'Il messaggio e\u0300 vuoto.' }, { status: 400 });
  }
  if (testo.length > 500) {
    return NextResponse.json({ error: 'Messaggio troppo lungo (max 500).' }, { status: 400 });
  }

  let soci: string[];
  try {
    ({ soci } = await sociConPush());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  if (soci.length === 0) {
    return NextResponse.json({ ok: true, inviati: 0, messaggio: 'Nessun socio con notifiche attive.' });
  }

  const supabase = await createClient();
  const righe = soci.map((member_id) => ({
    member_id,
    tipo: 'messaggio',
    titolo,
    corpo: testo,
    created_by: auth.userId,
  }));

  const { error } = await supabase.schema('portale').from('avvisi').insert(righe);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Spingo la coda.
  const url = process.env.PORTALE_PUSH_URL;
  const secret = process.env.PUSH_CRON_SECRET;
  if (url && secret) {
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'x-push-secret': secret },
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      // ignorato: la coda resta, la prende un invio successivo
    }
  }

  return NextResponse.json({ ok: true, inviati: soci.length });
}
