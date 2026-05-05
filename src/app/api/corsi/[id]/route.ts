import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { courseSchema } from '@/lib/validation/admin-schemas';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = courseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const data = parsed.data;
    const { data: updated, error } = await supabase
      .from('courses')
      .update({
        member_id: data.member_id,
        course_type: data.course_type,
        status: data.status,
        start_date: data.start_date,
        end_date: data.end_date || null,
        hours_total: data.hours_total,
        hours_completed: data.hours_completed,
        price: data.price ?? null,
        paid: data.paid,
        payment_date: data.payment_date || null,
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
    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (error) {
      if (error.code === '23503') {
        return NextResponse.json(
          { error: 'Impossibile eliminare: corso referenziato in uscite. Imposta lo stato a "Annullato".' },
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
