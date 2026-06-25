import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { instructorSchema } from '@/lib/validation/admin-schemas';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = instructorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const data = parsed.data;
    const { data: updated, error } = await supabase
      .from('instructors')
      .update({
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        role: data.role,
        fiv_certified: data.fiv_certified,
        certifications: data.certifications,
        phone: data.phone || null,
        email: data.email ? data.email.toLowerCase().trim() : null,
        active: data.active,
        notes: data.notes || null,
      })
      .eq('id', id)
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { error } = await supabase.from('instructors').delete().eq('id', id);
    if (error) {
      // FK constraint: l'istruttore e referenziato in outing_instructors
      if (error.code === '23503') {
        return NextResponse.json(
          { error: 'Impossibile eliminare: istruttore presente in uscite registrate. Disattivalo invece.' },
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
