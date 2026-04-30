import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { memberServiceSchema } from '@/lib/validation/admin-schemas';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: memberId } = await params;
    const body = await request.json();
    const parsed = memberServiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const data = parsed.data;

    // Recupera il servizio per snapshot di nome e categoria
    const { data: service, error: svcErr } = await supabase
      .from('services')
      .select('id, name, category')
      .eq('id', data.service_id)
      .single();

    if (svcErr || !service) {
      return NextResponse.json({ error: 'Servizio non trovato' }, { status: 404 });
    }

    const total = Number(data.unit_price) * Number(data.quantity);

    const { data: created, error } = await supabase
      .from('member_services')
      .insert({
        member_id: memberId,
        service_id: data.service_id,
        service_name_snapshot: service.name,
        category: service.category,
        quantity: data.quantity,
        unit_price: data.unit_price,
        total_price: total,
        paid: data.paid,
        payment_date: data.payment_date || null,
        payment_method: data.payment_method || null,
        outing_id: data.outing_id || null,
        notes: data.notes || null,
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
