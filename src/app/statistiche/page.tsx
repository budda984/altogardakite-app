import Link from 'next/link';
import {
  Euro, AlertCircle, Users, Sailboat, Receipt, TrendingUp,
  ChevronRight, Calendar,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';
import { SERVICE_CATEGORY_LABELS, type ServiceCategory } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function StatistichePage() {
  const supabase = await createClient();

  // Periodo: anno corrente
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const monthStart = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

  // KPI principali
  const [
    membersRes,
    outingsRes,
    monthOutingsRes,
    msYearRes,
    msMonthRes,
    msUnpaidRes,
    msByCategoryRes,
    topUnpaidRes,
  ] = await Promise.all([
    supabase.from('members').select('id', { count: 'exact', head: true }).eq('active', true),
    supabase.from('outings').select('id', { count: 'exact', head: true }).gte('outing_date', yearStart),
    supabase.from('outings').select('id', { count: 'exact', head: true }).gte('outing_date', monthStart),
    supabase.from('member_services').select('total_price').gte('sold_at', yearStart),
    supabase.from('member_services').select('total_price').gte('sold_at', monthStart),
    supabase.from('member_services').select('total_price').eq('paid', false),
    supabase.from('member_services').select('category, total_price, paid').gte('sold_at', yearStart),
    supabase
      .from('member_services')
      .select('id, total_price, sold_at, service_name_snapshot, member:members(id,first_name,last_name)')
      .eq('paid', false)
      .order('sold_at', { ascending: true })
      .limit(10),
  ]);

  const totalMembers = membersRes.count || 0;
  const yearOutings = outingsRes.count || 0;
  const monthOutings = monthOutingsRes.count || 0;

  const sumPrice = (rows: { total_price: number }[] | null) =>
    (rows || []).reduce((acc, r) => acc + Number(r.total_price), 0);

  const yearRevenueAll = sumPrice(msYearRes.data);
  const monthRevenueAll = sumPrice(msMonthRes.data);
  const outstanding = sumPrice(msUnpaidRes.data);

  // Aggregato per categoria (anno corrente)
  const byCategory: Record<string, { charged: number; paid: number; count: number }> = {};
  (msByCategoryRes.data || []).forEach((r: { category: string | null; total_price: number; paid: boolean }) => {
    const cat = r.category || 'altro';
    if (!byCategory[cat]) byCategory[cat] = { charged: 0, paid: 0, count: 0 };
    byCategory[cat].charged += Number(r.total_price);
    if (r.paid) byCategory[cat].paid += Number(r.total_price);
    byCategory[cat].count += 1;
  });
  const sortedCategories = Object.entries(byCategory).sort(([, a], [, b]) => b.charged - a.charged);
  const maxCharged = Math.max(...sortedCategories.map(([, v]) => v.charged), 1);

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
          label="Fatturato anno"
          value={`€ ${yearRevenueAll.toFixed(2)}`}
          sub={`Mese in corso: € ${monthRevenueAll.toFixed(2)}`}
          icon={TrendingUp}
          color="emerald"
        />
        <KpiCard
          label="Da incassare"
          value={`€ ${outstanding.toFixed(2)}`}
          sub={outstanding > 0 ? 'Sospesi totali' : 'Nessun sospeso'}
          icon={AlertCircle}
          color={outstanding > 0 ? 'amber' : 'zinc'}
        />
        <KpiCard
          label="Soci attivi"
          value={String(totalMembers)}
          sub="Iscrizioni in corso"
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
        {/* Fatturato per categoria */}
        <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-display text-lg font-semibold tracking-tight flex items-center gap-2">
              <Receipt className="h-5 w-5 text-accent" />
              Fatturato per categoria
            </h2>
            <p className="text-xs text-text-muted mt-1">
              Anno {new Date().getFullYear()} — addebitato vs incassato
            </p>
          </div>
          {sortedCategories.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-sm">
              Nessun servizio addebitato questanno.
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {sortedCategories.map(([cat, v]) => {
                const pctOfMax = (v.charged / maxCharged) * 100;
                const pctPaid = v.charged > 0 ? (v.paid / v.charged) * 100 : 0;
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1.5 text-sm">
                      <span className="text-text">
                        {SERVICE_CATEGORY_LABELS[cat as ServiceCategory] || cat}
                      </span>
                      <span className="text-text-muted text-xs">
                        € {v.charged.toFixed(2)} ({v.count})
                      </span>
                    </div>
                    <div className="relative h-6 bg-bg-elevated rounded overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-accent/20"
                        style={{ width: `${pctOfMax}%` }}
                      />
                      <div
                        className="absolute inset-y-0 left-0 bg-emerald-500/40"
                        style={{ width: `${pctOfMax * (pctPaid / 100)}%` }}
                      />
                      <div className="absolute inset-0 flex items-center justify-between px-2 text-[11px]">
                        <span className="text-text-muted">{pctPaid.toFixed(0)}% pagato</span>
                        <span className="text-text-muted">€ {v.paid.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top sospesi */}
        <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-display text-lg font-semibold tracking-tight flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-400" />
              Pagamenti in sospeso
            </h2>
            <p className="text-xs text-text-muted mt-1">
              I 10 piu vecchi non ancora pagati
            </p>
          </div>
          {!topUnpaidRes.data || topUnpaidRes.data.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-sm">
              Nessun addebito in sospeso. 🎉
            </div>
          ) : (
            <div className="divide-y divide-border">
              {(topUnpaidRes.data as unknown as TopUnpaidRow[]).map((row) => (
                <Link
                  key={row.id}
                  href={`/soci/${row.member?.id}`}
                  className="p-4 flex items-center gap-3 hover:bg-bg-elevated/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-text">
                      {row.member?.last_name} {row.member?.first_name}
                    </div>
                    <div className="text-xs text-text-muted mt-0.5">
                      {row.service_name_snapshot}
                    </div>
                    <div className="text-[10px] text-text-dim mt-0.5 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(row.sold_at)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display font-semibold text-amber-400 flex items-center gap-1 justify-end">
                      <Euro className="h-3.5 w-3.5" />
                      {Number(row.total_price).toFixed(2)}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-text-dim shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface TopUnpaidRow {
  id: string;
  total_price: number;
  sold_at: string;
  service_name_snapshot: string;
  member: { id: string; first_name: string; last_name: string } | null;
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
