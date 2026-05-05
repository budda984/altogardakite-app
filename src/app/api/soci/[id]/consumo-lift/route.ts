import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';
import { consumeLiftSchema } from '@/lib/validation/admin-schemas';

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
    const parsed = consumeLiftSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const data = parsed.data;

    // Se package_id specificato, consuma da quello. Altrimenti FIFO via funzione.
    if (data.package_id) {
      const { data: pkg, error: pkgErr } = await supabase
        .from('packages')
        .select('*')
        .eq('id', data.package_id)
        .eq('member_id', memberId)
        .single();

      if (pkgErr || !pkg) {
        return NextResponse.json({ error: 'Pacchetto non trovato' }, { status: 404 });
      }
      if (pkg.is_exhausted) {
        return NextResponse.json({ error: 'Pacchetto gia esaurito' }, { status: 400 });
      }

      const { error: updErr } = await supabase
        .from('packages')
        .update({ lifts_used: pkg.lifts_used + 1 })
        .eq('id', pkg.id);

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }

      const { error: mvErr } = await supabase.from('movements').insert({
        member_id: memberId,
        movement_type: 'consumo_lift',
        description: `Consumo lift ${data.discipline} (${pkg.service_name_snapshot})`,
        amount: 0,
        lift_delta: -1,
        lift_discipline: data.discipline,
        package_id: pkg.id,
        outing_id: data.outing_id || null,
        notes: data.notes || null,
        created_by: auth.userId,
      });

      if (mvErr) {
        return NextResponse.json({ error: mvErr.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, package_id: pkg.id });
    }

    // FIFO: usa la funzione SQL consume_lift
    const { data: result, error } = await supabase.rpc('consume_lift', {
      p_member_id: memberId,
      p_discipline: data.discipline,
      p_outing_id: data.outing_id || null,
      p_notes: data.notes || null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!result) {
      return NextResponse.json(
        { error: 'Nessun pacchetto disponibile per questa disciplina' },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, package_id: result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
