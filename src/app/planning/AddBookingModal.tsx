'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, Search, X, Plus, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import type {
  Member, SessionTemplate, BookingWithMember, LiftDiscipline,
} from '@/lib/types';
import { DISCIPLINE_LABELS } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  date: string;
  template: SessionTemplate;
  members: Pick<Member, 'id' | 'first_name' | 'last_name' | 'membership_number'>[];
  existingBookings: BookingWithMember[];
  onSuccess: () => void;
}

interface Selection {
  member_id: string;
  preferred_discipline: LiftDiscipline | null;
  notes: string;
}

export default function AddBookingModal({
  open, onClose, date, template, members, existingBookings, onSuccess,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [selections, setSelections] = useState<Selection[]>([]);

  // Default disciplina dal template
  const [defaultDiscipline, setDefaultDiscipline] = useState<LiftDiscipline>(template.discipline);

  // Soci gia prenotati per questo slot (esclusi)
  const alreadyBookedIds = useMemo(() => {
    return new Set(
      existingBookings
        .filter((b) => b.session_template_id === template.id && b.status === 'pending')
        .map((b) => b.member_id)
    );
  }, [existingBookings, template.id]);

  useEffect(() => {
    if (open) {
      setSelections([]);
      setMemberSearch('');
      setError(null);
      setDefaultDiscipline(template.discipline);
    }
  }, [open, template.discipline]);

  const availableMembers = useMemo(() => {
    const selectedIds = new Set(selections.map((s) => s.member_id));
    return members.filter((m) => !selectedIds.has(m.id) && !alreadyBookedIds.has(m.id));
  }, [members, selections, alreadyBookedIds]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.toLowerCase().trim();
    if (!q) return availableMembers.slice(0, 30);
    return availableMembers.filter((m) =>
      `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
      String(m.membership_number).includes(q)
    ).slice(0, 30);
  }, [availableMembers, memberSearch]);

  const addMember = (memberId: string) => {
    setSelections((prev) => [
      ...prev,
      {
        member_id: memberId,
        preferred_discipline: defaultDiscipline,
        notes: '',
      },
    ]);
    setMemberSearch('');
  };

  const updateSelection = (memberId: string, patch: Partial<Selection>) => {
    setSelections((prev) =>
      prev.map((s) => (s.member_id === memberId ? { ...s, ...patch } : s))
    );
  };

  const removeSelection = (memberId: string) => {
    setSelections((prev) => prev.filter((s) => s.member_id !== memberId));
  };

  const memberById = useMemo(() => {
    const map: Record<string, typeof members[number]> = {};
    members.forEach((m) => { map[m.id] = m; });
    return map;
  }, [members]);

  const handleSubmit = async () => {
    if (selections.length === 0) return;
    setSubmitting(true);
    setError(null);

    try {
      const results = await Promise.allSettled(
        selections.map((s) =>
          fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              member_id: s.member_id,
              booking_date: date,
              session_template_id: template.id,
              preferred_discipline: s.preferred_discipline,
              notes: s.notes || null,
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
        const reasons = failed
          .map((r) => (r.status === 'rejected' ? (r.reason instanceof Error ? r.reason.message : '') : ''))
          .filter(Boolean);
        throw new Error(
          `${failed.length} su ${selections.length} prenotazioni non aggiunte. Cause: ${[...new Set(reasons)].join(', ')}`
        );
      }
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Aggiungi prenotazioni a ${template.name}`}
      description={`Selezione multipla soci per la sessione del ${new Date(date + 'T12:00:00').toLocaleDateString('it-IT')}`}
      size="xl"
    >
      <div className="space-y-5">
        {/* Default disciplina */}
        <div className="p-3 rounded bg-bg-elevated border border-border">
          <Select
            label="Disciplina preferita di default per i nuovi soci aggiunti"
            value={defaultDiscipline}
            onChange={(e) => setDefaultDiscipline(e.target.value as LiftDiscipline)}
          >
            {Object.entries(DISCIPLINE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <p className="text-[10px] text-text-dim mt-1.5">
            Modificabile per ogni socio singolarmente nella lista qui sotto.
          </p>
        </div>

        {/* Search soci */}
        <div>
          <label className="block text-sm font-medium text-text mb-2">
            Cerca e aggiungi soci ({selections.length} selezionati)
          </label>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-dim" />
            <input
              type="text"
              placeholder="Cognome, nome o numero tessera..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-md border border-border bg-bg-elevated text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            />
          </div>
          {memberSearch && (
            <div className="max-h-60 overflow-y-auto bg-bg-elevated border border-border rounded divide-y divide-border">
              {filteredMembers.length === 0 ? (
                <p className="p-3 text-sm text-text-muted text-center">
                  Nessun socio trovato (i sostenitori non possono prenotare).
                </p>
              ) : (
                filteredMembers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => addMember(m.id)}
                    className="w-full p-2.5 text-left hover:bg-bg-surface text-sm flex items-center justify-between"
                  >
                    <span className="text-text">{m.last_name} {m.first_name}</span>
                    <span className="text-xs text-text-dim">#{m.membership_number}</span>
                  </button>
                ))
              )}
            </div>
          )}
          {alreadyBookedIds.size > 0 && (
            <p className="text-[10px] text-text-dim mt-1.5 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {alreadyBookedIds.size} {alreadyBookedIds.size === 1 ? 'socio gia prenotato' : 'soci gia prenotati'} (esclusi dalla ricerca)
            </p>
          )}
        </div>

        {/* Selezionati */}
        {selections.length > 0 && (
          <div>
            <div className="text-xs font-medium text-text-muted mb-2">
              Da prenotare ({selections.length}):
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {selections.map((s) => {
                const m = memberById[s.member_id];
                if (!m) return null;
                return (
                  <div key={s.member_id} className="p-3 rounded border border-border bg-bg-elevated/50">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-text text-sm">
                          {m.last_name} {m.first_name}
                          <span className="text-xs text-text-dim ml-1.5">#{m.membership_number}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSelection(s.member_id)}
                        className="p-1 rounded hover:bg-red-500/10 text-text-dim hover:text-red-400"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={s.preferred_discipline || ''}
                        onChange={(e) => updateSelection(s.member_id, {
                          preferred_discipline: (e.target.value || null) as LiftDiscipline | null
                        })}
                        className="text-xs rounded bg-bg border border-border px-2 py-1.5 text-text"
                        style={{ colorScheme: 'dark' }}
                      >
                        <option value="">Disciplina indicativa...</option>
                        {Object.entries(DISCIPLINE_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={s.notes}
                        onChange={(e) => updateSelection(s.member_id, { notes: e.target.value })}
                        placeholder="Note (es. lezione, trasferimento...)"
                        className="text-xs rounded bg-bg border border-border px-2 py-1.5 text-text placeholder:text-text-dim"
                      />
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
          <Button
            onClick={handleSubmit}
            disabled={submitting || selections.length === 0}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Plus className="h-4 w-4 mr-2" />
            Prenota {selections.length} {selections.length === 1 ? 'socio' : 'soci'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
