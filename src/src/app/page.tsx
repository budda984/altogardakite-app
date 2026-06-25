import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Users, Sailboat, Package, GraduationCap, Plus, ArrowRight, AlertTriangle, CalendarClock, HeartPulse } from 'lucide-react';
import { formatDate, formatTime } from '@/lib/utils';
import { BOAT_LABELS, WIND_SESSION_LABELS } from '@/lib/types';

export default async function Dashboard() {
  const supabase = await createClient();

  // Statistiche
  const [
    { count: membersCount },
    { count: outingsCount },
    { count: equipmentCount },
    { count: activeCoursesCount },
    { data: recentOutings },
    { data: alertsRow },
  ] = await Promise.all([
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('active', true),
    supabase.from('outings').select('*', { count: 'exact', head: true }),
    supabase.from('equipment').select('*', { count: 'exact', head: true }).eq('status', 'disponibile'),
    supabase.from('courses').select('*', { count: 'exact', head: true }).eq('status', 'attivo'),
    supabase.from('outings_with_details').select('*').order('outing_date', { ascending: false }).limit(5),
    supabase.from('dashboard_alerts').select('*').single(),
  ]);

  const alerts = alertsRow || {
    memberships_expiring_soon: 0,
    memberships_expired: 0,
    medical_certs_expiring_soon: 0,
    medical_certs_expired: 0,
    members_missing_medical: 0,
  };

  const hasAlerts =
    alerts.memberships_expiring_soon > 0 ||
    alerts.memberships_expired > 0 ||
    alerts.medical_certs_expiring_soon > 0 ||
    alerts.medical_certs_expired > 0;

  const stats = [
    { label: 'Soci attivi', value: membersCount ?? 0, icon: Users, href: '/soci', color: 'text-accent' },
    { label: 'Uscite totali', value: outingsCount ?? 0, icon: Sailboat, href: '/uscite', color: 'text-blue-400' },
    { label: 'Attrezzature', value: equipmentCount ?? 0, icon: Package, href: '/attrezzatura', color: 'text-amber-400' },
    { label: 'Corsi attivi', value: activeCoursesCount ?? 0, icon: GraduationCap, href: '/corsi', color: 'text-purple-400' },
  ];

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <header className="mb-10">
        <div className="text-xs uppercase tracking-widest text-text-dim mb-2">Dashboard</div>
        <h1 className="font-display text-4xl lg:text-5xl font-bold tracking-tightest text-balance">
          Benvenuto in scuola.
        </h1>
        <p className="mt-3 text-text-muted max-w-xl">
          Gestionale Circolo Altogarda Kite ASD — soci, uscite barca, attrezzatura e corsi.
        </p>
      </header>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 mb-10">
        <Link
          href="/soci/nuovo"
          className="inline-flex items-center gap-2 bg-accent text-bg px-4 py-2.5 rounded-md text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          <Plus className="h-4 w-4" /> Nuovo socio
        </Link>
        <Link
          href="/uscite/nuova"
          className="inline-flex items-center gap-2 bg-bg-elevated border border-border text-text px-4 py-2.5 rounded-md text-sm font-medium hover:border-accent transition-colors"
        >
          <Plus className="h-4 w-4" /> Registra uscita
        </Link>
      </div>

      {/* Alert dashboard */}
      {hasAlerts && (
        <div className="mb-10">
          <h2 className="text-xs uppercase tracking-widest text-text-dim mb-3 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Avvisi
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alerts.memberships_expired > 0 && (
              <Link
                href="/soci"
                className="block p-4 rounded-lg bg-red-500/10 border border-red-500/30 hover:bg-red-500/15 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-red-400">
                      <CalendarClock className="h-4 w-4" />
                      <span className="text-sm font-medium">Tessere scadute</span>
                    </div>
                    <div className="text-2xl font-display font-bold text-red-400 mt-1">
                      {alerts.memberships_expired}
                    </div>
                    <div className="text-xs text-text-muted mt-0.5">
                      {alerts.memberships_expired === 1 ? 'socio con' : 'soci con'} tessera scaduta da rinnovare
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-red-400" />
                </div>
              </Link>
            )}
            {alerts.memberships_expiring_soon > 0 && (
              <Link
                href="/soci"
                className="block p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/15 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-amber-400">
                      <CalendarClock className="h-4 w-4" />
                      <span className="text-sm font-medium">Tessere in scadenza</span>
                    </div>
                    <div className="text-2xl font-display font-bold text-amber-400 mt-1">
                      {alerts.memberships_expiring_soon}
                    </div>
                    <div className="text-xs text-text-muted mt-0.5">
                      tessere in scadenza nei prossimi 30 giorni
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-amber-400" />
                </div>
              </Link>
            )}
            {alerts.medical_certs_expired > 0 && (
              <Link
                href="/soci"
                className="block p-4 rounded-lg bg-red-500/10 border border-red-500/30 hover:bg-red-500/15 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-red-400">
                      <HeartPulse className="h-4 w-4" />
                      <span className="text-sm font-medium">Certificati scaduti</span>
                    </div>
                    <div className="text-2xl font-display font-bold text-red-400 mt-1">
                      {alerts.medical_certs_expired}
                    </div>
                    <div className="text-xs text-text-muted mt-0.5">
                      certificati medici scaduti
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-red-400" />
                </div>
              </Link>
            )}
            {alerts.medical_certs_expiring_soon > 0 && (
              <Link
                href="/soci"
                className="block p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/15 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-amber-400">
                      <HeartPulse className="h-4 w-4" />
                      <span className="text-sm font-medium">Certificati in scadenza</span>
                    </div>
                    <div className="text-2xl font-display font-bold text-amber-400 mt-1">
                      {alerts.medical_certs_expiring_soon}
                    </div>
                    <div className="text-xs text-text-muted mt-0.5">
                      certificati medici in scadenza nei prossimi 30 giorni
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-amber-400" />
                </div>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {stats.map(({ label, value, icon: Icon, href, color }) => (
          <Link
            key={label}
            href={href}
            className="group p-5 rounded-lg border border-border bg-bg-surface hover:border-accent/50 transition-all"
          >
            <div className="flex items-start justify-between">
              <Icon className={`h-5 w-5 ${color}`} />
              <ArrowRight className="h-4 w-4 text-text-dim group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="mt-6">
              <div className="font-display text-3xl font-bold tracking-tightest">
                {value}
              </div>
              <div className="text-xs text-text-muted mt-1">{label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent outings */}
      <div className="rounded-lg border border-border bg-bg-surface overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Ultime uscite
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Le 5 uscite piu recenti registrate
            </p>
          </div>
          <Link
            href="/uscite"
            className="text-xs text-accent hover:underline flex items-center gap-1"
          >
            Vedi tutte <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {recentOutings && recentOutings.length > 0 ? (
          <div className="divide-y divide-border">
            {recentOutings.map((outing) => (
              <Link
                key={outing.id}
                href={`/uscite/${outing.id}`}
                className="flex items-center justify-between p-5 hover:bg-bg-elevated transition-colors"
              >
                <div>
                  <div className="text-sm font-medium">
                    {formatDate(outing.outing_date)} —{' '}
                    <span className="text-accent">{outing.boat_name}</span>
                  </div>
                  <div className="text-xs text-text-muted mt-1 flex gap-3">
                    {outing.wind_session && (
                      <span>{WIND_SESSION_LABELS[outing.wind_session as keyof typeof WIND_SESSION_LABELS]}</span>
                    )}
                    <span>{formatTime(outing.departure_time)} → {formatTime(outing.return_time)}</span>
                    <span>{outing.participants_count} partecipanti</span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-text-dim" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-text-muted">
            Nessuna uscita registrata.{' '}
            <Link href="/uscite/nuova" className="text-accent hover:underline">
              Registra la prima
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
