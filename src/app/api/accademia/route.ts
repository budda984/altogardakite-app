import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';

// Gestione dell'Accademia dal gestionale: categorie e video.
// GET  -> tutto l'albero (categorie con dentro i video), per la pagina staff.
// POST -> crea categoria { tipo:'categoria', nome } o video
//         { tipo:'video', categoria_id, titolo, url, descrizione }.
// DELETE ?tipo=&id= -> elimina.

// Estrae l'id di YouTube da qualunque forma di link: youtu.be/ID,
// watch?v=ID, /embed/ID, /shorts/ID, oppure l'id gia' nudo.
function estraiYoutubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s; // gia' un id
  try {
    const u = new URL(s);
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.slice(1, 12);
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    const v = u.searchParams.get('v');
    if (v && /^[\w-]{11}$/.test(v)) return v;
    const m = u.pathname.match(/\/(embed|shorts)\/([\w-]{11})/);
    if (m) return m[2];
  } catch {
    // non era un URL
  }
  return null;
}

export async function GET() {
  const auth = await getAuth();
  if (!auth?.isStaff) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const supabase = await createClient();
  const [{ data: categorie }, { data: video }] = await Promise.all([
    supabase.schema('portale').from('accademia_categorie').select('*').order('ordine'),
    supabase.schema('portale').from('accademia_video').select('*').order('ordine'),
  ]);

  const albero = (categorie ?? []).map((c) => ({
    ...c,
    video: (video ?? []).filter((v) => v.categoria_id === c.id),
  }));
  return NextResponse.json({ categorie: albero });
}

export async function POST(request: NextRequest) {
  const auth = await getAuth();
  if (!auth?.isStaff) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo non valido' }, { status: 400 });
  }

  const supabase = await createClient();

  if (body.tipo === 'categoria') {
    const nome = String(body.nome || '').trim();
    if (!nome) return NextResponse.json({ error: 'Nome mancante' }, { status: 400 });
    const { data, error } = await supabase
      .schema('portale')
      .from('accademia_categorie')
      .insert({ nome, ordine: Number(body.ordine) || 0 })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ categoria: data });
  }

  if (body.tipo === 'video') {
    const titolo = String(body.titolo || '').trim();
    const url = String(body.url || '').trim();
    const categoria_id = String(body.categoria_id || '');
    if (!titolo || !url || !categoria_id) {
      return NextResponse.json({ error: 'Titolo, link e categoria sono obbligatori.' }, { status: 400 });
    }
    const youtube_id = estraiYoutubeId(url);
    if (!youtube_id) {
      return NextResponse.json({ error: 'Link YouTube non riconosciuto.' }, { status: 400 });
    }
    const { data, error } = await supabase
      .schema('portale')
      .from('accademia_video')
      .insert({
        categoria_id,
        titolo,
        youtube_id,
        descrizione: String(body.descrizione || '').trim() || null,
        ordine: Number(body.ordine) || 0,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ video: data });
  }

  return NextResponse.json({ error: 'Tipo sconosciuto' }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuth();
  if (!auth?.isStaff) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const tipo = request.nextUrl.searchParams.get('tipo');
  const id = request.nextUrl.searchParams.get('id');
  if (!id || (tipo !== 'categoria' && tipo !== 'video')) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 });
  }

  const tabella = tipo === 'categoria' ? 'accademia_categorie' : 'accademia_video';
  const supabase = await createClient();
  const { error } = await supabase.schema('portale').from(tabella).delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
