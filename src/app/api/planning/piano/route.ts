import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';
import { z } from 'zod';

/**
 * GET /api/planning/piano?date=YYYY-MM-DD&template_id=UUID
 * Carica il piano salvato per (giorno, sessione). Ritorna { columns: [] } se assente.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const date = request.nextUrl.searchParams.get('date');
    const templateId = request.nextUrl.searchParams.get('template_id');
    if (!date || !templateId) {
      return NextResponse.json({ error: 'date e template_id richiesti' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('planner_drafts')
      .select('columns, updated_at')
      .eq('plan_date', date)
      .eq('session_template_id', templateId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      columns: data?.columns || [],
      updated_at: data?.updated_at || null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}

const saveSchema = z.object({
  date: z.string().min(1),
  template_id: z.string().uuid(),
  columns: z.array(z.object({
    boatId: z.string().uuid(),
    instructorIds: z.array(z.string().uuid()),
    bookingIds: z.array(z.string().uuid()),
  })),
});

/**
 * PUT /api/planning/piano
 * Salva (upsert) il piano per (giorno, sessione).
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = saveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati non validi' }, { status: 400 });
    }

    const { date, template_id, columns } = parsed.data;
    const supabase = await createClient();

    const { error } = await supabase
      .from('planner_drafts')
      .upsert(
        {
          plan_date: date,
          session_template_id: template_id,
          columns,
          updated_by: auth.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'plan_date,session_template_id' }
      );

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
