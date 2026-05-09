import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { memberServiceUpdateSchema } from '@/lib/validation/admin-schemas';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; serviceId: string }> }
) {
  try {
    const { id: memberId, serviceId } = await params;
    const body = await request.json();
    const parsed = memberServiceUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const data = parsed.data;
    const { data: updated, error } = await supabase
      .from('member_services')
      .update({
        paid: data.paid,
        payment_date: data.payment_date || null,
        payment_method: data.payment_method || null,
        notes: data.notes || null,
      })
      .eq('id', serviceId)
      .eq('member_id', memberId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; serviceId: string }> }
) {
  try {
    const { id: memberId, serviceId } = await params;
    const supabase = await createClient();
    const { error } = await supabase
      .from('member_services')
      .delete()
      .eq('id', serviceId)
      .eq('member_id', memberId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
