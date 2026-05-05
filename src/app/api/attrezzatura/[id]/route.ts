import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { equipmentSchema } from '@/lib/validation/admin-schemas';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = equipmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const data = parsed.data;
    const { data: updated, error } = await supabase
      .from('equipment')
      .update({
        code: data.code.trim().toUpperCase(),
        equipment_type: data.equipment_type,
        brand: data.brand || null,
        model: data.model || null,
        size: data.size || null,
        year: data.year ?? null,
        serial_number: data.serial_number || null,
        status: data.status,
        purchase_date: data.purchase_date || null,
        notes: data.notes || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Codice attrezzatura gia esistente' },
          { status: 409 }
        );
      }
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { error } = await supabase.from('equipment').delete().eq('id', id);
    if (error) {
      if (error.code === '23503') {
        return NextResponse.json(
          { error: 'Impossibile eliminare: attrezzatura usata in uscite registrate. Imposta lo stato a "Dismesso".' },
          { status: 409 }
        );
      }
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
