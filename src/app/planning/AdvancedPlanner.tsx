'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Loader2, Users, Sailboat, GraduationCap, AlertTriangle, Check,
  Plus, X, ChevronDown, Anchor, Inbox, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type {
  Boat, Instructor, SessionTemplate, BookingWithMember, LiftDiscipline,
} from '@/lib/types';
import { DISCIPLINE_LABELS, PARTICIPATION_LABELS } from '@/lib/types';

interface Props {
  date: string;
  templates: SessionTemplate[];
  boats: Boat[];
  instructors: Instructor[];
  onCreated: () => void;
}

// Una colonna = una barca con istruttori assegnati + i prenotati trascinati dentro
interface Column {
  id: string;            // id univoco colonna (usiamo boat_id)
  boatId: string;
  instructorIds: string[];
  bookingIds: string[];  // prenotati assegnati
}

export default function AdvancedPlanner({
  date, templates, boats, instructors, onCreated,
}: Props) {
  const [selectedTemplate, setSelectedTemplate] = useState<SessionTemplate | null>(null);
  const [bookings, setBookings] = useState<BookingWithMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState<Column[]>([]);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ ok: number; fail: number; errors: string[] } | null>(null);

  // Mobile: bolla selezionata per "assegna a"
  const [pickBooking, setPickBooking] = useState<string | null>(null);
  // Drag desktop
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Carica prenotati della sessione scelta
  const loadBookings = useCallback(async (templateId: string) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/bookings?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        const all: BookingWithMember[] = data.bookings || data || [];
        setBookings(all.filter((b) => b.session_template_id === templateId && b.status === 'pending'));
      }
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    if (selectedTemplate) {
      loadBookings(selectedTemplate.id);
      setColumns([]);
    }
  }, [selectedTemplate, loadBookings]);

  // Prenotati non ancora assegnati (nel cesto)
  const assignedIds = useMemo(() => new Set(columns.flatMap((c) => c.bookingIds)), [columns]);
  const cestoBookings = bookings.filter((b) => !assignedIds.has(b.id));

  const bookingById = useMemo(() => {
    const m: Record<string, BookingWithMember> = {};
    bookings.forEach((b) => { m[b.id] = b; });
    return m;
  }, [bookings]);

  // === Gestione colonne ===
  function toggleBoatColumn(boatId: string) {
    setColumns((prev) => {
      const exists = prev.find((c) => c.boatId === boatId);
      if (exists) {
        // Rimuovi colonna: i prenotati tornano nel cesto automaticamente
        return prev.filter((c) => c.boatId !== boatId);
      }
      return [...prev, { id: boatId, boatId, instructorIds: [], bookingIds: [] }];
    });
  }

  function toggleColumnInstructor(boatId: string, instructorId: string) {
    setColumns((prev) => prev.map((c) => {
      if (c.boatId !== boatId) return c;
      const has = c.instructorIds.includes(instructorId);
      return {
        ...c,
        instructorIds: has
          ? c.instructorIds.filter((i) => i !== instructorId)
          : [...c.instructorIds, instructorId],
      };
    }));
  }

  function assignBooking(bookingId: string, boatId: string) {
    setColumns((prev) => prev.map((c) => {
      // togli da tutte le colonne, poi metti in quella giusta
      const cleaned = c.bookingIds.filter((id) => id !== bookingId);
      if (c.boatId === boatId) return { ...c, bookingIds: [...cleaned, bookingId] };
      return { ...c, bookingIds: cleaned };
    }));
    setPickBooking(null);
  }

  function removeFromColumn(bookingId: string) {
    setColumns((prev) => prev.map((c) => ({
      ...c,
      bookingIds: c.bookingIds.filter((id) => id !== bookingId),
    })));
  }

  // === Creazione bozze ===
  async function createDrafts() {
    const validColumns = columns.filter((c) => c.bookingIds.length > 0);
    if (validColumns.length === 0) return;

    setCreating(true);
    setResult(null);
    let ok = 0, fail = 0;
    const errors: string[] = [];

    for (const col of validColumns) {
      const boat = boats.find((b) => b.id === col.boatId);
      // Disciplina: prendi quella prevalente tra i prenotati, fallback 'kite'
      const discs = col.bookingIds
        .map((id) => bookingById[id]?.preferred_discipline)
        .filter(Boolean) as LiftDiscipline[];
      const discipline = discs[0] || 'kite';

      try {
        const res = await fetch('/api/bookings/crea-uscita', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            booking_ids: col.bookingIds,
            outing_date: date,
            session_template_id: selectedTemplate!.id,
            boat_id: col.boatId,
            discipline,
            departure_time: selectedTemplate?.default_departure_time || '',
            return_time: selectedTemplate?.default_return_time || '',
            instructor_ids: col.instructorIds,
          }),
        });
        if (res.ok) {
          ok++;
        } else {
          fail++;
          const j = await res.json().catch(() => ({}));
          errors.push(`${boat?.name || 'Barca'}: ${j.error || 'errore'}`);
        }
      } catch (e) {
        fail++;
        errors.push(`${boat?.name || 'Barca'}: ${e instanceof Error ? e.message : 'errore rete'}`);
      }
    }

    setResult({ ok, fail, errors });
    setCreating(false);
    if (ok > 0) {
      // ricarica prenotati (quelli assegnati sono ora 'assigned')
      await loadBookings(selectedTemplate!.id);
      setColumns([]);
      onCreated();
    }
  }

  // === RENDER ===
  if (!selectedTemplate) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-text-muted">
          Scegli la sessione da pianificare. Vedrai i prenotati di quella sessione come bolle da assegnare alle barche.
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTemplate(t)}
              className="p-4 rounded-lg border border-border bg-bg-surface hover:border-accent hover:bg-bg-elevated text-left transition-colors"
            >
              <div className="font-display font-semibold text-text">{t.name}</div>
              {t.default_departure_time && (
                <div className="text-xs text-text-dim mt-1">
                  {t.default_departure_time.slice(0, 5)}
                  {t.default_return_time && ` - ${t.default_return_time.slice(0, 5)}`}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const usedBoatIds = new Set(columns.map((c) => c.boatId));
  const unassignedCount = cestoBookings.length;

  return (
    <div className="space-y-5">
      {/* Header sessione scelta */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setSelectedTemplate(null); setColumns([]); }}
            className="text-xs text-accent hover:underline"
          >
            ← Cambia sessione
          </button>
          <span className="font-display font-semibold text-lg">{selectedTemplate.name}</span>
        </div>
        {columns.length > 0 && (
          <Button onClick={createDrafts} disabled={creating || assignedIds.size === 0}>
            {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Crea bozze ({columns.filter((c) => c.bookingIds.length > 0).length})
          </Button>
        )}
      </div>

      {/* Risultato creazione */}
      {result && (
        <div className={cn(
          'p-3 rounded border text-sm',
          result.fail === 0 ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
            : 'border-amber-500/30 bg-amber-500/5 text-amber-400'
        )}>
          {result.ok > 0 && <div>{result.ok} bozze create. Rivedile nella scheda &quot;Uscite barca&quot;.</div>}
          {result.errors.map((e, i) => <div key={i} className="text-xs mt-1">{e}</div>)}
        </div>
      )}

      {/* Selezione barche */}
      <div>
        <div className="text-xs font-medium text-text-muted mb-2 flex items-center gap-1.5">
          <Anchor className="h-3.5 w-3.5" /> Barche da usare (spunta per aprire una colonna)
        </div>
        <div className="flex flex-wrap gap-2">
          {boats.map((b) => {
            const active = usedBoatIds.has(b.id);
            return (
              <button
                key={b.id}
                onClick={() => toggleBoatColumn(b.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg border text-sm flex items-center gap-1.5 transition-colors',
                  active ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-bg-surface text-text-muted hover:border-text-dim'
                )}
              >
                {active ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {b.name}
                {b.capacity && <span className="text-[10px] opacity-70">({b.capacity})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-text-muted">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          {/* CESTO prenotati */}
          <div className="rounded-lg border border-border bg-bg-surface p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-text flex items-center gap-1.5">
                <Inbox className="h-4 w-4 text-accent" /> Da assegnare
              </div>
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded',
                unassignedCount > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
              )}>
                {unassignedCount}
              </span>
            </div>

            {bookings.length === 0 ? (
              <div className="text-xs text-text-dim text-center py-6">
                Nessun prenotato per questa sessione.
              </div>
            ) : (
              <div className="space-y-1.5">
                {cestoBookings.map((b) => (
                  <BubbleChip
                    key={b.id}
                    booking={b}
                    draggable
                    onDragStart={() => setDraggingId(b.id)}
                    onDragEnd={() => setDraggingId(null)}
                    onTap={() => setPickBooking(pickBooking === b.id ? null : b.id)}
                    picking={pickBooking === b.id}
                  />
                ))}
                {cestoBookings.length === 0 && (
                  <div className="text-xs text-emerald-400 text-center py-4 flex items-center justify-center gap-1.5">
                    <Check className="h-4 w-4" /> Tutti assegnati
                  </div>
                )}

                {/* Menu mobile: assegna a colonna */}
                {pickBooking && columns.length > 0 && (
                  <div className="mt-2 p-2 rounded bg-bg-elevated border border-border">
                    <div className="text-[10px] text-text-muted mb-1.5">Assegna a:</div>
                    <div className="flex flex-wrap gap-1">
                      {columns.map((c) => {
                        const boat = boats.find((bo) => bo.id === c.boatId);
                        return (
                          <button
                            key={c.boatId}
                            onClick={() => assignBooking(pickBooking, c.boatId)}
                            className="text-xs px-2 py-1 rounded bg-accent/10 text-accent hover:bg-accent/20"
                          >
                            {boat?.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* COLONNE barche */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {columns.length === 0 ? (
              <div className="col-span-full rounded-lg border border-dashed border-border p-8 text-center text-sm text-text-dim">
                Spunta almeno una barca sopra per aprire una colonna.
              </div>
            ) : (
              columns.map((col) => {
                const boat = boats.find((b) => b.id === col.boatId);
                const count = col.bookingIds.length;
                const cap = boat?.capacity || null;
                const over = cap !== null && count > cap;
                return (
                  <div
                    key={col.boatId}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (draggingId) assignBooking(draggingId, col.boatId); }}
                    className={cn(
                      'rounded-lg border bg-bg-surface flex flex-col',
                      draggingId ? 'border-accent border-dashed' : 'border-border'
                    )}
                  >
                    {/* Header colonna */}
                    <div className="p-2.5 border-b border-border">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-sm flex items-center gap-1.5">
                          <Sailboat className="h-4 w-4 text-accent" />
                          {boat?.name}
                        </div>
                        <span className={cn(
                          'text-xs px-1.5 py-0.5 rounded',
                          over ? 'bg-red-500/10 text-red-400'
                            : count > 0 ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-bg-elevated text-text-dim'
                        )}>
                          {count}{cap ? `/${cap}` : ''}
                        </span>
                      </div>

                      {over && (
                        <div className="mt-1 text-[10px] text-red-400 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Oltre la capienza ({cap})
                        </div>
                      )}

                      {/* Istruttori */}
                      <InstructorPicker
                        instructors={instructors}
                        selectedIds={col.instructorIds}
                        onToggle={(id) => toggleColumnInstructor(col.boatId, id)}
                      />
                    </div>

                    {/* Bolle assegnate */}
                    <div className="p-2 space-y-1.5 flex-1 min-h-[80px]">
                      {col.bookingIds.length === 0 ? (
                        <div className="text-[10px] text-text-dim text-center py-4">
                          Trascina qui i prenotati
                        </div>
                      ) : (
                        col.bookingIds.map((bid) => {
                          const b = bookingById[bid];
                          if (!b) return null;
                          return (
                            <BubbleChip
                              key={bid}
                              booking={b}
                              inColumn
                              onRemove={() => removeFromColumn(bid)}
                            />
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Avviso non assegnati */}
      {columns.length > 0 && unassignedCount > 0 && (
        <div className="p-3 rounded border border-amber-500/30 bg-amber-500/5 text-sm text-amber-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Attenzione: {unassignedCount} {unassignedCount === 1 ? 'prenotato non è' : 'prenotati non sono'} ancora assegnati a nessuna barca.
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Bolla prenotato
// ============================================================================
function BubbleChip({
  booking: b, draggable, inColumn, picking,
  onDragStart, onDragEnd, onTap, onRemove,
}: {
  booking: BookingWithMember;
  draggable?: boolean;
  inColumn?: boolean;
  picking?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onTap?: () => void;
  onRemove?: () => void;
}) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onTap}
      className={cn(
        'px-2.5 py-1.5 rounded-lg border text-sm flex items-center justify-between gap-2 select-none',
        picking ? 'border-accent bg-accent/10' : 'border-border bg-bg-elevated',
        draggable && 'cursor-grab active:cursor-grabbing',
        onTap && 'cursor-pointer'
      )}
    >
      <div className="min-w-0">
        <div className="font-medium text-text truncate">
          {b.first_name} {b.last_name}
        </div>
        {b.preferred_discipline && (
          <div className="text-[10px] text-text-dim">
            {DISCIPLINE_LABELS[b.preferred_discipline as LiftDiscipline] || b.preferred_discipline}
            {b.participation_type && ` · ${PARTICIPATION_LABELS[b.participation_type]}`}
          </div>
        )}
      </div>
      {inColumn && onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-0.5 rounded hover:bg-red-500/10 text-text-dim hover:text-red-400 shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Selettore istruttori per colonna
// ============================================================================
function InstructorPicker({
  instructors, selectedIds, onToggle,
}: {
  instructors: Instructor[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = instructors.filter((i) => selectedIds.includes(i.id));

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 text-xs px-2 py-1 rounded bg-bg-elevated border border-border text-text-muted hover:border-text-dim"
      >
        <span className="flex items-center gap-1.5">
          <GraduationCap className="h-3.5 w-3.5" />
          {selected.length === 0
            ? 'Istruttori'
            : selected.map((i) => i.first_name).join(', ')}
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-1 p-1.5 rounded bg-bg border border-border space-y-0.5 max-h-40 overflow-y-auto">
          {instructors.map((i) => {
            const on = selectedIds.includes(i.id);
            return (
              <button
                key={i.id}
                onClick={() => onToggle(i.id)}
                className={cn(
                  'w-full flex items-center gap-2 text-xs px-2 py-1 rounded text-left',
                  on ? 'bg-accent/10 text-accent' : 'text-text-muted hover:bg-bg-elevated'
                )}
              >
                <span className={cn('h-3 w-3 rounded border flex items-center justify-center', on ? 'border-accent bg-accent/20' : 'border-border')}>
                  {on && <Check className="h-2.5 w-2.5" />}
                </span>
                {i.first_name} {i.last_name}
                <span className="text-[9px] text-text-dim ml-auto">{i.role}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
