'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Loader2, Sailboat, GraduationCap, AlertTriangle, Check,
  Plus, X, ChevronDown, Anchor, Inbox, Sparkles, Cloud,
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

interface Column {
  boatId: string;
  instructorIds: string[];
  bookingIds: string[];
}

interface DragState {
  bookingId: string;
  x: number;
  y: number;
  active: boolean;   // true dopo aver superato la soglia di movimento
  hoverDropId: string | null; // 'cesto' o boatId
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

  // Tap-to-assign (alternativa al drag)
  const [pickBooking, setPickBooking] = useState<string | null>(null);

  // Drag pointer-based (mouse + touch)
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  const startPos = useRef<{ x: number; y: number } | null>(null);

  // Salvataggio condiviso
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(true); // non salvare al primo load

  // ============== CARICAMENTO ==============
  const loadAll = useCallback(async (templateId: string) => {
    setLoading(true);
    setResult(null);
    try {
      const [bookingsRes, planRes] = await Promise.all([
        fetch(`/api/bookings?date=${date}`),
        fetch(`/api/planning/piano?date=${date}&template_id=${templateId}`),
      ]);

      let loadedBookings: BookingWithMember[] = [];
      if (bookingsRes.ok) {
        const data = await bookingsRes.json();
        const all: BookingWithMember[] = data.bookings || data || [];
        loadedBookings = all.filter(
          (b) => b.session_template_id === templateId && b.status === 'pending'
        );
      }
      setBookings(loadedBookings);

      // Ripristina piano salvato, tenendo solo bookingIds ancora validi/pending
      if (planRes.ok) {
        const plan = await planRes.json();
        const validIds = new Set(loadedBookings.map((b) => b.id));
        const restored: Column[] = (plan.columns || [])
          .map((c: Column) => ({
            boatId: c.boatId,
            instructorIds: c.instructorIds || [],
            bookingIds: (c.bookingIds || []).filter((id: string) => validIds.has(id)),
          }))
          // tieni solo colonne di barche ancora esistenti
          .filter((c: Column) => boats.some((b) => b.id === c.boatId));
        skipNextSave.current = true;
        setColumns(restored);
      } else {
        skipNextSave.current = true;
        setColumns([]);
      }
    } finally {
      setLoading(false);
    }
  }, [date, boats]);

  useEffect(() => {
    if (selectedTemplate) loadAll(selectedTemplate.id);
  }, [selectedTemplate, loadAll]);

  // ============== AUTO-SAVE (debounce 1.2s) ==============
  useEffect(() => {
    if (!selectedTemplate) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch('/api/planning/piano', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date,
            template_id: selectedTemplate.id,
            columns,
          }),
        });
        setSaveState('saved');
      } catch {
        setSaveState('idle');
      }
    }, 1200);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [columns, selectedTemplate, date]);

  // ============== INDICI ==============
  const assignedIds = useMemo(() => new Set(columns.flatMap((c) => c.bookingIds)), [columns]);
  const cestoBookings = bookings.filter((b) => !assignedIds.has(b.id));
  const bookingById = useMemo(() => {
    const m: Record<string, BookingWithMember> = {};
    bookings.forEach((b) => { m[b.id] = b; });
    return m;
  }, [bookings]);

  // ============== AZIONI COLONNE ==============
  function toggleBoatColumn(boatId: string) {
    setColumns((prev) => {
      const exists = prev.find((c) => c.boatId === boatId);
      if (exists) return prev.filter((c) => c.boatId !== boatId);
      return [...prev, { boatId, instructorIds: [], bookingIds: [] }];
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

  const assignBooking = useCallback((bookingId: string, boatId: string) => {
    setColumns((prev) => prev.map((c) => {
      const cleaned = c.bookingIds.filter((id) => id !== bookingId);
      if (c.boatId === boatId) return { ...c, bookingIds: [...cleaned, bookingId] };
      return { ...c, bookingIds: cleaned };
    }));
    setPickBooking(null);
  }, []);

  const removeFromColumns = useCallback((bookingId: string) => {
    setColumns((prev) => prev.map((c) => ({
      ...c,
      bookingIds: c.bookingIds.filter((id) => id !== bookingId),
    })));
  }, []);

  // ============== DRAG POINTER-BASED (mouse + touch) ==============
  const onBubblePointerDown = useCallback((e: React.PointerEvent, bookingId: string) => {
    // Solo tasto principale / tocco
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startPos.current = { x: e.clientX, y: e.clientY };
    setDrag({ bookingId, x: e.clientX, y: e.clientY, active: false, hoverDropId: null });
  }, []);

  useEffect(() => {
    if (!drag) return;

    function findDropId(x: number, y: number): string | null {
      const el = document.elementFromPoint(x, y);
      const drop = el?.closest('[data-drop-id]') as HTMLElement | null;
      return drop?.dataset.dropId || null;
    }

    function onMove(e: PointerEvent) {
      const cur = dragRef.current;
      if (!cur || !startPos.current) return;
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      const dist = Math.hypot(dx, dy);
      const active = cur.active || dist > 8;
      if (active) e.preventDefault(); // blocca lo scroll durante il drag
      setDrag({
        ...cur,
        x: e.clientX,
        y: e.clientY,
        active,
        hoverDropId: active ? findDropId(e.clientX, e.clientY) : null,
      });
    }

    function onUp(e: PointerEvent) {
      const cur = dragRef.current;
      startPos.current = null;
      if (!cur) return;
      if (cur.active) {
        const dropId = findDropId(e.clientX, e.clientY);
        if (dropId === 'cesto') {
          removeFromColumns(cur.bookingId);
        } else if (dropId) {
          assignBooking(cur.bookingId, dropId);
        }
        // drop fuori: nessuna azione, resta dov'era
      } else {
        // Era un tap: apri/chiudi menu assegnazione
        setPickBooking((prev) => (prev === cur.bookingId ? null : cur.bookingId));
      }
      setDrag(null);
    }

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [drag, assignBooking, removeFromColumns]);

  // ============== CREA BOZZE ==============
  async function createDrafts() {
    const validColumns = columns.filter((c) => c.bookingIds.length > 0);
    if (validColumns.length === 0 || !selectedTemplate) return;

    setCreating(true);
    setResult(null);
    let ok = 0, fail = 0;
    const errors: string[] = [];

    for (const col of validColumns) {
      const boat = boats.find((b) => b.id === col.boatId);
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
            session_template_id: selectedTemplate.id,
            boat_id: col.boatId,
            discipline,
            departure_time: selectedTemplate.default_departure_time || '',
            return_time: selectedTemplate.default_return_time || '',
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
      // Azzera il piano salvato (le uscite ora esistono come bozze)
      try {
        await fetch('/api/planning/piano', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, template_id: selectedTemplate.id, columns: [] }),
        });
      } catch { /* non bloccante */ }
      await loadAll(selectedTemplate.id);
      onCreated();
    }
  }

  // ============== RENDER ==============
  if (!selectedTemplate) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-text-muted">
          Scegli la sessione da pianificare. Il piano si salva da solo ed e visibile a tutto lo staff.
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
  const draggedBooking = drag?.active ? bookingById[drag.bookingId] : null;

  return (
    <div className="space-y-5">
      {/* Ghost del drag */}
      {draggedBooking && (
        <div
          className="fixed z-50 pointer-events-none px-3 py-1.5 rounded-lg bg-accent text-bg text-sm font-medium shadow-lg"
          style={{ left: drag!.x + 10, top: drag!.y - 20 }}
        >
          {draggedBooking.first_name} {draggedBooking.last_name}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setSelectedTemplate(null); setColumns([]); }}
            className="text-xs text-accent hover:underline"
          >
            ← Cambia sessione
          </button>
          <span className="font-display font-semibold text-lg">{selectedTemplate.name}</span>
          {/* Indicatore salvataggio */}
          <span className={cn(
            'text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded',
            saveState === 'saving' ? 'text-amber-400' : saveState === 'saved' ? 'text-emerald-400' : 'text-text-dim'
          )}>
            <Cloud className="h-3 w-3" />
            {saveState === 'saving' ? 'Salvataggio...' : saveState === 'saved' ? 'Salvato' : 'Condiviso'}
          </span>
        </div>
        {columns.length > 0 && (
          <Button onClick={createDrafts} disabled={creating || assignedIds.size === 0}>
            {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Crea bozze ({columns.filter((c) => c.bookingIds.length > 0).length})
          </Button>
        )}
      </div>

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
          {/* CESTO */}
          <div
            data-drop-id="cesto"
            className={cn(
              'rounded-lg border bg-bg-surface p-3 transition-colors',
              drag?.active && drag.hoverDropId === 'cesto' ? 'border-accent bg-accent/5' : 'border-border'
            )}
          >
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
                    picking={pickBooking === b.id}
                    dragging={drag?.active && drag.bookingId === b.id}
                    onPointerDown={(e) => onBubblePointerDown(e, b.id)}
                  />
                ))}
                {cestoBookings.length === 0 && (
                  <div className="text-xs text-emerald-400 text-center py-4 flex items-center justify-center gap-1.5">
                    <Check className="h-4 w-4" /> Tutti assegnati
                  </div>
                )}

                {/* Menu tap-to-assign */}
                {pickBooking && columns.length > 0 && assignedIds.has(pickBooking) === false && (
                  <div className="mt-2 p-2 rounded bg-bg-elevated border border-border">
                    <div className="text-[10px] text-text-muted mb-1.5">
                      Assegna {bookingById[pickBooking]?.first_name} a:
                    </div>
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

          {/* COLONNE */}
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
                const isHover = drag?.active && drag.hoverDropId === col.boatId;
                return (
                  <div
                    key={col.boatId}
                    data-drop-id={col.boatId}
                    className={cn(
                      'rounded-lg border bg-bg-surface flex flex-col transition-colors',
                      isHover ? 'border-accent bg-accent/5'
                        : drag?.active ? 'border-dashed border-accent/40'
                        : 'border-border'
                    )}
                  >
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

                      <InstructorPicker
                        instructors={instructors}
                        selectedIds={col.instructorIds}
                        onToggle={(id) => toggleColumnInstructor(col.boatId, id)}
                      />
                    </div>

                    <div className="p-2 space-y-1.5 flex-1 min-h-[80px]">
                      {col.bookingIds.length === 0 ? (
                        <div className="text-[10px] text-text-dim text-center py-4">
                          Trascina o tocca un prenotato per assegnarlo
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
                              dragging={drag?.active && drag.bookingId === bid}
                              onPointerDown={(e) => onBubblePointerDown(e, bid)}
                              onRemove={() => removeFromColumns(bid)}
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
// Bolla prenotato — pointer-based, touch-action none per drag su mobile
// ============================================================================
function BubbleChip({
  booking: b, inColumn, picking, dragging,
  onPointerDown, onRemove,
}: {
  booking: BookingWithMember;
  inColumn?: boolean;
  picking?: boolean;
  dragging?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onRemove?: () => void;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      style={{ touchAction: 'none' }}
      className={cn(
        'px-2.5 py-1.5 rounded-lg border text-sm flex items-center justify-between gap-2 select-none cursor-grab active:cursor-grabbing',
        picking ? 'border-accent bg-accent/10' : 'border-border bg-bg-elevated',
        dragging && 'opacity-40'
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
          onPointerDown={(e) => e.stopPropagation()}
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
