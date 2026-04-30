import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, Sailboat, Wind, Users, Package } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatTime } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import {
  WIND_SESSION_LABELS, PARTICIPATION_LABELS, RENTAL_LABELS, EQUIPMENT_LABELS,
} from '@/lib/types';

export default async function OutingDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: outing } = await supabase
    .from('outings')
    .select('*, boat:boats(*)')
    .eq('id', id)
    .single();

  if (!outing) notFound();

  const [{ data: instructorRows }, { data: participants }] = await Promise.all([
    supabase
      .from('outing_instructors')
      .select('instructor:instructors(*)')
      .eq('outing_id', id),
    supabase
      .from('outing_participants')
      .select(`
        *,
        member:members(id, first_name, last_name, membership_number),
        equipment:outing_participant_equipment(equipment(*))
      `)
      .eq('outing_id', id),
  ]);

  return (
    <div className="p-4 lg:p-10 max-w-5xl">
      <Link href="/uscite" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-accent mb-4">
        <ArrowLeft className="h-4 w-4" /> Tutte le uscite
      </Link>

      <header className="mb-8">
        <div className="text-xs uppercase tracking-widest text-text-dim mb-1">Uscita barca</div>
        <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tightest">
          {(outing as any).boat?.name} — {formatDate(outing.outing_date)}
        </h1>
        <div className="flex flex-wrap gap-4 mt-3 text-sm text-text-muted">
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {formatTime(outing.departure_time)} → {formatTime(outing.return_time)}
          </span>
          {outing.wind_session && (
            <span className="flex items-center gap-1.5">
              <Wind className="h-4 w-4" />
              {WIND_SESSION_LABELS[outing.wind_session as keyof typeof WIND_SESSION_LABELS]}
            </span>
          )}
          {outing.weather_notes && <span>{outing.weather_notes}</span>}
        </div>
      </header>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Istruttori e assistenti">
          {instructorRows && instructorRows.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {instructorRows.map((row: any) => (
                <li key={row.instructor.id} className="flex justify-between items-center">
                  <span>{row.instructor.first_name} {row.instructor.last_name}</span>
                  <span className="text-xs text-text-muted capitalize">{row.instructor.role}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">Nessun istruttore registrato</p>
          )}
        </Card>

        {outing.notes && (
          <Card title="Note">
            <p className="text-sm whitespace-pre-wrap">{outing.notes}</p>
          </Card>
        )}
      </div>

      <Card title={`Partecipanti (${participants?.length ?? 0})`} className="mt-6">
        {participants && participants.length > 0 ? (
          <div className="divide-y divide-border -mx-6">
            {participants.map((p: any) => (
              <div key={p.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <Link
                      href={`/soci/${p.member.id}`}
                      className="font-medium hover:text-accent"
                    >
                      {p.member.first_name} {p.member.last_name}
                    </Link>
                    <div className="text-xs text-text-muted mt-0.5">
                      Tessera #{p.member.membership_number}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent inline-block">
                      {PARTICIPATION_LABELS[p.participation_type as keyof typeof PARTICIPATION_LABELS]}
                    </div>
                  </div>
                </div>

                {p.rental_type !== 'nessuno' && (
                  <div className="mt-3 text-sm text-text-muted flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Noleggio: <span className="text-text">{RENTAL_LABELS[p.rental_type as keyof typeof RENTAL_LABELS]}</span>
                    {p.rental_price && <span className="text-accent">€{p.rental_price}</span>}
                  </div>
                )}

                {p.equipment && p.equipment.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.equipment.map((e: any) => (
                      <span
                        key={e.equipment.id}
                        className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-border text-text-muted"
                      >
                        {e.equipment.code} {EQUIPMENT_LABELS[e.equipment.equipment_type as keyof typeof EQUIPMENT_LABELS]}
                      </span>
                    ))}
                  </div>
                )}

                {p.notes && (
                  <p className="text-xs text-text-muted mt-2 italic">{p.notes}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">Nessun partecipante</p>
        )}
      </Card>
    </div>
  );
}
