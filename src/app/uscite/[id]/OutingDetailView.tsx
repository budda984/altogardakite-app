'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Calendar, Clock, Sailboat, Wind, Users, Package,
  Edit, Save, X, Plus, Trash2, Loader2, Lock, Unlock, XCircle,
  AlertTriangle, GraduationCap, CheckCircle2,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/Modal';
import { formatDate, formatTime, cn } from '@/lib/utils';
import {
  WIND_SESSION_LABELS, PARTICIPATION_LABELS, RENTAL_LABELS, EQUIPMENT_LABELS,
  DISCIPLINE_LABELS,
  type ParticipationType, type RentalType, type LiftDiscipline,
} from '@/lib/types';

// ============================================================================
// TYPES
// ============================================================================
type Outing = {
  id: string;
  outing_date: string;
  status: 'bozza' | 'chiusa' | 'annullata';
  boat_id: string;
  discipline: LiftDiscipline | null;
  wind_session: string | null;
  departure_time: string | null;
  return_time: string | null;
  weather_notes: string | null;
  notes: string | null;
  cancellation_reason: string | null;
  closed_at: string | null;
  boat: { id: string; name: string; capacity: number | null } | null;
};

type Participant = {
  id: string;
  member_id: string;
  participation_type: ParticipationType;
  rental_type: RentalType;
  notes: string | null;
  member: { id: string; first_name: string; last_name: string; membership_number: number; member_type: string } | null;
  equipment: { equipment: { name: string; equipment_type: string } | null }[];
};

type Boat = { id: string; name: string; capacity: number | null; boat_type: string };
type Instructor = { id: string; first_name: string; last_name: string; role: string };
type Member = { id: string; first_name: string; last_name: string; membership_number: number; member_type: string };

interface Props {
  outing: Outing;
  instructorRows: { instructor_id: string; role: string; instructor: Instructor | Instructor[] | null }[];
  participants: Participant[];
  allBoats: Boat[];
  allInstructors: Instructor[];
  allMembers: Member[];
  isAdmin: boolean;
}

export default function OutingDetailView({
  outing, instructorRows, participants, allBoats, allInstructors, allMembers, isAdmin,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEditOuting, setShowEditOuting] = useState(false);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);

  const isBozza = outing.status === 'bozza';
  const isChiusa = outing.status === 'chiusa';
  const isAnnullata = outing.status === 'annullata';

  const currentParticipantIds = new Set(participants.map((p) => p.member_id));
  const availableMembers = allMembers.filter((m) => !currentParticipantIds.has(m.id));

  // ============== ACTIONS ==============
  async function reopenOuting() {
    if (!confirm('Riaprire l\'uscita? Gli addebiti verranno stornati e potrai modificare partecipanti, barca, orari ecc.')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/planning/uscita/${outing.id}/riapri`, { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Errore');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore');
    } finally {
      setBusy(false);
    }
  }

  async function closeOuting() {
    if (!confirm('Chiudere l\'uscita? Verranno scalati i lift e generati gli addebiti per i partecipanti.')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/planning/uscita/${outing.id}/chiudi`, { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Errore');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore');
    } finally {
      setBusy(false);
    }
  }

  async function removeParticipant(pid: string, name: string) {
    if (!confirm(`Rimuovere ${name} dalla lista partecipanti?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/planning/uscita/${outing.id}/partecipanti/${pid}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Errore');
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore');
    } finally {
      setBusy(false);
    }
  }

  // ============== RENDER ==============
  return (
    <div className="p-4 lg:p-10 max-w-5xl">
      <Link href="/uscite" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-accent mb-4">
        <ArrowLeft className="h-4 w-4" /> Tutte le uscite
      </Link>

      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <div className="text-xs uppercase tracking-widest text-text-dim">Uscita barca</div>
          <StatusBadge status={outing.status} />
        </div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tightest">
          {outing.boat?.name || 'N/D'} - {formatDate(outing.outing_date)}
        </h1>
        <div className="flex flex-wrap gap-4 mt-2 text-sm text-text-muted">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {outing.departure_time && outing.return_time
              ? `${formatTime(outing.departure_time)} - ${formatTime(outing.return_time)}`
              : '—'}
          </span>
          {outing.wind_session && (
            <span className="flex items-center gap-1.5">
              <Wind className="h-3.5 w-3.5" />
              {WIND_SESSION_LABELS[outing.wind_session as keyof typeof WIND_SESSION_LABELS]}
            </span>
          )}
          {outing.discipline && (
            <span>{DISCIPLINE_LABELS[outing.discipline]}</span>
          )}
        </div>
        {outing.cancellation_reason && (
          <div className="mt-3 p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            <strong>Annullata:</strong> {outing.cancellation_reason}
          </div>
        )}
      </header>

      {error && (
        <div className="p-3 mb-4 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Action bar */}
      <div className="mb-6 flex flex-wrap gap-2">
        {isBozza && (
          <>
            <Button size="sm" variant="secondary" onClick={() => setShowEditOuting(true)}>
              <Edit className="h-3.5 w-3.5 mr-1.5" /> Modifica uscita
            </Button>
            <Button size="sm" onClick={closeOuting} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Lock className="h-3.5 w-3.5 mr-1.5" />}
              Chiudi uscita
            </Button>
          </>
        )}
        {isChiusa && isAdmin && (
          <Button size="sm" variant="secondary" onClick={reopenOuting} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5 mr-1.5" />}
            Riapri uscita (admin)
          </Button>
        )}
        {isChiusa && !isAdmin && (
          <span className="text-xs text-text-muted px-3 py-1.5 rounded bg-bg-elevated">
            Solo l&apos;admin puo riaprire un&apos;uscita chiusa
          </span>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Istruttori */}
        <Card title="Istruttori a bordo">
          {instructorRows.length > 0 ? (
            <ul className="space-y-1.5 text-sm">
              {instructorRows.map((row, i) => {
                const inst = Array.isArray(row.instructor) ? row.instructor[0] : row.instructor;
                return (
                  <li key={i} className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-text-dim" />
                    <span>
                      {inst?.first_name} {inst?.last_name}
                      <span className="text-text-dim text-xs ml-1.5">({inst?.role})</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-text-dim">Nessuno</p>
          )}
        </Card>

        {/* Note generali */}
        <Card title="Note">
          <div className="space-y-2 text-sm">
            {outing.weather_notes && (
              <div>
                <span className="text-text-dim text-xs">Meteo:</span>{' '}
                <span>{outing.weather_notes}</span>
              </div>
            )}
            {outing.notes && (
              <div>
                <span className="text-text-dim text-xs">Note:</span>{' '}
                <span>{outing.notes}</span>
              </div>
            )}
            {!outing.weather_notes && !outing.notes && (
              <p className="text-sm text-text-dim">—</p>
            )}
          </div>
        </Card>
      </div>

      {/* Partecipanti */}
      <div className="mt-6">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-accent" />
            Partecipanti ({participants.length}
            {outing.boat?.capacity && `/${outing.boat.capacity}`})
          </h2>
          {isBozza && availableMembers.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setShowAddParticipant(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Aggiungi
            </Button>
          )}
        </div>

        {participants.length === 0 ? (
          <div className="bg-bg-surface border border-border rounded-lg p-8 text-center text-sm text-text-dim">
            Nessun partecipante.
          </div>
        ) : (
          <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
            {participants.map((p) => (
              <ParticipantRow
                key={p.id}
                participant={p}
                outingId={outing.id}
                editable={isBozza}
                isEditing={editingParticipantId === p.id}
                onStartEdit={() => setEditingParticipantId(p.id)}
                onCancelEdit={() => setEditingParticipantId(null)}
                onSaved={() => {
                  setEditingParticipantId(null);
                  router.refresh();
                }}
                onDelete={() => removeParticipant(p.id, `${p.member?.last_name} ${p.member?.first_name}`)}
                disabled={busy}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modali */}
      {showEditOuting && (
        <EditOutingModal
          outing={outing}
          allBoats={allBoats}
          allInstructors={allInstructors}
          currentInstructorIds={instructorRows.map((r) => r.instructor_id)}
          onClose={() => setShowEditOuting(false)}
          onSaved={() => {
            setShowEditOuting(false);
            router.refresh();
          }}
        />
      )}

      {showAddParticipant && (
        <AddParticipantModal
          outingId={outing.id}
          availableMembers={availableMembers}
          discipline={outing.discipline}
          onClose={() => setShowAddParticipant(false)}
          onSaved={() => {
            setShowAddParticipant(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// SUB COMPONENTS
// ============================================================================
function StatusBadge({ status }: { status: string }) {
  if (status === 'chiusa') {
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 inline-flex items-center gap-1">
        <Lock className="h-3 w-3" /> Chiusa
      </span>
    );
  }
  if (status === 'annullata') {
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400 inline-flex items-center gap-1">
        <XCircle className="h-3 w-3" /> Annullata
      </span>
    );
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 inline-flex items-center gap-1">
      <Unlock className="h-3 w-3" /> Bozza (modificabile)
    </span>
  );
}

function ParticipantRow({
  participant: p, outingId, editable, isEditing, onStartEdit, onCancelEdit, onSaved, onDelete, disabled,
}: {
  participant: Participant;
  outingId: string;
  editable: boolean;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const [participationType, setParticipationType] = useState<ParticipationType>(p.participation_type);
  const [rentalType, setRentalType] = useState<RentalType>(p.rental_type);
  const [notes, setNotes] = useState(p.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/planning/uscita/${outingId}/partecipanti/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participation_type: participationType,
          rental_type: rentalType,
          notes,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Errore');
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore');
    } finally {
      setSaving(false);
    }
  }

  if (isEditing) {
    return (
      <div className="p-4 border-b border-border last:border-b-0 bg-bg-elevated/30 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium text-sm">
            {p.member?.last_name} {p.member?.first_name}
            <span className="text-text-dim text-xs ml-1.5">#{p.member?.membership_number}</span>
          </div>
          <button
            onClick={onCancelEdit}
            className="p-1 rounded hover:bg-bg text-text-dim"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Select
            label="Tipo partecipazione"
            value={participationType}
            onChange={(e) => setParticipationType(e.target.value as ParticipationType)}
          >
            <option value="lift_semplice">Lift semplice</option>
            <option value="lift_supervisionato">Lift assistito / supervisionato</option>
            <option value="corso">Corso (lezione)</option>
          </Select>
          <Select
            label="Noleggio"
            value={rentalType}
            onChange={(e) => setRentalType(e.target.value as RentalType)}
          >
            {Object.entries(RENTAL_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </div>
        <Textarea
          label="Note"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
        {error && (
          <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-400">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onCancelEdit}>Annulla</Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            Salva
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 border-b border-border last:border-b-0 hover:bg-bg-elevated/40 flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link href={`/soci/${p.member?.id}`} className="font-medium text-sm hover:text-accent">
            {p.member?.last_name} {p.member?.first_name}
          </Link>
          <span className="text-[10px] text-text-dim">#{p.member?.membership_number}</span>
          <span className={cn(
            'text-[10px] px-1.5 py-0.5 rounded',
            p.participation_type === 'corso' ? 'bg-blue-500/10 text-blue-400' :
            p.participation_type === 'lift_supervisionato' ? 'bg-purple-500/10 text-purple-400' :
            'bg-emerald-500/10 text-emerald-400'
          )}>
            {PARTICIPATION_LABELS[p.participation_type]}
          </span>
          {p.rental_type !== 'nessuno' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-muted">
              {RENTAL_LABELS[p.rental_type]}
            </span>
          )}
        </div>
        {p.notes && (
          <div className="text-[11px] text-text-dim italic mt-0.5">{p.notes}</div>
        )}
      </div>
      {editable && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onStartEdit}
            disabled={disabled}
            className="p-1.5 rounded hover:bg-bg text-text-muted hover:text-accent"
            title="Modifica tipo partecipazione"
          >
            <Edit className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            disabled={disabled}
            className="p-1.5 rounded hover:bg-red-500/10 text-text-dim hover:text-red-400"
            title="Rimuovi partecipante"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// EDIT OUTING MODAL (boat, times, instructors, notes)
// ============================================================================
function EditOutingModal({
  outing, allBoats, allInstructors, currentInstructorIds, onClose, onSaved,
}: {
  outing: Outing;
  allBoats: Boat[];
  allInstructors: Instructor[];
  currentInstructorIds: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [boatId, setBoatId] = useState(outing.boat_id);
  const [departureTime, setDepartureTime] = useState(outing.departure_time?.slice(0, 5) || '');
  const [returnTime, setReturnTime] = useState(outing.return_time?.slice(0, 5) || '');
  const [weatherNotes, setWeatherNotes] = useState(outing.weather_notes || '');
  const [notes, setNotes] = useState(outing.notes || '');
  const [instructorIds, setInstructorIds] = useState<string[]>(currentInstructorIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleInstructor(id: string) {
    setInstructorIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/planning/uscita/${outing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boat_id: boatId,
          departure_time: departureTime,
          return_time: returnTime,
          weather_notes: weatherNotes,
          notes,
          instructor_ids: instructorIds,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Errore');
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={true} onClose={onClose} title="Modifica uscita" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select label="Imbarcazione *" value={boatId} onChange={(e) => setBoatId(e.target.value)}>
            {allBoats.map((b) => (
              <option key={b.id} value={b.id}>{b.name}{b.capacity ? ` (cap. ${b.capacity})` : ''}</option>
            ))}
          </Select>
          <div></div>
          <Input label="Partenza" type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} />
          <Input label="Rientro" type="time" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-2">Istruttori a bordo</label>
          <div className="p-3 rounded bg-bg-elevated border border-border max-h-40 overflow-y-auto space-y-1.5">
            {allInstructors.map((i) => (
              <label key={i.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={instructorIds.includes(i.id)}
                  onChange={() => toggleInstructor(i.id)}
                  className="rounded"
                />
                <span>{i.first_name} {i.last_name}<span className="text-text-dim text-xs ml-1">({i.role})</span></span>
              </label>
            ))}
          </div>
        </div>

        <Input label="Note meteo" value={weatherNotes} onChange={(e) => setWeatherNotes(e.target.value)} />
        <Textarea label="Note generali" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />

        {error && (
          <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-border">
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salva modifiche
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// ADD PARTICIPANT MODAL
// ============================================================================
function AddParticipantModal({
  outingId, availableMembers, discipline, onClose, onSaved,
}: {
  outingId: string;
  availableMembers: Member[];
  discipline: LiftDiscipline | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{
    member_id: string;
    participation_type: ParticipationType;
    rental_type: RentalType;
    notes: string;
  }[]>([]);
  const [defaultParticipation, setDefaultParticipation] = useState<ParticipationType>('lift_semplice');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = availableMembers
    .filter((m) => !selected.some((s) => s.member_id === m.id))
    .filter((m) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) || String(m.membership_number).includes(q);
    })
    .slice(0, 30);

  function add(memberId: string) {
    setSelected((prev) => [
      ...prev,
      {
        member_id: memberId,
        participation_type: defaultParticipation,
        rental_type: 'nessuno',
        notes: '',
      },
    ]);
    setSearch('');
  }

  function update(memberId: string, patch: Partial<typeof selected[0]>) {
    setSelected((prev) => prev.map((s) => s.member_id === memberId ? { ...s, ...patch } : s));
  }

  function remove(memberId: string) {
    setSelected((prev) => prev.filter((s) => s.member_id !== memberId));
  }

  async function save() {
    if (selected.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const results = await Promise.allSettled(
        selected.map((s) =>
          fetch(`/api/planning/uscita/${outingId}/partecipanti`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              member_id: s.member_id,
              participation_type: s.participation_type,
              rental_type: s.rental_type,
              notes: s.notes,
            }),
          }).then(async (r) => {
            if (!r.ok) {
              const j = await r.json().catch(() => ({}));
              throw new Error(j.error || 'Errore');
            }
          })
        )
      );
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        const reasons = failed.map((r) =>
          r.status === 'rejected' ? (r.reason instanceof Error ? r.reason.message : '') : ''
        ).filter(Boolean);
        throw new Error(`${failed.length} partecipanti non aggiunti: ${[...new Set(reasons)].join(', ')}`);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore');
    } finally {
      setSaving(false);
    }
  }

  const memberById: Record<string, Member> = {};
  availableMembers.forEach((m) => { memberById[m.id] = m; });

  return (
    <Modal open={true} onClose={onClose} title="Aggiungi partecipanti" size="lg">
      <div className="space-y-4">
        <Select
          label="Default tipo partecipazione"
          value={defaultParticipation}
          onChange={(e) => setDefaultParticipation(e.target.value as ParticipationType)}
        >
          <option value="lift_semplice">Lift semplice</option>
          <option value="lift_supervisionato">Lift assistito</option>
          <option value="corso">Corso (lezione)</option>
        </Select>

        <Input
          label="Cerca socio"
          placeholder="Cognome, nome o # tessera"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {search && (
          <div className="max-h-48 overflow-y-auto bg-bg-elevated border border-border rounded divide-y divide-border">
            {filtered.length === 0 ? (
              <p className="p-3 text-sm text-text-muted text-center">Nessun socio trovato</p>
            ) : (
              filtered.map((m) => (
                <button
                  key={m.id}
                  onClick={() => add(m.id)}
                  className="w-full p-2.5 text-left hover:bg-bg-surface text-sm flex items-center justify-between"
                >
                  <span>{m.last_name} {m.first_name}</span>
                  <span className="text-xs text-text-dim">#{m.membership_number}</span>
                </button>
              ))
            )}
          </div>
        )}

        {selected.length > 0 && (
          <div>
            <div className="text-xs font-medium text-text-muted mb-2">
              Da aggiungere ({selected.length}):
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {selected.map((s) => {
                const m = memberById[s.member_id];
                if (!m) return null;
                return (
                  <div key={s.member_id} className="p-3 rounded border border-border bg-bg-elevated/50">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="font-medium text-sm">
                        {m.last_name} {m.first_name}
                        <span className="text-xs text-text-dim ml-1.5">#{m.membership_number}</span>
                      </div>
                      <button onClick={() => remove(s.member_id)} className="p-1 rounded hover:bg-red-500/10 text-text-dim hover:text-red-400">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={s.participation_type}
                        onChange={(e) => update(s.member_id, { participation_type: e.target.value as ParticipationType })}
                        className="text-xs rounded bg-bg border border-border px-2 py-1.5 text-text"
                        style={{ colorScheme: 'dark' }}
                      >
                        <option value="lift_semplice">Lift semplice</option>
                        <option value="lift_supervisionato">Lift assistito</option>
                        <option value="corso">Corso</option>
                      </select>
                      <select
                        value={s.rental_type}
                        onChange={(e) => update(s.member_id, { rental_type: e.target.value as RentalType })}
                        className="text-xs rounded bg-bg border border-border px-2 py-1.5 text-text"
                        style={{ colorScheme: 'dark' }}
                      >
                        {Object.entries(RENTAL_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-border">
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button onClick={save} disabled={saving || selected.length === 0}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Aggiungi {selected.length} {selected.length === 1 ? 'partecipante' : 'partecipanti'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
