import { redirect } from 'next/navigation';
import { Shield, UserCheck, Clock, Ban } from 'lucide-react';
import { getAuth } from '@/lib/auth';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import UsersTable from './UsersTable';
import type { ProfileWithEmail } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function UtentiPage() {
  const auth = await getAuth();
  if (!auth || !auth.isAdmin) redirect('/');

  // Service role client per leggere auth.users (l'API anon non lo permette)
  const adminClient = createAdminClient();
  const supabase = await createClient();

  const [{ data: profiles }, authUsersRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false }),
    adminClient.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  // Combina profile + dati auth (email, last_sign_in_at)
  const authUsersById = new Map(
    (authUsersRes.data?.users || []).map((u) => [u.id, u])
  );
  const enriched: ProfileWithEmail[] = (profiles || []).map((p) => {
    const u = authUsersById.get(p.id);
    return {
      ...p,
      email: u?.email || null,
      last_sign_in_at: u?.last_sign_in_at || null,
    };
  });

  // KPI
  const counts = {
    total: enriched.length,
    pending: enriched.filter((p) => p.role === 'pending').length,
    staff: enriched.filter((p) => p.role === 'staff').length,
    admin: enriched.filter((p) => p.role === 'admin').length,
    suspended: enriched.filter((p) => p.suspended).length,
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl pb-24 lg:pb-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-3">
          <Shield className="h-7 w-7 text-accent" />
          Gestione utenti
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Approva nuove registrazioni, gestisci i ruoli e le sospensioni
        </p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard label="In attesa" value={counts.pending} icon={Clock} color={counts.pending > 0 ? 'amber' : 'zinc'} />
        <KpiCard label="Staff" value={counts.staff} icon={UserCheck} color="emerald" />
        <KpiCard label="Amministratori" value={counts.admin} icon={Shield} color="accent" />
        <KpiCard label="Sospesi" value={counts.suspended} icon={Ban} color={counts.suspended > 0 ? 'red' : 'zinc'} />
      </div>

      {counts.pending > 0 && (
        <div className="mb-6 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
          <Clock className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-text font-medium">
              {counts.pending} {counts.pending === 1 ? 'utente in attesa' : 'utenti in attesa'} di approvazione
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              Approva gli utenti per dargli accesso al gestionale, o sospendili se non riconosci la registrazione.
            </p>
          </div>
        </div>
      )}

      <UsersTable users={enriched} currentUserId={auth.userId} />
    </div>
  );
}

function KpiCard({
  label, value, icon: Icon, color,
}: {
  label: string;
  value: number;
  icon: typeof Shield;
  color: 'emerald' | 'amber' | 'accent' | 'zinc' | 'red';
}) {
  const colorClasses = {
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    accent: 'bg-accent/10 border-accent/30 text-accent',
    zinc: 'bg-bg-elevated border-border text-text-muted',
    red: 'bg-red-500/10 border-red-500/30 text-red-400',
  };
  return (
    <div className={`p-5 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] uppercase tracking-widest opacity-80">{label}</div>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <div className="font-display text-2xl font-bold mt-2">{value}</div>
    </div>
  );
}
