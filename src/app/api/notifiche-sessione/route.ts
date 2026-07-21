import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { spingiPush } from '@/lib/spingiPush';

// Notifica nel portale a tutti i prenotati di una sessione (giorno+template).
// La selezione dei destinatari sta nella funzione avvisa_sessione() (0033):
// staff + accettate, inclusa la lista d'attesa; escluse le richieste senza
// risposta e le rifiutate.
export async function POST(request: NextRequest) {
  const auth = await getAuth();
  if (!auth || !auth.isStaff) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  let body: {
    date?: string;
    template_id?: string;
    titolo?: string;
    corpo?: string;
    tipo?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Richiesta malformata' }, { status: 400 });
  }

  if (!body.date || !body.template_id || !body.titolo?.trim() || !body.corpo?.trim()) {
    return NextResponse.json({ error: 'Compila titolo e messaggio' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: destinatari, error } = await supabase.rpc('avvisa_sessione', {
    p_giorno: body.date,
    p_template_id: body.template_id,
    p_titolo: body.titolo.trim(),
    p_corpo: body.corpo.trim(),
    p_tipo: body.tipo || 'messaggio',
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logActivity(
    supabase,
    auth,
    'booking.notify',
    `Notifica portale "${body.titolo.trim()}" alla sessione del ${body.date}: ${(destinatari || []).length} soci`,
    { template_id: body.template_id, tipo: body.tipo || 'messaggio' }
  );

  await spingiPush();

  // destinatari = [{ member_id, nome }, ...]
  const elenco = (destinatari as Array<{ member_id: string; nome: string }> | null) ?? [];

  // Chi di loro ha le push attive? (push_iscrizioni sta dietro RLS: serve l'admin)
  let conPushIds = new Set<string>();
  let verificaPushErrore: string | null = null;
  if (elenco.length > 0) {
    const admin = createAdminClient();
    const { data: iscr, error: errIscr } = await admin
      .schema('portale')
      .from('push_iscrizioni')
      .select('member_id')
      .in('member_id', elenco.map((d) => d.member_id));
    if (errIscr) verificaPushErrore = errIscr.message;
    conPushIds = new Set((iscr ?? []).map((i) => i.member_id as string));
  }

  const conPush = elenco.filter((d) => conPushIds.has(d.member_id)).map((d) => d.nome);
  const senzaPush = elenco.filter((d) => !conPushIds.has(d.member_id)).map((d) => d.nome);

  return NextResponse.json({
    ok: true,
    avvisati: elenco.length,
    nomi: elenco.map((d) => d.nome),
    con_push: conPush,
    senza_push: senzaPush,
    verifica_push_errore: verificaPushErrore,
  });
}
