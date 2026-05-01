import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';
import { sessionTemplateSchema } from '@/lib/validation/admin-schemas';

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = sessionTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const data = parsed.data;
    const { data: created, error } = await supabase
      .from('session_templates')
      .insert({
        name: data.name.trim(),
        discipline: data.discipline,
        wind_session: data.wind_session || null,
        default_departure_time: data.default_departure_time,
        default_return_time: data.default_return_time,
        sort_order: data.sort_order,
        is_default: data.is_default,
        is_active: data.is_active,
        notes: data.notes || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
