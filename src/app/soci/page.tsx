import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Plus, Search, ChevronRight, AlertCircle } from 'lucide-react';
import { formatDate, calcAge } from '@/lib/utils';

export default async function MembersListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('members')
    .select('id, membership_number, first_name, last_name, email, phone, birth_date, is_minor, active, registered_at')
    .order('last_name', { ascending: true });

  if (q) {
    query = query.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,fiscal_code.ilike.%${q}%`
    );
  }

  const { data: members, error } = await query;

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <div className="text-xs uppercase tracking-widest text-text-dim mb-2">Anagrafica</div>
          <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tightest">
            Soci
          </h1>
          <p className="mt-2 text-text-muted text-sm">
            {members?.length ?? 0} {members?.length === 1 ? 'socio registrato' : 'soci registrati'}
          </p>
        </div>
        <Link
          href="/soci/nuovo"
          className="inline-flex items-center gap-2 bg-accent text-bg px-4 py-2.5 rounded-md text-sm font-medium hover:bg-accent-hover transition-colors self-start"
        >
          <Plus className="h-4 w-4" /> Nuovo socio
        </Link>
      </header>

      {/* Search */}
      <form className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-dim" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Cerca per nome, cognome, email o codice fiscale..."
            className="w-full bg-bg-input border border-border rounded-md pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
      </form>

      {error && (
        <div className="bg-danger/10 border border-danger/30 text-danger p-4 rounded-md mb-4 flex gap-3 items-start">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div>
            <div className="font-medium">Errore caricamento soci</div>
            <div className="text-sm">{error.message}</div>
            <div className="text-xs mt-2 text-text-muted">
              Hai gia eseguito la migrazione database? Vedi README.md
            </div>
          </div>
        </div>
      )}

      {members && members.length === 0 && !error && (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <div className="text-text-muted text-sm mb-4">
            {q ? 'Nessun socio trovato' : 'Nessun socio ancora registrato'}
          </div>
          {!q && (
            <Link
              href="/soci/nuovo"
              className="inline-flex items-center gap-2 text-accent hover:underline text-sm"
            >
              Registra il primo socio <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      )}

      {members && members.length > 0 && (
        <div className="rounded-lg border border-border bg-bg-surface overflow-hidden">
          <div className="hidden lg:grid grid-cols-[60px_2fr_2fr_1fr_100px_60px] gap-4 px-5 py-3 border-b border-border text-xs uppercase tracking-wider text-text-dim font-medium">
            <div>N°</div>
            <div>Nome</div>
            <div>Contatti</div>
            <div>Eta</div>
            <div>Stato</div>
            <div></div>
          </div>
          <div className="divide-y divide-border">
            {members.map((m) => (
              <Link
                key={m.id}
                href={`/soci/${m.id}`}
                className="block lg:grid lg:grid-cols-[60px_2fr_2fr_1fr_100px_60px] gap-4 px-5 py-4 hover:bg-bg-elevated transition-colors"
              >
                <div className="text-xs text-text-dim font-mono mb-1 lg:mb-0">
                  #{m.membership_number}
                </div>
                <div>
                  <div className="font-medium">
                    {m.first_name} {m.last_name}
                  </div>
                  <div className="text-xs text-text-muted lg:hidden mt-0.5">
                    {m.email}
                  </div>
                </div>
                <div className="hidden lg:block text-sm text-text-muted">
                  <div>{m.email}</div>
                  <div className="text-xs">{m.phone}</div>
                </div>
                <div className="text-sm hidden lg:block">
                  {calcAge(m.birth_date)} anni
                  {m.is_minor && <span className="ml-1 text-xs text-warning">(min)</span>}
                </div>
                <div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      m.active
                        ? 'bg-success/10 text-success'
                        : 'bg-text-dim/10 text-text-dim'
                    }`}
                  >
                    {m.active ? 'Attivo' : 'Non attivo'}
                  </span>
                </div>
                <ChevronRight className="hidden lg:block h-4 w-4 text-text-dim self-center" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
