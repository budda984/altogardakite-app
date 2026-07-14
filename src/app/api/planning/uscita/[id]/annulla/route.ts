import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: outingId } = await params;
    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const body = await request.json();
    const reason = (body?.reason || '').toString().trim();
    if (!reason) {
      return NextResponse.json(
        { error: 'Motivazione obbligatoria' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: result, error } = await supabase.rpc('cancel_outing', {
      p_outing_id: outingId,
      p_cancelled_by: auth.userId,
      p_reason: reason,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logActivity(supabase, auth, 'outing.cancel',
      `Uscita annullata (motivo: ${reason})`, { outing_id: outingId });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
