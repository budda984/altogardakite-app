'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Plus, Loader2, Trash2, Anchor, Wind, Sparkles, AlertTriangle,
  Users, Sailboat, ChevronRight, GraduationCap, Heart,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type {
  Boat, Instructor, Member, SessionTemplate, BookingWithMember,
} from '@/lib/types';
import { DISCIPLINE_LABELS, MEMBER_TYPE_LABELS, PARTICIPATION_LABELS } from '@/lib/types';
import AddBookingModal from './AddBookingModal';
import CreateOutingFromBookingsModal from './CreateOutingFromBookingsModal';

interface Props {
  date: string;
  templates: SessionTemplate[];
  boats: Boat[];
  instructors: Instructor[];
  members: Pick<Member, 'id' | 'first_name' | 'last_name' | 'membership_number'>[];
  onOutingCreated: () => void;
}

export default function BookingsView({
  date, templates, boats, instructors, members, onOutingCreated,
}: Props) {
  const [bookings, setBookings] = useState<BookingWithMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal: aggiungi prenotazione (template di default selezionato)
  const [addBookingFor, setAddBookingFor] = useState<SessionTemplate | null>(null);

  // Modal: crea uscita da gruppo prenotazioni
  const [createOutingFor, setCreateOutingFor] = useState<{
    template: SessionTemplate;
    bookings: BookingWithMember[];
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings?date=${date}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      setBookings(data.bookings || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  // Raggruppa prenotazioni per template
  const bookingsByTemplate = useMemo(() => {
    const map = new Map<string, BookingWithMember[]>();
    bookings.forEach((b) => {
      const arr = map.get(b.session_template_id) || [];
      arr.push(b);
      map.set(b.session_template_id, arr);
    });
    return map;
  }, [bookings]);

  const handleDeleteBooking = async (bookingId: string, memberName: string) => {
    if (!confirm(`Cancellare prenotazione di ${memberName}?`)) return;
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Errore');
      }
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Errore');
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center bg-bg-surface border border-border rounded-lg">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-text-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
        {error}
      </div>
    );
  }

  // Filtra solo template attivi (default o con prenotazioni)
  const visibleTemplates = templates.filter(
    (t) => t.is_default || (bookingsByTemplate.get(t.id) || []).length > 0
  );

  if (visibleTemplates.length === 0) {
    return (
      <div className="bg-bg-surface border border-border rounded-lg p-12 text-center">
        <Users className="h-10 w-10 mx-auto text-text-dim mb-3" />
        <p className="text-text-muted">Nessun template di sessione configurato.</p>
        <Link href="/planning/template" className="text-accent hover:underline text-sm mt-2 inline-block">
          Configura i template
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {visibleTemplates.map((template) => {
        const slotBookings = bookingsByTemplate.get(template.id) || [];
        return (
          <SlotBlock
            key={template.id}
            template={template}
            bookings={slotBookings}
            onAddBooking={() => setAddBookingFor(template)}
            onCreateOuting={() => setCreateOutingFor({ template, bookings: slotBookings })}
            onDeleteBooking={handleDeleteBooking}
          />
        );
      })}

      {addBookingFor && (
        <AddBookingModal
          open={true}
          onClose={() => setAddBookingFor(null)}
          date={date}
          template={addBookingFor}
          members={members}
          existingBookings={bookings}
          onSuccess={load}
        />
      )}

      {createOutingFor && (
        <CreateOutingFromBookingsModal
          open={true}
          onClose={() => setCreateOutingFor(null)}
          date={date}
          template={createOutingFor.template}
          bookings={createOutingFor.bookings}
          boats={boats}
          instructors={instructors}
          onSuccess={() => {
            load();
            onOutingCreated();
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// SlotBlock - una sessione (Peler / Ora / Ora late ecc.)
// ============================================================================
function SlotBlock({
  template, bookings, onAddBooking, onCreateOuting, onDeleteBooking,
}: {
  template: SessionTemplate;
  bookings: BookingWithMember[];
  onAddBooking: () => void;
  onCreateOuting: () => void;
  onDeleteBooking: (bookingId: string, memberName: string) => void;
}) {
  return (
    <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border bg-bg-elevated/40">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Wind className="h-4 w-4 text-accent" />
              <h3 className="font-display font-semibold text-lg text-text">
                {template.name}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded bg-bg-elevated text-text-muted">
                {DISCIPLINE_LABELS[template.discipline]}
              </span>
              {template.default_departure_time && (
                <span className="text-xs text-text-muted">
                  {template.default_departure_time.slice(0, 5)}
                  {template.default_return_time && ' - ' + template.default_return_time.slice(0, 5)}
                </span>
              )}
            </div>
            <div className="text-xs text-text-muted mt-1">
              {bookings.length === 0
                ? 'Nessuna prenotazione'
                : `${bookings.length} ${bookings.length === 1 ? 'prenotazione' : 'prenotazioni'}`}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="secondary" onClick={onAddBooking}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Prenota socio
            </Button>
            {bookings.length > 0 && (
              <Button size="sm" onClick={onCreateOuting}>
                <Sailboat className="h-3.5 w-3.5 mr-1" />
                Crea uscita
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="p-4">
        {bookings.length === 0 ? (
          <div className="text-sm text-text-dim italic text-center py-6">
            Click <strong>Prenota socio</strong> per aggiungere il primo.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {bookings.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                onDelete={() => onDeleteBooking(b.id, `${b.first_name} ${b.last_name}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// BookingCard - singola prenotazione
// ============================================================================
function BookingCard({
  booking, onDelete,
}: {
  booking: BookingWithMember;
  onDelete: () => void;
}) {
  // Avvisi
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const tesseraExpired = booking.expires_at && booking.expires_at < today;
  const tesseraExpiring = booking.expires_at && booking.expires_at >= today && booking.expires_at <= in30;
  const noCert = booking.member_type !== 'sostenitore' && !booking.medical_cert_received;
  const certExpired = booking.medical_cert_received && booking.medical_cert_expires_at && booking.medical_cert_expires_at < today;

  const hasIssues = tesseraExpired || noCert || certExpired;

  return (
    <div className={cn(
      'flex items-center gap-2 p-2.5 rounded border bg-bg-elevated/40',
      hasIssues ? 'border-amber-500/30 bg-amber-500/[0.02]' : 'border-border'
    )}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link href={`/soci/${booking.member_id}`} className="text-sm font-medium text-text hover:text-accent truncate">
            {booking.last_name} {booking.first_name}
          </Link>
          <span className="text-[10px] text-text-dim">#{booking.membership_number}</span>
          {booking.member_type === 'con_lift' && (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
              <Wind className="h-2.5 w-2.5" />
              lift
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          {/* Tipo partecipazione - sempre visibile */}
          <span className={cn(
            'text-[10px] px-1.5 py-0.5 rounded',
            booking.participation_type === 'corso' ? 'bg-blue-500/10 text-blue-400' :
            booking.participation_type === 'lift_supervisionato' ? 'bg-purple-500/10 text-purple-400' :
            'bg-emerald-500/10 text-emerald-400'
          )}>
            {PARTICIPATION_LABELS[booking.participation_type]}
          </span>
          {booking.preferred_discipline && (
            <span className="text-[10px] text-text-muted">
              {DISCIPLINE_LABELS[booking.preferred_discipline]}
            </span>
          )}
          {hasIssues && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-400">
              <AlertTriangle className="h-2.5 w-2.5" />
              {tesseraExpired ? 'tessera scaduta' :
                noCert ? 'cert. mancante' :
                certExpired ? 'cert. scaduto' :
                tesseraExpiring ? 'tessera in scadenza' : ''}
            </span>
          )}
          {booking.notes && (
            <span className="text-[10px] text-text-dim italic truncate">
              {booking.notes}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onDelete}
        className="p-1 rounded hover:bg-red-500/10 text-text-dim hover:text-red-400 shrink-0"
        title="Cancella prenotazione"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
