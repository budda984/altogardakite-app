import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PREFIXES = ['/login', '/registrati', '/api/auth', '/_next', '/favicon.ico'];
const PENDING_ALLOWED = ['/attesa', '/api/auth'];
const ADMIN_ONLY_PREFIXES = ['/utenti', '/api/utenti'];

// Il middleware gira davanti a OGNI richiesta e interroga Supabase due volte
// (chi sei, che ruolo hai). Se Supabase e' lento quelle attese non finiscono
// mai e Vercel taglia il middleware con un 504 MIDDLEWARE_INVOCATION_TIMEOUT:
// l'utente vede una pagina di errore al posto del gestionale.
// Con un tetto di tempo smettiamo di aspettare e lasciamo proseguire: non e'
// un buco di sicurezza, perche' ogni pagina e ogni API rifanno il controllo
// per conto proprio (getAuth) prima di mostrare o toccare qualcosa.
const ATTESA_MAX_MS = 4000;

async function conTimeout<T>(p: PromiseLike<T>, ms = ATTESA_MAX_MS): Promise<T | null> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<null>((r) => setTimeout(() => r(null), ms)),
  ]).catch(() => null);
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const risposta = await conTimeout(supabase.auth.getUser());
  // Supabase non ha risposto in tempo: lascio passare, decide la pagina.
  if (risposta === null) return supabaseResponse;
  const user = risposta.data.user;

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PREFIXES.some((p) => path.startsWith(p));

  // Non autenticato → redirect a login
  if (!user) {
    if (isPublic) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  // Autenticato: verifico ruolo
  const rispostaProfilo = await conTimeout(
    supabase.from('profiles').select('role, suspended').eq('id', user.id).single()
  );
  // Ruolo non leggibile in tempo: lascio passare, decide la pagina.
  if (rispostaProfilo === null) return supabaseResponse;
  const profile = rispostaProfilo.data;

  const role = profile?.role || 'pending';
  const suspended = profile?.suspended === true;
  const isStaff = (role === 'staff' || role === 'admin') && !suspended;
  const isAdmin = role === 'admin' && !suspended;

  // Pending o sospesi: solo /attesa e logout
  if (!isStaff) {
    const allowed = PENDING_ALLOWED.some((p) => path.startsWith(p));
    if (!allowed) {
      const url = request.nextUrl.clone();
      url.pathname = '/attesa';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Staff/admin gia loggato che va su login/registrati/attesa: rimanda a home
  if (path.startsWith('/login') || path.startsWith('/registrati') || path.startsWith('/attesa')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Sezioni admin-only: solo admin
  const adminOnly = ADMIN_ONLY_PREFIXES.some((p) => path.startsWith(p));
  if (adminOnly && !isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
