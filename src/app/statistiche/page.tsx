import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  BarChart3, FileText, Sailboat, Users, Wind, GraduationCap,
  XCircle, CheckCircle2, Clock, ArrowRight,
} from 'lucide-react';
import { DISCIPLINE_LABELS } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function StatistichePage() {
  const supabase = await createClient();
  const today = new Date();
  const yearStart = `${today.getFullYear()}-01-01`;
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

  const [
    membersRes,
    outingsYearRes,
    outingsMonthRes,
    movementsRes,
  ] = await Promise.all([
    // Soci attivi
    supabase.from('members').select('id, member_type, active').eq('active', true),
    // Uscite anno corrente
    supabase
      .from('outings')
      .select('id, outing_date, status, discipline, boat_id, departure_time, return_time, boats(name)')
      .gte('outing_date', yearStart),
    // Uscite mese corrente
    supabase
      .from('outings')
      .select('id, status', { count: 'exact', head: false })
      .gte('outing_date', monthStart),
    // Movimenti per contare lift consumati e lezioni
    supabase
      .from('movements')
      .select('lift_delta, lift_discipline, movement_type, member_id')
      .eq('is_reversed', false)
      .gte('movement_date', yearStart),
  ]);

  const members = membersRes.data || [];
  const outings = outingsYearRes.data || [];
  const outingsMonth = outingsMonthRes.data || [];
  const movements = movementsRes.data || [];

  // Aggregazioni soci
  const membersByType: Record<string, number> = { sostenitore: 0, normale: 0, con_lift: 0 };
  members.forEach((m) => {
    membersByType[m.member_type] = (membersByType[m.member_type] || 0) + 1;
  });

  // Aggregazioni uscite
  const outingsByStatus = { bozza: 0, chiusa: 0, annullata: 0 };
  outings.forEach((o) => {
    if (o.status in outingsByStatus) {
      outingsByStatus[o.status as keyof typeof outingsByStatus]++;
    }
  });

  const outingsMonthByStatus = { chiusa: 0, annullata: 0, bozza: 0 };
  outingsMonth.forEach((o) => {
    if (o.status in outingsMonthByStatus) {
      outingsMonthByStatus[o.status as keyof typeof outingsMonthByStatus]++;
    }
  });

  // Aggregazione per disciplina
  const byDiscipline: Record<string, number> = {};
  outings.forEach((o) => {
    if (o.status === 'chiusa') {
      const d = o.discipline || 'altro';
      byDiscipline[d] = (byDiscipline[d] || 0) + 1;
    }
  });

  // Per barca
  const byBoat: Record<string, { name: string; count: number }> = {};
  outings.forEach((o) => {
    if (o.status === 'chiusa' && o.boat_id) {
      const boatRel = o.boats as { name: string } | { name: string }[] | null;
      const name = Array.isArray(boatRel) ? boatRel[0]?.name : boatRel?.name;
      if (!byBoat[o.boat_id]) byBoat[o.boat_id] = { name: name || '?', count: 0 };
      byBoat[o.boat_id].count += 1;
    }
  });

  // Ore di navigazione totali (chiuse)
  let totalMinutes = 0;
  outings.forEach((o) => {
    if (o.status !== 'chiusa') return;
    if (!o.departure_time || !o.return_time) return;
    const [dh, dm] = o.departure_time.split(':').map(Number);
    const [rh, rm] = o.return_time.split(':').map(Number);
    totalMinutes += (rh * 60 + rm) - (dh * 60 + dm);
  });

  // Lift consumati per disciplina
  const liftsByDiscipline: Record<string, number> = {};
  let totalLifts = 0;
  let totalLessons = 0;
  movements.forEach((m) => {
    if (m.lift_delta === -1 && m.lift_discipline) {
      liftsByDiscipline[m.lift_discipline] = (liftsByDiscipline[m.lift_discipline] || 0) + 1;
      totalLifts++;
      if (m.lift_discipline === 'corso') totalLessons++;
    }
  });

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <header className="mb-8">
        <div className="text-xs uppercase tracking-widest text-text-dim mb-2">Reportistica</div>
        <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tightest flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-accent" />
          Statistiche
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Anno corrente {today.getFullYear()} - dati aggiornati al {today.toLocaleDateString('it-IT')}
        </p>
      </header>

      {/* KPI principali */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <KpiCard
          icon={Users}
          label="Soci attivi"
          value={members.length}
          sublabel={`${membersByType.sostenitore} sostenitori, ${membersByType.normale} normali, ${membersByType.con_lift} con lift`}
        />
        <KpiCard
          icon={Sailboat}
          label="Uscite anno"
          value={outings.length}
          sublabel={`${outingsByStatus.chiusa} chiuse, ${outingsByStatus.annullata} annullate`}
        />
        <KpiCard
          icon={Clock}
          label="Ore navigazione"
          value={Math.round((totalMinutes / 60) * 10) / 10}
          sublabel="(uscite chiuse)"
        />
        <KpiCard
          icon={Wind}
          label="Lift consumati"
          value={totalLifts}
          sublabel={`${totalLessons} lezioni corso`}
        />
      </div>

      {/* Mese corrente */}
      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-widest text-text-dim mb-3">
          Mese corrente ({today.toLocaleDateString('it-IT', { month: 'long' })})
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <MiniStat label="Chiuse" value={outingsMonthByStatus.chiusa} icon={CheckCircle2} color="emerald" />
          <MiniStat label="Bozze" value={outingsMonthByStatus.bozza} icon={Clock} color="amber" />
          <MiniStat label="Annullate" value={outingsMonthByStatus.annullata} icon={XCircle} color="red" />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Per disciplina (grafico a barre orizzontale) */}
        <section>
          <h2 className="text-xs uppercase tracking-widest text-text-dim mb-3">
            Uscite per disciplina
          </h2>
          <div className="bg-bg-surface border border-border rounded-lg p-4">
            {Object.keys(byDiscipline).length === 0 ? (
              <p className="text-text-muted text-sm">Nessuna uscita chiusa</p>
            ) : (
              <BarChart data={Object.entries(byDiscipline)
                .map(([k, v]) => ({ label: DISCIPLINE_LABELS[k as keyof typeof DISCIPLINE_LABELS] || k, value: v }))
                .sort((a, b) => b.value - a.value)} />
            )}
          </div>
        </section>

        {/* Per barca */}
        <section>
          <h2 className="text-xs uppercase tracking-widest text-text-dim mb-3">
            Uscite per imbarcazione
          </h2>
          <div className="bg-bg-surface border border-border rounded-lg p-4">
            {Object.keys(byBoat).length === 0 ? (
              <p className="text-text-muted text-sm">Nessuna uscita chiusa</p>
            ) : (
              <BarChart data={Object.values(byBoat)
                .map((b) => ({ label: b.name, value: b.count }))
                .sort((a, b) => b.value - a.value)} />
            )}
          </div>
        </section>
      </div>

      {/* Lift residui per disciplina */}
      {Object.keys(liftsByDiscipline).length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs uppercase tracking-widest text-text-dim mb-3">
            Lift consumati per disciplina (anno)
          </h2>
          <div className="bg-bg-surface border border-border rounded-lg p-4">
            <BarChart data={Object.entries(liftsByDiscipline)
              .map(([k, v]) => ({ label: DISCIPLINE_LABELS[k as keyof typeof DISCIPLINE_LABELS] || k, value: v }))
              .sort((a, b) => b.value - a.value)} />
          </div>
        </section>
      )}

      {/* Sezione Report PDF */}
      <section>
        <div className="bg-gradient-to-br from-accent/5 to-bg-surface border border-accent/30 rounded-lg p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-display font-semibold text-text flex items-center gap-2">
                <FileText className="h-5 w-5 text-accent" />
                Report PDF
              </h2>
              <p className="text-sm text-text-muted mt-1">
                Genera report dettagliati in PDF: per socio, per barca, per istruttore, per giorno o riassunto periodo
              </p>
            </div>
            <Link
              href="/report"
              className="inline-flex items-center gap-2 bg-accent text-bg px-4 py-2.5 rounded-md text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              <FileText className="h-4 w-4" />
              Apri Report
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function KpiCard({
  icon: Icon, label, value, sublabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  sublabel?: string;
}) {
  return (
    <div className="bg-bg-surface border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 text-text-muted mb-1">
        <Icon className="h-4 w-4" />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="font-display text-2xl font-bold">{value}</div>
      {sublabel && <div className="text-[10px] text-text-dim mt-1">{sublabel}</div>}
    </div>
  );
}

function MiniStat({
  label, value, icon: Icon, color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'emerald' | 'amber' | 'red';
}) {
  const colorClasses = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    red: 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  return (
    <div className={`rounded-lg border p-3 ${colorClasses[color]}`}>
      <div className="flex items-center gap-1.5 text-xs mb-1">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="font-display text-xl font-bold">{value}</div>
    </div>
  );
}

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label}>
          <div className="flex items-center justify-between text-xs text-text-muted mb-0.5">
            <span>{d.label}</span>
            <span className="font-mono">{d.value}</span>
          </div>
          <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
