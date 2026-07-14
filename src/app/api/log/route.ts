import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';

/**
 * GET /api/log?before=ISO&category=booking
 * Registro attivita, dal piu recente. Paginazione con ?before= (created_at).
 * Filtro facoltativo per categoria (prefisso della action: booking, member,
 * outing, absence, user).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const before = request.nextUrl.searchParams.get('before');
    const category = request.nextUrl.searchParams.get('category');
    const LIMIT = 50;

    const supabase = await createClient();
    let query = supabase
      .from('activity_log')
      .select('id, created_at, actor_name, action, description')
      .order('created_at', { ascending: false })
      .limit(LIMIT);

    if (before) query = query.lt('created_at', before);
    if (category) query = query.like('action', `${category}.%`);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      entries: data || [],
      hasMore: (data || []).length === LIMIT,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
