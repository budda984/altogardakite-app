import { createClient } from '@/lib/supabase/server';
import { Package } from 'lucide-react';
import { EQUIPMENT_LABELS, EQUIPMENT_STATUS_LABELS, type EquipmentStatus } from '@/lib/types';

const STATUS_COLORS: Record<EquipmentStatus, string> = {
  disponibile: 'bg-success/10 text-success',
  in_uso: 'bg-blue-500/10 text-blue-400',
  manutenzione: 'bg-warning/10 text-warning',
  dismesso: 'bg-text-dim/10 text-text-dim',
};

export default async function EquipmentPage() {
  const supabase = await createClient();
  const { data: equipment } = await supabase
    .from('equipment')
    .select('*')
    .order('equipment_type')
    .order('code');

  // Raggruppa per tipo
  const grouped = (equipment || []).reduce((acc: any, e) => {
    (acc[e.equipment_type] ||= []).push(e);
    return acc;
  }, {});

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <header className="mb-8">
        <div className="text-xs uppercase tracking-widest text-text-dim mb-2">Inventario</div>
        <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tightest">
          Attrezzatura
        </h1>
        <p className="mt-2 text-text-muted text-sm">
          {equipment?.length ?? 0} pezzi totali
        </p>
      </header>

      {(!equipment || equipment.length === 0) && (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <Package className="h-8 w-8 text-text-dim mx-auto mb-3" />
          <div className="text-text-muted text-sm">
            Nessuna attrezzatura registrata.
            <br />
            <span className="text-xs">Aggiungi pezzi via Supabase dashboard o API.</span>
          </div>
        </div>
      )}

      <div className="space-y-8">
        {Object.entries(grouped).map(([type, items]: any) => (
          <section key={type}>
            <h2 className="font-display text-xl font-semibold tracking-tight mb-4">
              {EQUIPMENT_LABELS[type as keyof typeof EQUIPMENT_LABELS]}
              <span className="text-text-muted text-sm ml-2 font-sans font-normal">
                ({items.length})
              </span>
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((e: any) => (
                <div
                  key={e.id}
                  className="rounded-md border border-border bg-bg-surface p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-mono text-xs text-accent">{e.code}</div>
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_COLORS[e.status as EquipmentStatus]}`}
                    >
                      {EQUIPMENT_STATUS_LABELS[e.status as EquipmentStatus]}
                    </span>
                  </div>
                  <div className="text-sm font-medium">
                    {e.brand} {e.model}
                  </div>
                  <div className="text-xs text-text-muted mt-1">
                    {e.size && `Misura ${e.size}`}
                    {e.size && e.year && ' • '}
                    {e.year && `${e.year}`}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
