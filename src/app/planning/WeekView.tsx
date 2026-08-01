'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, Loader2, Users, Sailboat, CalendarDays, UserX, StickyNote,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { SessionTemplate, BookingWithMember } from '@/lib/types';
import { oggiItalia } from '@/lib/dataLocale';

interface WeekAbsence {
  id: string;
  instructor_id: string;
  absence_date: string;
  session_template_id: string | null;
  instructor: { id: string; first_name: string; last_name: string } | null;
}

interface WeekNota {
  id: string;
  testo: string;
  data_da: string;
  data_a: string;
  created_by_name: string | null;
}

interface WeekOuting {
  id: string;
  outing_date: string;
  session_template_id: string | null;
  status: string;
  boat: { id: string; name: string; capacity: number | null } | null;
  outing_participants: {
    id: string;
    participation_type: string;
    member: { id: string; first_name: string; last_name: string } | null;
  }[];
}

interface Props {
  initialStart: string;          // lunedì della settimana corrente
  onOpenDay: (date: string) => void;  // porta al giorno nel dettaglio
}

// Lunedì della settimana che contiene `dateStr`
function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay(); // 0 dom ... 6 sab
  const diff = day === 0 ? -6 : 1 - day; // porta a lunedì
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayLabel(dateStr: string): { weekday: string; day: string; month: string } {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    weekday: d.toLocaleDateString('it-IT', { weekday: 'short' }),
    day: d.toLocaleDateString('it-IT', { day: 'numeric' }),
    month: d.toLocaleDateString('it-IT', { month: 'short' }),
  };
}

export default function WeekView({ initialStart, onOpenDay }: Props) {
  const [weekStart, setWeekStart] = useState(mondayOf(initialStart));
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [bookings, setBookings] = useState<BookingWithMember[]>([]);
  const [outings, setOutings] = useState<WeekOuting[]>([]);
  const [absences, setAbsences] = useState<WeekAbsence[]>([]);
  const [note, setNote] = useState<WeekNota[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/planning/settimana?start=${weekStart}`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
        setBookings(data.bookings || []);
        setOutings(data.outings || []);
        setAbsences(data.absences || []);
        setNote(data.note || []);
      }
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  const today = oggiItalia();
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(weekStart, i));

  // Indici per accesso veloce: per giorno -> per template
  function bookingsFor(date: string, templateId: string): BookingWithMember[] {
    return bookings.filter((b) => b.booking_date === date && b.session_template_id === templateId);
  }
  function outingsFor(date: string, templateId: string): WeekOuting[] {
    return outings.filter((o) => o.outing_date === date && o.session_template_id === templateId);
  }
  function dayHasActivity(date: string): boolean {
    return bookings.some((b) => b.booking_date === date) || outings.some((o) => o.outing_date === date);
  }
  function absencesFor(date: string): WeekAbsence[] {
    return absences.filter((a) => a.absence_date === date);
  }

  const weekRangeLabel = (() => {
    const a = dayLabel(days[0]);
    const b = dayLabel(days[6]);
    return `${a.day} ${a.month} - ${b.day} ${b.month}`;
  })();

  return (
    <div className="space-y-4">
      {/* Navigazione settimana */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setWeekStart(shiftDate(weekStart, -7))}
          className="p-2 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text"
          aria-label="Settimana precedente"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="text-center">
          <div className="font-display font-semibold tracking-tight">{weekRangeLabel}</div>
          <button
            onClick={() => setWeekStart(mondayOf(today))}
            className="text-[11px] text-accent hover:underline"
          >
            Vai a questa settimana
          </button>
        </div>

        <button
          onClick={() => setWeekStart(shiftDate(weekStart, 7))}
          className="p-2 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text"
          aria-label="Settimana successiva"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-text-muted">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {note.length > 0 && (
            <div className="col-span-full">
              <div className="hidden md:grid grid-cols-7 gap-x-3 gap-y-1">
                {note.map((n) => {
                  // Ritaglio la nota alla settimana visibile e la traduco in
                  // colonne 1-7 (lunedi..domenica).
                  const inizio = n.data_da < days[0] ? days[0] : n.data_da;
                  const fine = n.data_a > days[6] ? days[6] : n.data_a;
                  const colStart = days.indexOf(inizio) + 1;
                  const colEnd = days.indexOf(fine) + 2; // grid-column-end e' esclusivo
                  const continuaPrima = n.data_da < days[0];
                  const continuaDopo = n.data_a > days[6];
                  return (
                    <div
                      key={n.id}
                      style={{ gridColumn: `${colStart} / ${colEnd}` }}
                      className={cn(
                        'flex items-center gap-1.5 text-[11px] px-2 py-1 bg-accent/10 text-accent border border-accent/25 overflow-hidden',
                        continuaPrima ? 'rounded-l-none border-l-0' : 'rounded-l-md',
                        continuaDopo ? 'rounded-r-none border-r-0' : 'rounded-r-md'
                      )}
                      title={n.testo}
                    >
                      <StickyNote className="h-3 w-3 shrink-0" />
                      <span className="truncate">{n.testo}</span>
                    </div>
                  );
                })}
              </div>
              {/* Su telefono la griglia diventa una colonna: le barre non
                  avrebbero senso, elenco semplice. */}
              <div className="md:hidden space-y-1">
                {note.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md bg-accent/10 text-accent border border-accent/25"
                  >
                    <StickyNote className="h-3 w-3 shrink-0" />
                    <span>{n.testo}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {days.map((date) => {
            const dl = dayLabel(date);
            const isToday = date === today;
            const hasActivity = dayHasActivity(date);
            const dayAbsences = absencesFor(date);
            const hasAbsences = dayAbsences.length > 0;
            return (
              <div
                key={date}
                className={cn(
                  'rounded-lg border overflow-hidden flex flex-col',
                  hasAbsences ? 'bg-amber-500/[0.04]' : 'bg-bg-surface',
                  isToday ? 'border-accent' : hasAbsences ? 'border-amber-500/40' : 'border-border'
                )}
              >
                {/* Header giorno - cliccabile per aprire il dettaglio */}
                <button
                  onClick={() => onOpenDay(date)}
                  className={cn(
                    'w-full px-3 py-2 text-left border-b transition-colors',
                    hasAbsences ? 'border-amber-500/30' : 'border-border',
                    isToday ? 'bg-accent/10'
                      : hasAbsences ? 'bg-amber-500/10 hover:bg-amber-500/15'
                      : 'bg-bg-elevated/40 hover:bg-bg-elevated'
                  )}
                >
                  <div className="flex items-baseline justify-between">
                    <span className={cn('text-xs font-medium uppercase', isToday ? 'text-accent' : hasAbsences ? 'text-amber-400' : 'text-text-muted')}>
                      {dl.weekday}
                    </span>
                    <span className={cn('text-lg font-display font-bold', isToday ? 'text-accent' : 'text-text')}>
                      {dl.day}
                    </span>
                  </div>
                  {hasAbsences && (
                    <div className="flex items-start gap-1 mt-1 text-[10px] text-amber-400 leading-tight">
                      <UserX className="h-3 w-3 mt-px shrink-0" />
                      <span>
                        {dayAbsences.map((a) => a.instructor?.first_name || '?').join(', ')}
                      </span>
                    </div>
                  )}
                </button>

                {/* Contenuto giorno */}
                <div className="p-2 space-y-2 flex-1 min-h-[60px]">
                  {!hasActivity && (
                    <div className="text-[10px] text-text-dim text-center py-3">—</div>
                  )}

                  {templates.map((tpl) => {
                    const slotBookings = bookingsFor(date, tpl.id);
                    const slotOutings = outingsFor(date, tpl.id);
                    if (slotBookings.length === 0 && slotOutings.length === 0) return null;

                    return (
                      <button
                        key={tpl.id}
                        onClick={() => onOpenDay(date)}
                        className="w-full text-left rounded border border-border bg-bg-elevated/30 hover:border-accent/50 hover:bg-bg-elevated p-1.5 transition-colors"
                      >
                        <div className="text-[10px] font-semibold text-accent uppercase tracking-wide mb-0.5">
                          {tpl.name}
                        </div>

                        {/* Prenotazioni */}
                        {slotBookings.length > 0 && (
                          <div className="flex items-start gap-1 text-[11px] text-text-muted">
                            <Users className="h-3 w-3 mt-0.5 shrink-0" />
                            <span className="leading-tight">
                              {slotBookings.map((b) => b.first_name).join(', ')}
                            </span>
                          </div>
                        )}

                        {/* Uscite */}
                        {slotOutings.map((o) => (
                          <div key={o.id} className="flex items-start gap-1 text-[11px] text-emerald-400 mt-0.5">
                            <Sailboat className="h-3 w-3 mt-0.5 shrink-0" />
                            <span className="leading-tight">
                              {o.boat?.name}
                              {o.outing_participants.length > 0 &&
                                ` · ${o.outing_participants.map((p) => p.member?.first_name).filter(Boolean).join(', ')}`}
                            </span>
                          </div>
                        ))}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-text-dim flex items-center gap-1.5">
        <CalendarDays className="h-3.5 w-3.5" />
        Tocca un giorno per aprirlo e gestire prenotazioni, avvisi e uscite.
      </p>
    </div>
  );
}
