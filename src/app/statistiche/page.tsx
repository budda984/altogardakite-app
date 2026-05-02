import Link from 'next/link';
import {
  Euro, AlertCircle, Users, Sailboat, Receipt, TrendingUp,
  ChevronRight, Calendar, Sparkles,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function StatistichePage() {
  const supabase = await createClient();

  const yearStart = `${new Date().getFullYear()}-01-01`;
  const monthStart = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

  const [
    membersRes,
    outingsRes,
    monthOutingsRes,
    receivedYearRes,
    receivedMonthRes,
    outstandingRes,
    activeSubsCountRes,
    topUnpaidRes,
  ] = await Promise.all([
    // Soci attivi
    supabase.from('members').select('id', { count: 'exact', head: true }).eq('active', true),
    // Uscite anno
    supabase.from('outings').select('id', { count: 'exact', head: true }).gte('outing_date', yearStart),
    // Uscite mese
    supabase.from('outings').select('id', { count: 'exact', head: true }).gte('outing_date', monthStart),
    // Incassato anno: somma movimenti positivi pagati non stornati
    supabase.from('movements')
      .select('amount')
      .eq('is_reversed', false)
      .eq('paid', true)
      .gt('amount', 0)
      .gte('movement_date', yearStart),
    // Incassato mese
    supabase.from('movements')
      .select('amount')
      .eq('is_reversed', false)
      .eq('paid', true)
      .gt('amount', 0)
      .gte('movement_date', monthStart),
    // Sospeso totale: debiti aperti
    supabase.from('member_open_debts').select('amount_due'),
    // Abbonamenti stagionali attivi
    supabase.from('member_active_subscriptions').select('package_id', { count: 'exact', head: true }),
    // I 10 debiti aperti più vecchi
    supabase
      .from('member_open_debts')
      .select('movement_id, amount_due, movement_date, description, member_id, boat_name, outing_date')
      .order('movement_date', { ascending: true })
      .limit(10),
  ]);

  const totalMembers = membersRes.count || 0;
  const yearOutings = outingsRes.count || 0;
  const monthOutings = monthOutingsRes.count || 0;
  const activeSubs = activeSubsCountRes.count || 0;

  const sumAmount = (rows: { amount: number }[] | null) =>
    (rows || []).reduce((acc, r) => acc + Number(r.amount), 0);
  const sumDue = (rows: { amount_due: number }[] | null) =>
    (rows || []).reduce((acc, r) => acc + Number(r.amount_due), 0);

  const yearReceived = sumAmount(receivedYearRes.data);
  const monthReceived = sumAmount(receivedMonthRes.data);
  const outstanding = sumDue(outstandingRes.data);

  // Recupero i nomi dei soci per i top unpaid
  const topUnpaid = topUnpaidRes.data || [];
  const memberIds = Array.from(new Set(topUnpaid.map((d) => d.member_id).filter(Boolean) as string[]));
  let memberMap: Record<string, { first_name: string; last_name: string }> = {};
  if (memberIds.length > 0) {
    const { data: mems } = await supabase
      .from('members')
      .select('id, first_name, last_name')
      .in('id', memberIds);
    (mems || []).forEach((m) => {
      memberMap[m.id] = { first_name: m.first_name, last_name: m.last_name };
    });
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl pb-24 lg:pb-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">Statistiche</h1>
        <p className="text-sm text-text-muted mt-1">
          Panoramica annuale e situazione pagamenti
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Incassato anno"
          value={`€ ${yearReceived.toFixed(2)}`}
          sub={`Mese in corso: € ${monthReceived.toFixed(2)}`}
          icon={TrendingUp}
          color="emerald"
        />
        <KpiCard
          label="Da incassare"
          value={`€ ${outstanding.toFixed(2)}`}
          sub={outstanding > 0 ? 'Debiti aperti totali' : 'Nessun sospeso'}
          icon={AlertCircle}
          color={outstanding > 0 ? 'amber' : 'zinc'}
        />
        <KpiCard
          label="Soci attivi"
          value={String(totalMembers)}
          sub={`${activeSubs} con abbonamento stagionale`}
          icon={Users}
          color="accent"
        />
        <KpiCard
          label="Uscite anno"
          value={String(yearOutings)}
          sub={`Mese in corso: ${monthOutings}`}
          icon={Sailboat}
          color="accent"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top sospesi */}
        <div className="bg-bg-surface border border-border rounded-lg overflow-hidden lg:col-span-2">
          <div className="p-5 border-b border-border">
            <h2 className="font-display text-lg font-semibold tracking-tight flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-400" />
              Pagamenti in sospeso
            </h2>
            <p className="text-xs text-text-muted mt-1">
              I 10 debiti più vecchi non ancora saldati
            </p>
          </div>
          {topUnpaid.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-sm">
              Nessun debito aperto. 🎉
            </div>
          ) : (
            <div className="divide-y divide-border">
              {topUnpaid.map((row) => {
                const member = row.member_id ? memberMap[row.member_id] : null;
                return (
                  <Link
                    key={row.movement_id}
                    href={row.member_id ? `/soci/${row.member_id}` : '#'}
                    className="p-4 flex items-center gap-3 hover:bg-bg-elevated/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-text">
                        {member ? `${member.last_name} ${member.first_name}` : 'Socio sconosciuto'}
                      </div>
                      <div className="text-xs text-text-muted mt-0.5">
                        {row.description}
                      </div>
                      <div className="text-[10px] text-text-dim mt-0.5 flex items-center gap-2 flex-wrap">
                        <Calendar className="h-3 w-3" />
                        {formatDate(row.movement_date)}
                        {row.boat_name && (
                          <>
                            <span>·</span>
                            <span>{row.boat_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-display font-semibold text-amber-400 flex items-center gap-1 justify-end">
                        <Euro className="h-3.5 w-3.5" />
                        {Number(row.amount_due).toFixed(2)}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-text-dim shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Euro;
  color: 'emerald' | 'amber' | 'accent' | 'zinc';
}) {
  const colorClasses = {
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    accent: 'bg-accent/10 border-accent/30 text-accent',
    zinc: 'bg-bg-elevated border-border text-text-muted',
  };
  return (
    <div className={`p-5 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] uppercase tracking-widest opacity-80">{label}</div>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <div className="font-display text-2xl font-bold mt-2">{value}</div>
      {sub && <div className="text-xs mt-1 opacity-70">{sub}</div>}
    </div>
  );
}
