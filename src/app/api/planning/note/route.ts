import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';
import { z } from 'zod';

// Note del planning: promemoria dello staff visibili su un intervallo di
// giorni. GET restituisce quelle che coprono la data richiesta.

export async function GET(request: NextRequest) {
  const auth = await getAuth();
  if (!auth?.isStaff) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const date = request.nextUrl.searchParams.get('date');
  if (!date) {
    return NextResponse.json({ error: 'date richiesta' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('planning_note')
    .select('id, testo, data_da, data_a, created_by_name, created_at')
    .lte('data_da', date)
    .gte('data_a', date)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ note: data ?? [] });
}

const nuovaNota = z.object({
  testo: z.string().trim().min(1, 'Testo mancante').max(1000),
  data_da: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  data_a: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(request: NextRequest) {
  const auth = await getAuth();
  if (!auth?.isStaff) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo non valido' }, { status: 400 });
  }

  const p = nuovaNota.safeParse(corpo);
  if (!p.success) {
    return NextResponse.json({ error: p.error.issues[0].message }, { status: 400 });
  }
  if (p.data.data_a < p.data.data_da) {
    return NextResponse.json(
      { error: 'La data finale precede quella iniziale.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('planning_note')
    .insert({
      testo: p.data.testo,
      data_da: p.data.data_da,
      data_a: p.data.data_a,
      created_by: auth.userId,
      created_by_name: auth.profile?.display_name || auth.email || null,
    })
    .select('id, testo, data_da, data_a, created_by_name, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity(supabase, auth, 'note.create',
    `Nota planning dal ${p.data.data_da} al ${p.data.data_a}`, { nota_id: data.id });

  return NextResponse.json({ nota: data });
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuth();
  if (!auth?.isStaff) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id richiesto' }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.from('planning_note').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity(supabase, auth, 'note.delete', 'Nota planning eliminata', { nota_id: id });
  return NextResponse.json({ ok: true });
}
