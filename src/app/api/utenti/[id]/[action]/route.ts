import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { createClient, createAdminClient } from '@/lib/supabase/server';

type Action = 'approve' | 'demote' | 'promote' | 'suspend' | 'unsuspend' | 'delete';
const VALID: Action[] = ['approve', 'demote', 'promote', 'suspend', 'unsuspend', 'delete'];

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  const { id: targetId, action } = await params;

  if (!VALID.includes(action as Action)) {
    return NextResponse.json({ error: 'Azione non valida' }, { status: 400 });
  }

  // Solo admin
  const auth = await getAuth();
  if (!auth || !auth.isAdmin) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  // Anti-lockout: nessuna azione su se stessi tranne "approve" (no-op innocuo)
  if (auth.userId === targetId && action !== 'approve') {
    return NextResponse.json(
      { error: 'Non puoi modificare il tuo stesso account' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Recupera target
  const { data: target } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', targetId)
    .single();

  if (!target) {
    return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
  }

  // Anti-lockout aggiuntivo: non puoi declassare/sospendere/cancellare l'ultimo admin
  if (
    target.role === 'admin' &&
    !target.suspended &&
    (action === 'demote' || action === 'suspend' || action === 'delete')
  ) {
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('suspended', false);

    if ((count || 0) <= 1) {
      return NextResponse.json(
        { error: 'Impossibile: deve restare almeno un amministratore attivo nel sistema.' },
        { status: 400 }
      );
    }
  }

  // Esegui azione
  switch (action as Action) {
    case 'approve': {
      const { error } = await supabase
        .from('profiles')
        .update({
          role: 'staff',
          approved_at: new Date().toISOString(),
          approved_by: auth.userId,
          suspended: false,
        })
        .eq('id', targetId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      break;
    }

    case 'promote': {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'admin', suspended: false })
        .eq('id', targetId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      break;
    }

    case 'demote': {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'staff' })
        .eq('id', targetId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      break;
    }

    case 'suspend': {
      const { error } = await supabase
        .from('profiles')
        .update({ suspended: true })
        .eq('id', targetId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      break;
    }

    case 'unsuspend': {
      const { error } = await supabase
        .from('profiles')
        .update({ suspended: false })
        .eq('id', targetId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      break;
    }

    case 'delete': {
      // Cancella sia il profile (cascade dal trigger non c'e: profiles.id e' FK con ON DELETE CASCADE
      // verso auth.users, quindi cancellando l'auth.user si pulisce tutto)
      const adminClient = createAdminClient();
      const { error } = await adminClient.auth.admin.deleteUser(targetId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      break;
    }
  }

  return NextResponse.json({ ok: true });
}
