import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';
import { paymentSchema } from '@/lib/validation/admin-schemas';

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
    const parsed = paymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const data = parsed.data;

    // Movimento di tipo pagamento, importo positivo, gia pagato
    const { data: created, error } = await supabase
      .from('movements')
      .insert({
        member_id: memberId,
        movement_type: 'pagamento',
        description: 'Pagamento incassato',
        amount: data.amount,
        lift_delta: 0,
        paid: true,
        payment_method: data.payment_method,
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
