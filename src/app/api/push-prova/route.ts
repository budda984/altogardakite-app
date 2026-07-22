import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// Tester delle notifiche push (pagina Richieste).
// GET  -> elenco dei soci con almeno un dispositivo iscritto alle push.
// POST -> { member_id? }: crea un avviso di prova per quel socio (il trigger
//         lo mette in coda) e poi forza subito l'invio. Senza member_id si
//         limita a spingere la coda, come il vecchio bottone di diagnosi.

export async function GET() {
  const auth = await getAuth();
  if (!auth || !auth.isStaff) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  // Le iscrizioni stanno dietro RLS: serve l'admin (grant della 0037).
  const admin = createAdminClient();
  const { data: iscr, error } = await admin
    .schema('portale')
    .from('push_iscrizioni')
    .select('member_id');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const conteggio = new Map<string, number>();
  for (const r of iscr ?? []) {
    const id = r.member_id as string;
    conteggio.set(id, (conteggio.get(id) ?? 0) + 1);
  }
  if (conteggio.size === 0) return NextResponse.json({ soci: [] });

  const supabase = await createClient();
  const { data: membri } = await supabase
    .from('members')
    .select('id, first_name, last_name')
    .in('id', Array.from(conteggio.keys()))
    .order('first_name');

  const soci = (membri ?? []).map((m) => ({
    member_id: m.id,
    nome: `${m.first_name} ${m.last_name}`,
    dispositivi: conteggio.get(m.id) ?? 0,
  }));
  return NextResponse.json({ soci });
}

async function spingiCoda() {
  const url = process.env.PORTALE_PUSH_URL;
  const secret = process.env.PUSH_CRON_SECRET;
  if (!url || !secret) {
    return {
      ok: false,
      messaggio:
        'Mancano PORTALE_PUSH_URL o PUSH_CRON_SECRET nelle variabili di questo progetto Vercel.',
    };
  }
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'x-push-secret': secret },
      signal: AbortSignal.timeout(15000),
    });
    const testo = await r.text();
    return { ok: r.ok, stato_http: r.status, risposta_portale: testo };
  } catch (e) {
    return {
      ok: false,
      messaggio: `Non riesco a raggiungere il portale: ${(e as Error).message}`,
    };
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuth();
  if (!auth || !auth.isStaff) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  let memberId: string | null = null;
  try {
    const body = await request.json();
    if (body && typeof body.member_id === 'string') memberId = body.member_id;
  } catch {
    // corpo assente: solo spinta della coda
  }

  if (memberId) {
    const supabase = await createClient();
    const { error } = await supabase
      .schema('portale')
      .from('avvisi')
      .insert({
        member_id: memberId,
        tipo: 'messaggio',
        titolo: 'Prova notifiche',
        corpo:
          'Questa e\u0300 una notifica di prova inviata dalla segreteria. Se la leggi, funziona tutto!',
        created_by: auth.userId,
      });
    if (error) {
      return NextResponse.json({
        ok: false,
        dove: 'avviso',
        messaggio: `Non riesco a creare l'avviso di prova: ${error.message}`,
      });
    }
  }

  const esito = await spingiCoda();
  return NextResponse.json({ ...esito, avviso_creato: Boolean(memberId) });
}
