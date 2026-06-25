import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { equipmentTransactionSchema } from '@/lib/validation/admin-schemas';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: equipmentId } = await params;
    const body = await request.json();
    const parsed = equipmentTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const data = parsed.data;

    // Inserisci transazione
    const { data: created, error: txError } = await supabase
      .from('equipment_transactions')
      .insert({
        equipment_id: equipmentId,
        transaction_type: data.transaction_type,
        transaction_date: data.transaction_date,
        amount: data.amount ?? null,
        member_id: data.member_id || null,
        buyer_name: data.buyer_name || null,
        notes: data.notes || null,
      })
      .select()
      .single();

    if (txError) {
      return NextResponse.json({ error: txError.message }, { status: 500 });
    }

    // Aggiorna stato attrezzatura in base al tipo di transazione
    let newStatus: string | null = null;
    if (['vendita', 'dismissione', 'cessione'].includes(data.transaction_type)) {
      newStatus = 'dismesso';
    } else if (data.transaction_type === 'manutenzione') {
      newStatus = 'manutenzione';
    }

    if (newStatus) {
      const { error: updErr } = await supabase
        .from('equipment')
        .update({ status: newStatus })
        .eq('id', equipmentId);
      if (updErr) {
        // transazione gia inserita; logga ma non fallire
        console.error('Errore aggiornamento status:', updErr);
      }
    }

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: equipmentId } = await params;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('equipment_transactions')
      .select('*, member:members(first_name,last_name)')
      .eq('equipment_id', equipmentId)
      .order('transaction_date', { ascending: false });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data || []);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
