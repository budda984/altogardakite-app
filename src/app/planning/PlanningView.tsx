'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, Plus, Loader2, Anchor, Users, Wind,
  Trash2, Settings, CalendarDays, Sparkles, Lock, Unlock, CheckCircle2, AlertCircle,
  Pencil, XCircle,
} from 'lucide-react';
import type {
  Boat, Instructor, Member, Service, SessionTemplate,
  LiftDiscipline, WindSession, OutingStatus,
} from '@/lib/types';
import {
  DISCIPLINE_LABELS, WIND_SESSION_LABELS, INSTRUCTOR_ROLE_LABELS,
} from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import AddOutingModal from './AddOutingModal';
import AddParticipantModal from './AddParticipantModal';
import GenerateDayModal from './GenerateDayModal';
import EditOutingModal from './EditOutingModal';
import CancelOutingModal from './CancelOutingModal';
import BookingsView from './BookingsView';
import WeekView from './WeekView';
import AdvancedPlanner from './AdvancedPlanner';

interface OutingParticipant {
  id: string;
  participation_type: string;
  rental_type: string;
  member: { id: string; first_name: string; last_name: string } | null;
}
interface OutingInstructor {
  instructor_id: string;
  role: string | null;
  instructor: { id: string; first_name: string; last_name: string; role: string } | null;
}
interface OutingFull {
  id: string;
  outing_date: string;
  boat_id: string;
  session_template_id: string | null;
  discipline: LiftDiscipline | null;
  wind_session: WindSession | null;
  departure_time: string | null;
  return_time: string | null;
  weather_notes: string | null;
  notes: string | null;
  status: OutingStatus;
  closed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  boat: { id: string; name: string; boat_type: string; capacity: number | null } | null;
  outing_instructors: OutingInstructor[];
  outing_participants: OutingParticipant[];
}

interface Props {
  initialDate: string;
  boats: Boat[];
  instructors: Instructor[];
  members: Pick<Member, 'id' | 'first_name' | 'last_name' | 'membership_number'>[];
  services: Service[];
  isAdmin: boolean;
}

function formatItalianDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function PlanningView({
  initialDate, boats, instructors, members, services, isAdmin,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [date, setDate] = useState(initialDate);
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [outings, setOutings] = useState<OutingFull[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOutingFor, setAddOutingFor] = useState<{ template: SessionTemplate | null } | null>(null);
  const [addParticipantFor, setAddParticipantFor] = useState<OutingFull | null>(null);
  const [editOutingFor, setEditOutingFor] = useState<OutingFull | null>(null);
  const [cancelOutingFor, setCancelOutingFor] = useState<OutingFull | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);

  // Vista corrente: prenotazioni (lista persone per slot) o uscite (vista per barca)
  const [view, setView] = useState<'bookings' | 'outings' | 'week' | 'planner'>('bookings');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/planning?date=${date}`);
    if (res.ok) {
      const data = await res.json();
      setTemplates(data.templates || []);
      setOutings(data.outings || []);
    }
    setLoading(false);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const navigate = (d: string) => {
    setDate(d);
    const sp = new URLSearchParams(searchParams);
    sp.set('date', d);
    router.replace(`/planning?${sp}`, { scroll: false });
  };

  const today = new Date().toISOString().slice(0, 10);
  const isToday = date === today;

  // Raggruppa uscite per template
  const outingsByTemplate = new Map<string, OutingFull[]>();
  const outingsWithoutTemplate: OutingFull[] = [];
  outings.forEach((o) => {
    if (o.session_template_id) {
      const arr = outingsByTemplate.get(o.session_template_id) || [];
      arr.push(o);
      outingsByTemplate.set(o.session_template_id, arr);
    } else {
      outingsWithoutTemplate.push(o);
    }
  });

  const handleDeleteOuting = async (outingId: string) => {
    if (!confirm('Eliminare questa uscita? (non possibile se ci sono partecipanti)')) return;
    const res = await fetch(`/api/uscite/${outingId}`, { method: 'DELETE' });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || 'Errore');
      return;
    }
    load();
  };

  const handleRemoveParticipant = async (outingId: string, participantId: string) => {
    if (!confirm('Rimuovere il partecipante?')) return;
    const res = await fetch(
      `/api/planning/uscita/${outingId}/partecipanti?participant_id=${participantId}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || 'Errore');
      return;
    }
    load();
  };

  const handleCloseOuting = async (outing: OutingFull) => {
    const partCount = outing.outing_participants.length;
    if (partCount === 0) {
      if (!confirm('Questa uscita non ha partecipanti. Chiuderla comunque?')) return;
    } else {
      if (!confirm(
        `Chiudere l'uscita su ${outing.boat?.name || ''}?\n\n` +
        `Saranno generati gli addebiti per ${partCount} ${partCount === 1 ? 'partecipante' : 'partecipanti'} ` +
        `rispettando i loro abbonamenti e pacchetti.\n\n` +
        `Solo gli admin potranno riaprirla.`
      )) return;
    }
    const res = await fetch(`/api/planning/uscita/${outing.id}/chiudi`, { method: 'POST' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(j.error || 'Errore');
      return;
    }
    alert(
      `Uscita chiusa.\n\n` +
      `Addebiti generati: ${j.charges_created || 0}\n` +
      `Lift consumati da pacchetti: ${j.lifts_consumed || 0}\n` +
      `Coperti da abbonamento: ${j.subscriptions_used || 0}\n` +
      `Totale addebitato: € ${Number(j.total_charged || 0).toFixed(2)}`
    );
    load();
  };

  const handleReopenOuting = async (outing: OutingFull) => {
    if (!confirm(
      `Riaprire l'uscita su ${outing.boat?.name || ''}?\n\n` +
      `Tutti gli addebiti generati saranno stornati e i lift consumati saranno ripristinati. ` +
      `L'uscita tornerà in stato bozza per eventuali modifiche.`
    )) return;
    const res = await fetch(`/api/planning/uscita/${outing.id}/riapri`, { method: 'POST' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(j.error || 'Errore');
      return;
    }
    alert(
      `Uscita riaperta.\n\n` +
      `Movimenti stornati: ${j.movements_reversed || 0}\n` +
      `Lift ripristinati: ${j.lifts_restored || 0}`
    );
    load();
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl pb-24 lg:pb-10">
      {/* Header con navigazione data */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-3">
            <CalendarDays className="h-7 w-7 text-accent" />
            Planning
          </h1>
          <p className="text-sm text-text-muted mt-1 capitalize">
            {formatItalianDate(date)}
            {isToday && <span className="ml-2 text-xs text-accent">· oggi</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/planning/template"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-bg-elevated text-text-muted hover:text-text"
          >
            <Settings className="h-3.5 w-3.5" />
            Template sessioni
          </Link>
          <Button size="sm" variant="secondary" onClick={() => setShowGenerate(true)}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Genera giorno standard
          </Button>
          <Button size="sm" onClick={() => setAddOutingFor({ template: null })}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Aggiungi uscita
          </Button>
        </div>
      </div>

      {/* Date navigator (solo viste giornaliere) */}
      {view !== 'week' && (
      <div className="bg-bg-surface border border-border rounded-lg p-4 mb-6 flex items-center justify-between gap-3">
        <button
          onClick={() => navigate(shiftDate(date, -1))}
          className="p-2 rounded hover:bg-bg-elevated text-text-muted hover:text-text"
          aria-label="Giorno precedente"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-sm font-display font-semibold text-text capitalize">
            {new Date(date + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long' })}
          </span>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={date}
              onChange={(e) => navigate(e.target.value)}
              className="bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/50"
              style={{ colorScheme: 'dark' }}
            />
            {!isToday && (
              <button
                onClick={() => navigate(today)}
                className="text-xs px-2 py-1 rounded bg-accent/10 text-accent hover:bg-accent/20"
              >
                Vai a oggi
              </button>
            )}
          </div>
        </div>
        <button
          onClick={() => navigate(shiftDate(date, 1))}
          className="p-2 rounded hover:bg-bg-elevated text-text-muted hover:text-text"
          aria-label="Giorno successivo"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      )}

      {/* TAB SWITCHER: Prenotazioni / Uscite barca / Settimana */}
      <div className="flex gap-2 mb-4 border-b border-border">
        <button
          onClick={() => setView('bookings')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            view === 'bookings'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-muted hover:text-text'
          )}
        >
          Prenotazioni
        </button>
        <button
          onClick={() => setView('outings')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            view === 'outings'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-muted hover:text-text'
          )}
        >
          Uscite barca
          {outings.length > 0 && (
            <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-bg-elevated text-text-muted">
              {outings.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setView('week')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5',
            view === 'week'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-muted hover:text-text'
          )}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Settimana
        </button>
        <button
          onClick={() => setView('planner')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5',
            view === 'planner'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-muted hover:text-text'
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Planner
        </button>
      </div>

      {view === 'planner' && (
        <AdvancedPlanner
          date={date}
          templates={templates}
          boats={boats}
          instructors={instructors}
          onCreated={load}
        />
      )}

      {view === 'week' && (
        <WeekView
          initialStart={date}
          onOpenDay={(d) => { navigate(d); setView('bookings'); }}
        />
      )}

      {view === 'bookings' && (
        <BookingsView
          date={date}
          templates={templates}
          boats={boats}
          instructors={instructors}
          members={members.filter((m) => {
            const mm = m as { active?: boolean; member_type?: string };
            return mm.active !== false && mm.member_type !== 'sostenitore';
          })}
          onOutingCreated={() => {
            load();
            setView('outings');
          }}
        />
      )}

      {view === 'outings' && loading ? (
        <div className="p-12 text-center bg-bg-surface border border-border rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-text-muted" />
        </div>
      ) : view === 'outings' ? (
        <div className="space-y-6">
          {/* Sessioni dei template attivi */}
          {templates
            .filter((t) => t.is_default || (outingsByTemplate.get(t.id) || []).length > 0)
            .map((t) => (
              <SessionBlock
                key={t.id}
                template={t}
                outings={outingsByTemplate.get(t.id) || []}
                isAdmin={isAdmin}
                onAddBoat={() => setAddOutingFor({ template: t })}
                onAddParticipant={(o) => setAddParticipantFor(o)}
                onDeleteOuting={handleDeleteOuting}
                onRemoveParticipant={handleRemoveParticipant}
                onCloseOuting={handleCloseOuting}
                onReopenOuting={handleReopenOuting}
                onEditOuting={(o) => setEditOutingFor(o)}
                onCancelOuting={(o) => setCancelOutingFor(o)}
              />
            ))
          }

          {/* Template non-default che vuoi aggiungere oggi (es. wingfoil) */}
          {templates.filter((t) => !t.is_default && (outingsByTemplate.get(t.id) || []).length === 0).length > 0 && (
            <div className="bg-bg-surface border border-dashed border-border rounded-lg p-5">
              <div className="text-sm text-text-muted mb-3">
                Sessioni opzionali (non generate automaticamente):
              </div>
              <div className="flex flex-wrap gap-2">
                {templates.filter((t) => !t.is_default && (outingsByTemplate.get(t.id) || []).length === 0).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setAddOutingFor({ template: t })}
                    className="text-xs px-3 py-1.5 rounded bg-bg-elevated border border-border hover:border-accent text-text-muted hover:text-accent flex items-center gap-1.5"
                  >
                    <Plus className="h-3 w-3" />
                    {t.name} ({DISCIPLINE_LABELS[t.discipline]})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Uscite extra senza template */}
          {outingsWithoutTemplate.length > 0 && (
            <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
              <div className="p-4 border-b border-border bg-bg-elevated/50">
                <h3 className="font-display font-semibold tracking-tight">Uscite extra</h3>
                <p className="text-[10px] uppercase tracking-widest text-text-dim mt-0.5">
                  Non collegate a un template di sessione
                </p>
              </div>
              <div className="divide-y divide-border">
                {outingsWithoutTemplate.map((o) => (
                  <BoatOuting
                    key={o.id}
                    outing={o}
                    isAdmin={isAdmin}
                    onAddParticipant={() => setAddParticipantFor(o)}
                    onDelete={() => handleDeleteOuting(o.id)}
                    onRemoveParticipant={(pid) => handleRemoveParticipant(o.id, pid)}
                    onClose={() => handleCloseOuting(o)}
                    onReopen={() => handleReopenOuting(o)}
                    onEdit={() => setEditOutingFor(o)}
                    onCancel={() => setCancelOutingFor(o)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state se non ci sono ne template default ne uscite */}
          {templates.filter((t) => t.is_default).length === 0 && outings.length === 0 && (
            <div className="bg-bg-surface border border-border rounded-lg p-12 text-center">
              <CalendarDays className="h-10 w-10 mx-auto text-text-dim mb-3" />
              <p className="text-text-muted">Nessun template di sessione configurato.</p>
              <Link href="/planning/template" className="text-accent hover:underline text-sm mt-2 inline-block">
                Configura i template
              </Link>
            </div>
          )}
        </div>
      ) : null}

      {/* Modali */}
      {addOutingFor && (
        <AddOutingModal
          open={true}
          onClose={() => setAddOutingFor(null)}
          date={date}
          template={addOutingFor.template}
          boats={boats}
          instructors={instructors}
          existingBoats={
            addOutingFor.template
              ? (outingsByTemplate.get(addOutingFor.template.id) || []).map((o) => o.boat_id)
              : []
          }
          onSuccess={load}
        />
      )}

      {addParticipantFor && (
        <AddParticipantModal
          open={true}
          onClose={() => setAddParticipantFor(null)}
          outing={addParticipantFor}
          members={members}
          services={services}
          onSuccess={load}
        />
      )}

      {showGenerate && (
        <GenerateDayModal
          open={true}
          onClose={() => setShowGenerate(false)}
          date={date}
          boats={boats}
          templates={templates.filter((t) => t.is_default)}
          existingOutings={outings}
          onSuccess={load}
        />
      )}

      {editOutingFor && (
        <EditOutingModal
          open={true}
          onClose={() => setEditOutingFor(null)}
          outing={editOutingFor}
          boats={boats}
          instructors={instructors}
          onSuccess={load}
        />
      )}

      {cancelOutingFor && (
        <CancelOutingModal
          open={true}
          onClose={() => setCancelOutingFor(null)}
          outingId={cancelOutingFor.id}
          boatName={cancelOutingFor.boat?.name || ''}
          wasClosedBefore={cancelOutingFor.status === 'chiusa'}
          participantCount={cancelOutingFor.outing_participants.length}
          onSuccess={load}
        />
      )}
    </div>
  );
}

// ============================================================================
// SESSION BLOCK (es. "Peler" con tutte le barche assegnate)
// ============================================================================
function SessionBlock({
  template, outings, isAdmin, onAddBoat, onAddParticipant, onDeleteOuting,
  onRemoveParticipant, onCloseOuting, onReopenOuting, onEditOuting, onCancelOuting,
}: {
  template: SessionTemplate;
  outings: OutingFull[];
  isAdmin: boolean;
  onAddBoat: () => void;
  onAddParticipant: (o: OutingFull) => void;
  onDeleteOuting: (id: string) => void;
  onRemoveParticipant: (outingId: string, pid: string) => void;
  onCloseOuting: (o: OutingFull) => void;
  onReopenOuting: (o: OutingFull) => void;
  onEditOuting: (o: OutingFull) => void;
  onCancelOuting: (o: OutingFull) => void;
}) {
  const totalParticipants = outings.reduce((acc, o) => acc + o.outing_participants.length, 0);
  const allClosed = outings.length > 0 && outings.every((o) => o.status === 'chiusa');
  const someClosed = outings.some((o) => o.status === 'chiusa');

  return (
    <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border flex items-start justify-between gap-3 bg-bg-elevated/30">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-lg font-semibold tracking-tight">{template.name}</h3>
            <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">
              {DISCIPLINE_LABELS[template.discipline]}
            </span>
            {template.wind_session && (
              <span className="text-xs px-2 py-0.5 rounded bg-bg-elevated text-text-muted flex items-center gap-1">
                <Wind className="h-3 w-3" />
                {WIND_SESSION_LABELS[template.wind_session]}
              </span>
            )}
            {allClosed && (
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Tutte chiuse
              </span>
            )}
            {someClosed && !allClosed && (
              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">
                Alcune ancora bozza
              </span>
            )}
          </div>
          <div className="text-xs text-text-muted mt-1">
            Orario standard: {template.default_departure_time.slice(0, 5)} – {template.default_return_time.slice(0, 5)}
            {' · '}
            {outings.length} {outings.length === 1 ? 'barca' : 'barche'}
            {totalParticipants > 0 && ` · ${totalParticipants} partecipanti`}
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={onAddBoat}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Aggiungi barca
        </Button>
      </div>

      {outings.length === 0 ? (
        <div className="p-6 text-center text-sm text-text-muted">
          Nessuna barca ancora assegnata a questa sessione.
          <button onClick={onAddBoat} className="text-accent hover:underline ml-2">
            Aggiungi la prima
          </button>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {outings.map((o) => (
            <BoatOuting
              key={o.id}
              outing={o}
              isAdmin={isAdmin}
              onAddParticipant={() => onAddParticipant(o)}
              onDelete={() => onDeleteOuting(o.id)}
              onRemoveParticipant={(pid) => onRemoveParticipant(o.id, pid)}
              onClose={() => onCloseOuting(o)}
              onReopen={() => onReopenOuting(o)}
              onEdit={() => onEditOuting(o)}
              onCancel={() => onCancelOuting(o)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// BOAT OUTING (una barca con i suoi partecipanti)
// ============================================================================
const RENTAL_LABELS_SHORT: Record<string, string> = {
  completo: 'Kit completo',
  wing_completo: 'Wingfoil',
  solo_kite: 'Kite',
  solo_tavola: 'Tavola',
  solo_barra: 'Barra',
  solo_trapezio: 'Trapezio',
  solo_muta: 'Muta',
  solo_giubbotto: 'Giubbotto',
  altro: 'Altro',
  nessuno: '',
};

const PARTECIPATION_COLORS: Record<string, string> = {
  corso: 'bg-blue-500/10 text-blue-400',
  lift_supervisionato: 'bg-purple-500/10 text-purple-400',
  lift_semplice: 'bg-emerald-500/10 text-emerald-400',
};

const PARTECIPATION_LABELS: Record<string, string> = {
  corso: 'Corso',
  lift_supervisionato: 'Lift assistito',
  lift_semplice: 'Lift',
};

function BoatOuting({
  outing, isAdmin, onAddParticipant, onDelete, onRemoveParticipant,
  onClose, onReopen, onEdit, onCancel,
}: {
  outing: OutingFull;
  isAdmin: boolean;
  onAddParticipant: () => void;
  onDelete: () => void;
  onRemoveParticipant: (pid: string) => void;
  onClose: () => void;
  onReopen: () => void;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const capacity = outing.boat?.capacity || null;
  const fillPct = capacity ? (outing.outing_participants.length / capacity) * 100 : 0;
  const isClosed = outing.status === 'chiusa';
  const isCancelled = outing.status === 'annullata';
  const isDraft = outing.status === 'bozza';

  return (
    <div className={cn(
      'p-4',
      isClosed && 'bg-emerald-500/[0.02]',
      isCancelled && 'bg-red-500/[0.04] opacity-70'
    )}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Anchor className={cn('h-4 w-4', isCancelled ? 'text-red-400' : 'text-accent')} />
            <span className={cn('font-medium', isCancelled ? 'text-text-muted line-through' : 'text-text')}>
              {outing.boat?.name || '?'}
            </span>
            {isCancelled ? (
              <span className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400 flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Annullata
              </span>
            ) : isClosed ? (
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Chiusa
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 flex items-center gap-1">
                <Unlock className="h-3 w-3" />
                Bozza
              </span>
            )}
            {outing.departure_time && outing.return_time && (
              <span className="text-xs text-text-muted">
                {outing.departure_time.slice(0, 5)} – {outing.return_time.slice(0, 5)}
              </span>
            )}
            {capacity && !isCancelled && (
              <span className={cn(
                'text-xs px-2 py-0.5 rounded flex items-center gap-1',
                fillPct >= 100 ? 'bg-red-500/10 text-red-400' :
                fillPct >= 75 ? 'bg-amber-500/10 text-amber-400' :
                'bg-bg-elevated text-text-muted'
              )}>
                <Users className="h-3 w-3" />
                {outing.outing_participants.length} / {capacity}
              </span>
            )}
          </div>
          {outing.outing_instructors.length > 0 && (
            <div className="text-xs text-text-muted mt-1">
              Istruttori:{' '}
              {outing.outing_instructors.map((oi, i) => (
                <span key={oi.instructor_id}>
                  {i > 0 && ', '}
                  {oi.instructor?.first_name} {oi.instructor?.last_name}
                  {oi.role && (
                    <span className="text-text-dim"> ({INSTRUCTOR_ROLE_LABELS[oi.role as keyof typeof INSTRUCTOR_ROLE_LABELS] || oi.role})</span>
                  )}
                </span>
              ))}
            </div>
          )}
          {outing.weather_notes && (
            <div className="text-xs text-text-dim mt-1 italic">Meteo: {outing.weather_notes}</div>
          )}
          {isClosed && outing.closed_at && (
            <div className="text-[10px] text-emerald-400/70 mt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Chiusa il {new Date(outing.closed_at).toLocaleString('it-IT')}
            </div>
          )}
          {isCancelled && (
            <div className="text-[10px] text-red-400/80 mt-1 flex items-center gap-1.5">
              <XCircle className="h-3 w-3" />
              Annullata
              {outing.cancelled_at && ` il ${new Date(outing.cancelled_at).toLocaleString('it-IT')}`}
              {outing.cancellation_reason && ` — ${outing.cancellation_reason}`}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isDraft && (
            <>
              <Button size="sm" variant="secondary" onClick={onAddParticipant}>
                <Plus className="h-3 w-3 mr-1" />
                Socio
              </Button>
              <Button size="sm" onClick={onClose}>
                <Lock className="h-3 w-3 mr-1" />
                Chiudi
              </Button>
              <button
                onClick={onEdit}
                className="p-1.5 rounded hover:bg-bg-elevated text-text-muted hover:text-accent"
                title="Modifica"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onCancel}
                className="p-1.5 rounded hover:bg-bg-elevated text-text-muted hover:text-red-400"
                title="Annulla sessione (maltempo, ecc.)"
              >
                <XCircle className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 rounded hover:bg-bg-elevated text-text-muted hover:text-red-400"
                title="Elimina"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          {isClosed && (
            <>
              <button
                onClick={onEdit}
                className="p-1.5 rounded hover:bg-bg-elevated text-text-muted hover:text-accent"
                title="Modifica orari/istruttori/note"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onCancel}
                className="p-1.5 rounded hover:bg-bg-elevated text-text-muted hover:text-red-400"
                title="Annulla sessione (rimborso completo)"
              >
                <XCircle className="h-3.5 w-3.5" />
              </button>
              {isAdmin && (
                <Button size="sm" variant="ghost" onClick={onReopen}>
                  <Unlock className="h-3 w-3 mr-1" />
                  Riapri
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {outing.outing_participants.length === 0 ? (
        <div className="text-xs text-text-dim italic px-2 py-3 bg-bg-elevated/30 rounded">
          Nessun partecipante. {isDraft && (
            <>Click su <strong>Socio</strong> per aggiungere il primo.</>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {outing.outing_participants.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 p-2 bg-bg-elevated/40 rounded text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/soci/${p.member?.id}`}
                    className="text-text hover:text-accent truncate"
                  >
                    {p.member?.first_name} {p.member?.last_name}
                  </Link>
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded',
                    PARTECIPATION_COLORS[p.participation_type] || 'bg-bg-elevated text-text-muted'
                  )}>
                    {PARTECIPATION_LABELS[p.participation_type] || p.participation_type}
                  </span>
                  {p.rental_type !== 'nessuno' && RENTAL_LABELS_SHORT[p.rental_type] && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-dim">
                      {RENTAL_LABELS_SHORT[p.rental_type]}
                    </span>
                  )}
                </div>
              </div>
              {isDraft && (
                <button
                  onClick={() => onRemoveParticipant(p.id)}
                  className="p-1 rounded hover:bg-bg text-text-dim hover:text-red-400 shrink-0"
                  title="Rimuovi"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
