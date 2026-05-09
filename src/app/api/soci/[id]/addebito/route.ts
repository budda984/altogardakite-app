import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';
import { chargeServiceSchema } from '@/lib/validation/admin-schemas';

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
    const parsed = chargeServiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const data = parsed.data;

    const { data: service, error: svcErr } = await supabase
      .from('services')
      .select('*')
      .eq('id', data.service_id)
      .single();

    if (svcErr || !service) {
      return NextResponse.json({ error: 'Servizio non trovato' }, { status: 404 });
    }

    const total = Number(data.unit_price) * Number(data.quantity);
    const description =
      service.name +
      (data.quantity > 1 ? ` (×${data.quantity})` : '') +
      (Number(data.unit_price) !== Number(service.unit_price) ? ' [prezzo personalizzato]' : '');

    // Se pagato subito: pagamento (entrata)
    // Altrimenti: addebito (debito)
    const movementType = data.paid_now ? 'pagamento' : 'addebito';
    const amount = data.paid_now ? total : -total;

    const { data: created, error } = await supabase
      .from('movements')
      .insert({
        member_id: memberId,
        movement_type: movementType,
        description,
        amount,
        lift_delta: 0,
        service_id: service.id,
        paid: data.paid_now,
        payment_method: data.paid_now ? data.payment_method : null,
        notes: data.notes || null,
        created_by: auth.userId,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
