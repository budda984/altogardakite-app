import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';

const seasonSchema = z.object({
  start_month_day: z.string().regex(/^\d{2}-\d{2}$/, 'Formato MM-DD'),
  end_month_day: z.string().regex(/^\d{2}-\d{2}$/, 'Formato MM-DD'),
});

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'season')
    .single();
  return NextResponse.json(
    data?.value || { start_month_day: '04-01', end_month_day: '10-31' }
  );
}

export async function PUT(request: NextRequest) {
  const auth = await getAuth();
  if (!auth?.isAdmin) {
    return NextResponse.json({ error: 'Solo amministratori' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = seasonSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dati non validi', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('app_settings')
    .upsert({
      key: 'season',
      value: parsed.data,
      updated_by: auth.userId,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, value: parsed.data });
}
