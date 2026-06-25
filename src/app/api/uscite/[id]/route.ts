import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const supabase = await createClient();

    // Verifica che non ci siano partecipanti / movimenti collegati
    const { count: participantsCount } = await supabase
      .from('outing_participants')
      .select('*', { count: 'exact', head: true })
      .eq('outing_id', id);

    if ((participantsCount || 0) > 0) {
      return NextResponse.json(
        { error: 'Impossibile eliminare: ci sono partecipanti registrati. Rimuovili prima.' },
        { status: 409 }
      );
    }

    const { error } = await supabase.from('outings').delete().eq('id', id);
    if (error) {
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
