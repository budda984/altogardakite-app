import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { boatSchema } from '@/lib/validation/admin-schemas';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = boatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const data = parsed.data;
    const { data: created, error } = await supabase
      .from('boats')
      .insert({
        name: data.name.trim(),
        boat_type: data.boat_type,
        registration: data.registration || null,
        capacity: data.capacity ?? null,
        active: data.active,
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
