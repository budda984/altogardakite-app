import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';
import { adjustCreditsSchema } from '@/lib/validation/admin-schemas';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: memberId } = await params;
    const auth = await getAuth();
    // Solo admin: rettifiche manuali del wallet sono operazione delicata
    if (!auth?.isAdmin) {
      return NextResponse.json(
        { error: 'Solo gli amministratori possono aggiustare i crediti manualmente' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = adjustCreditsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const data = parsed.data;

    const { data: pkgId, error } = await supabase.rpc('adjust_credits', {
      p_member_id: memberId,
      p_discipline: data.discipline,
      p_lifts_to_add: data.lifts_to_add,
      p_reason: data.reason.trim(),
      p_adjusted_by: auth.userId,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, package_id: pkgId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
