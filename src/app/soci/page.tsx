import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  Plus, Search, ChevronRight, AlertCircle, HeartPulse, AlertTriangle,
  CalendarClock, CheckCircle2, Heart, Wind,
} from 'lucide-react';
import { calcAge } from '@/lib/utils';

export default async function MembersListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const { q, filter } = await searchParams;
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  let query = supabase
    .from('members')
    .select('id, membership_number, first_name, last_name, email, phone, birth_date, is_minor, active, member_type, expires_at, medical_cert_received, medical_cert_expires_at')
    .order('last_name', { ascending: true });

  if (q) {
    query = query.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,fiscal_code.ilike.%${q}%`
    );
  }

  if (filter === 'cert_expired') {
    query = query.eq('medical_cert_received', true).lt('medical_cert_expires_at', today);
  } else if (filter === 'cert_missing') {
    query = query.eq('medical_cert_received', false).neq('member_type', 'sostenitore');
  } else if (filter === 'cert_expiring') {
    query = query.eq('medical_cert_received', true).gte('medical_cert_expires_at', today).lte('medical_cert_expires_at', in30);
  } else if (filter === 'membership_expired') {
    query = query.lt('expires_at', today);
  } else if (filter === 'membership_expiring') {
    query = query.gte('expires_at', today).lte('expires_at', in30);
  }

  const { data: members, error } = await query;

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-text-dim mb-2">Anagrafica</div>
          <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tightest">
            Soci
          </h1>
          <p className="mt-2 text-text-muted text-sm">
            {members?.length ?? 0} {members?.length === 1 ? 'socio' : 'soci'}
            {filter ? ' (filtro attivo)' : ' totali'}
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
      <form className="mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-dim" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Cerca per nome, cognome, email o codice fiscale..."
            className="w-full bg-bg-input border border-border rounded-md pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          {q && <input type="hidden" name="filter" value={filter || ''} />}
        </div>
      </form>

      {/* Filtri rapidi */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        <Link
          href={`/soci${q ? `?q=${q}` : ''}`}
          className={`text-xs px-2.5 py-1 rounded ${!filter ? 'bg-accent text-bg' : 'bg-bg-elevated text-text-muted hover:text-text border border-border'}`}
        >
          Tutti
        </Link>
        <Link
          href={`/soci?filter=cert_expired${q ? `&q=${q}` : ''}`}
          className={`text-xs px-2.5 py-1 rounded inline-flex items-center gap-1 ${filter === 'cert_expired' ? 'bg-red-500 text-white' : 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/15'}`}
        >
          <HeartPulse className="h-3 w-3" /> Cert. scaduto
        </Link>
        <Link
          href={`/soci?filter=cert_expiring${q ? `&q=${q}` : ''}`}
          className={`text-xs px-2.5 py-1 rounded inline-flex items-center gap-1 ${filter === 'cert_expiring' ? 'bg-amber-500 text-bg' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/15'}`}
        >
          <HeartPulse className="h-3 w-3" /> Cert. in scadenza
        </Link>
        <Link
          href={`/soci?filter=cert_missing${q ? `&q=${q}` : ''}`}
          className={`text-xs px-2.5 py-1 rounded inline-flex items-center gap-1 ${filter === 'cert_missing' ? 'bg-amber-500 text-bg' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/15'}`}
        >
          <AlertTriangle className="h-3 w-3" /> Cert. mancante
        </Link>
        <Link
          href={`/soci?filter=membership_expired${q ? `&q=${q}` : ''}`}
          className={`text-xs px-2.5 py-1 rounded inline-flex items-center gap-1 ${filter === 'membership_expired' ? 'bg-red-500 text-white' : 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/15'}`}
        >
          <CalendarClock className="h-3 w-3" /> Tessera scaduta
        </Link>
        <Link
          href={`/soci?filter=membership_expiring${q ? `&q=${q}` : ''}`}
          className={`text-xs px-2.5 py-1 rounded inline-flex items-center gap-1 ${filter === 'membership_expiring' ? 'bg-amber-500 text-bg' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/15'}`}
        >
          <CalendarClock className="h-3 w-3" /> Tessera in scadenza
        </Link>
      </div>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-4 text-danger flex items-center gap-2 mb-4">
          <AlertCircle className="h-5 w-5" />
          {error.message}
        </div>
      )}

      {members && members.length === 0 && (
        <div className="rounded-lg border border-border bg-bg-surface p-12 text-center">
          <p className="text-text-muted">
            {q || filter ? 'Nessun socio trovato con questi filtri' : 'Nessun socio registrato'}
          </p>
          {!q && !filter && (
            <Link
              href="/soci/nuovo"
              className="inline-flex items-center gap-2 mt-4 text-sm text-accent hover:underline"
            >
              <Plus className="h-4 w-4" /> Crea il primo socio
            </Link>
          )}
        </div>
      )}

      {members && members.length > 0 && (
        <div className="rounded-lg border border-border bg-bg-surface overflow-hidden">
          <div className="hidden md:grid grid-cols-[60px_2fr_2fr_70px_180px_30px] gap-3 px-4 py-2.5 border-b border-border text-[10px] uppercase tracking-wider text-text-dim font-medium">
            <div>N°</div>
            <div>Nome</div>
            <div>Contatti</div>
            <div>Eta</div>
            <div>Stato</div>
            <div></div>
          </div>
          <div className="divide-y divide-border">
            {members.map((m) => {
              const certExpired = m.medical_cert_received && m.medical_cert_expires_at && m.medical_cert_expires_at < today;
              const certExpiring = m.medical_cert_received && m.medical_cert_expires_at && m.medical_cert_expires_at >= today && m.medical_cert_expires_at <= in30;
              const certMissing = !m.medical_cert_received && m.member_type !== 'sostenitore';
              const membershipExpired = m.expires_at && m.expires_at < today;
              const membershipExpiring = m.expires_at && m.expires_at >= today && m.expires_at <= in30 && !membershipExpired;

              return (
                <Link
                  key={m.id}
                  href={`/soci/${m.id}`}
                  className="block hover:bg-bg-elevated transition-colors"
                >
                  {/* Vista DESKTOP: tabella compatta */}
                  <div className="hidden md:grid md:grid-cols-[60px_2fr_2fr_70px_180px_30px] gap-3 px-4 py-2.5 items-center text-sm">
                    <div className="text-xs text-text-dim font-mono">
                      #{m.membership_number}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium flex items-center gap-1.5 truncate">
                        <span className="truncate">{m.first_name} {m.last_name}</span>
                        {m.member_type === 'sostenitore' && <Heart className="h-3 w-3 text-text-dim shrink-0" />}
                        {m.member_type === 'con_lift' && <Wind className="h-3 w-3 text-accent shrink-0" />}
                      </div>
                    </div>
                    <div className="text-xs text-text-muted min-w-0">
                      <div className="truncate">{m.email}</div>
                      <div className="text-[10px] truncate">{m.phone}</div>
                    </div>
                    <div className="text-xs">
                      {calcAge(m.birth_date) ?? '—'}
                      {m.is_minor && <span className="ml-0.5 text-[10px] text-warning">(min)</span>}
                    </div>
                    <div className="flex flex-wrap gap-1 items-start">
                      {!m.active && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-text-dim/10 text-text-dim">
                          Non attivo
                        </span>
                      )}
                      {membershipExpired && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 inline-flex items-center gap-0.5" title="Tessera scaduta">
                          <CalendarClock className="h-2.5 w-2.5" /> tessera
                        </span>
                      )}
                      {membershipExpiring && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 inline-flex items-center gap-0.5" title="Tessera in scadenza">
                          <CalendarClock className="h-2.5 w-2.5" /> tessera
                        </span>
                      )}
                      {certExpired && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 inline-flex items-center gap-0.5" title="Certificato scaduto">
                          <HeartPulse className="h-2.5 w-2.5" /> cert.
                        </span>
                      )}
                      {certExpiring && !certExpired && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 inline-flex items-center gap-0.5" title="Certificato in scadenza">
                          <HeartPulse className="h-2.5 w-2.5" /> cert.
                        </span>
                      )}
                      {certMissing && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 inline-flex items-center gap-0.5" title="Certificato medico mancante">
                          <AlertTriangle className="h-2.5 w-2.5" /> cert.
                        </span>
                      )}
                      {m.active && !membershipExpired && !membershipExpiring && !certExpired && !certExpiring && !certMissing && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 inline-flex items-center gap-0.5">
                          <CheckCircle2 className="h-2.5 w-2.5" /> OK
                        </span>
                      )}
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-text-dim" />
                  </div>

                  {/* Vista MOBILE: card */}
                  <div className="md:hidden p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] text-text-dim font-mono mb-0.5">
                          #{m.membership_number}
                        </div>
                        <div className="font-medium flex items-center gap-1.5">
                          <span>{m.first_name} {m.last_name}</span>
                          {m.member_type === 'sostenitore' && <Heart className="h-3 w-3 text-text-dim" />}
                          {m.member_type === 'con_lift' && <Wind className="h-3 w-3 text-accent" />}
                          {m.is_minor && <span className="text-[10px] text-warning">(min)</span>}
                        </div>
                        <div className="text-[11px] text-text-muted mt-0.5 truncate">
                          {m.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {!m.active && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-text-dim/10 text-text-dim">Non attivo</span>
                      )}
                      {membershipExpired && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 inline-flex items-center gap-0.5">
                          <CalendarClock className="h-2.5 w-2.5" /> tessera
                        </span>
                      )}
                      {membershipExpiring && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 inline-flex items-center gap-0.5">
                          <CalendarClock className="h-2.5 w-2.5" /> tessera
                        </span>
                      )}
                      {certExpired && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 inline-flex items-center gap-0.5">
                          <HeartPulse className="h-2.5 w-2.5" /> cert.
                        </span>
                      )}
                      {certExpiring && !certExpired && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 inline-flex items-center gap-0.5">
                          <HeartPulse className="h-2.5 w-2.5" /> cert.
                        </span>
                      )}
                      {certMissing && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 inline-flex items-center gap-0.5">
                          <AlertTriangle className="h-2.5 w-2.5" /> cert.
                        </span>
                      )}
                      {m.active && !membershipExpired && !membershipExpiring && !certExpired && !certExpiring && !certMissing && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 inline-flex items-center gap-0.5">
                          <CheckCircle2 className="h-2.5 w-2.5" /> OK
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
