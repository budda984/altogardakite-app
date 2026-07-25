import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// Notifica personalizzata dallo staff a un singolo socio.
// Crea un avviso (che il trigger mette in coda) e poi spinge subito la coda,
// come per la notifica di sessione. Riporta se il socio ha le push attive,
// cosi' lo staff sa se gli arrivera' sul telefono o solo dentro il portale.
export async function POST(request: NextRequest) {
  const auth = await getAuth();
  if (!auth || !auth.isStaff) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  let memberId = '';
  let testo = '';
  try {
    const body = await request.json();
    memberId = typeof body.member_id === 'string' ? body.member_id : '';
    testo = typeof body.testo === 'string' ? body.testo.trim() : '';
  } catch {
    // corpo assente
  }

  if (!memberId || !testo) {
    return NextResponse.json({ error: 'Socio o messaggio mancante.' }, { status: 400 });
  }
  if (testo.length > 500) {
    return NextResponse.json({ error: 'Messaggio troppo lungo (max 500).' }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .schema('portale')
    .from('avvisi')
    .insert({
      member_id: memberId,
      tipo: 'messaggio',
      titolo: 'Messaggio dalla segreteria',
      corpo: testo,
      created_by: auth.userId,
    });
  if (error) {
    return NextResponse.json(
      { ok: false, messaggio: `Avviso non creato: ${error.message}` },
      { status: 500 }
    );
  }

  // Ha le push attive?
  let haPush = false;
  const admin = createAdminClient();
  const { data: iscr } = await admin
    .schema('portale')
    .from('push_iscrizioni')
    .select('member_id')
    .eq('member_id', memberId)
    .limit(1);
  haPush = Boolean(iscr && iscr.length > 0);

  // Spingo la coda (fire-and-forget: l'avviso c'e' comunque).
  const url = process.env.PORTALE_PUSH_URL;
  const secret = process.env.PUSH_CRON_SECRET;
  if (url && secret) {
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'x-push-secret': secret },
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      // ignorato: la coda resta, la prende un invio successivo
    }
  }

  return NextResponse.json({ ok: true, ha_push: haPush });
}
