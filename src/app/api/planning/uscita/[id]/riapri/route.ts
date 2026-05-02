import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: outingId } = await params;
    const auth = await getAuth();
    if (!auth?.isAdmin) {
      return NextResponse.json(
        { error: 'Solo gli amministratori possono riaprire uscite chiuse' },
        { status: 403 }
      );
    }

    const supabase = await createClient();

    const { data: result, error } = await supabase.rpc('reopen_outing', {
      p_outing_id: outingId,
      p_reopened_by: auth.userId,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
