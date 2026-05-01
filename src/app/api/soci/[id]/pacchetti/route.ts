import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';
import { purchasePackageSchema } from '@/lib/validation/admin-schemas';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: memberId } = await params;
    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = purchasePackageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const data = parsed.data;

    // Recupera il servizio
    const { data: service, error: svcErr } = await supabase
      .from('services')
      .select('*')
      .eq('id', data.service_id)
      .single();

    if (svcErr || !service) {
      return NextResponse.json({ error: 'Servizio non trovato' }, { status: 404 });
    }

    // Crea il pacchetto
    const { data: pkg, error: pkgErr } = await supabase
      .from('packages')
      .insert({
        member_id: memberId,
        service_id: service.id,
        service_name_snapshot: service.name,
        discipline: service.discipline,
        lifts_total: service.included_lifts,
        lifts_used: 0,
        total_price: data.total_price,
        notes: data.notes || null,
      })
      .select()
      .single();

    if (pkgErr) {
      return NextResponse.json({ error: pkgErr.message }, { status: 500 });
    }

    // Movimento: acquisto pacchetto
    // Se pagato subito: amount positivo (entrata) e paid=true
    // Se non pagato: amount negativo (debito) e paid=false
    const amount = data.paid_now ? data.total_price : -data.total_price;

    await supabase.from('movements').insert({
      member_id: memberId,
      movement_type: 'acquisto_pacchetto',
      description: service.name + (service.included_lifts > 0 ? ` (${service.included_lifts} lift)` : ''),
      amount,
      lift_delta: service.included_lifts,
      lift_discipline: service.discipline,
      package_id: pkg.id,
      service_id: service.id,
      paid: data.paid_now,
      payment_method: data.paid_now ? data.payment_method : null,
      notes: data.notes || null,
      created_by: auth.userId,
    });

    return NextResponse.json(pkg, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
