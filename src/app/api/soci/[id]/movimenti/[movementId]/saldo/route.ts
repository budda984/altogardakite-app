import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; movementId: string }> }
) {
  try {
    const { id: memberId, movementId } = await params;
    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const paymentMethod = body.payment_method || 'contanti';

    const supabase = await createClient();

    // Recupera movimento
    const { data: mv, error: mvErr } = await supabase
      .from('movements')
      .select('*')
      .eq('id', movementId)
      .eq('member_id', memberId)
      .single();

    if (mvErr || !mv) {
      return NextResponse.json({ error: 'Movimento non trovato' }, { status: 404 });
    }

    if (mv.paid) {
      return NextResponse.json({ error: 'Gia segnato come pagato' }, { status: 400 });
    }

    // Se era un addebito (amount negativo), saldarlo significa:
    // 1. marcare il movimento originale come paid
    // 2. inserire un movimento di pagamento corrispondente (positivo)
    if (mv.movement_type === 'addebito' || mv.movement_type === 'acquisto_pacchetto') {
      const debitAmount = -Number(mv.amount); // l'amount era negativo
      // Marca come pagato il movimento originale
      await supabase
        .from('movements')
        .update({ paid: true, payment_method: paymentMethod })
        .eq('id', movementId);

      // Inserisci movimento pagamento
      await supabase.from('movements').insert({
        member_id: memberId,
        movement_type: 'pagamento',
        description: `Saldo: ${mv.description}`,
        amount: debitAmount,
        lift_delta: 0,
        paid: true,
        payment_method: paymentMethod,
        created_by: auth.userId,
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Movimento non saldabile' }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
