'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Plus, Loader2, Trash2, Anchor, Wind, Sparkles, AlertTriangle,
  Users, Sailboat, ChevronRight, GraduationCap, Heart,
  MessageCircle, Send, Phone, Check, Zap, ExternalLink,
  Clock, ArrowUp, CalendarPlus, UserX, FileDown, Bell,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';
import { buildWhatsappLink, normalizePhone } from '@/lib/whatsapp';
import { generateSlotPdf } from '@/app/report/pdfGenerators';
import type {
  Boat, Instructor, Member, SessionTemplate, BookingWithMember, ParticipationType,
} from '@/lib/types';
import { DISCIPLINE_LABELS, MEMBER_TYPE_LABELS, PARTICIPATION_LABELS } from '@/lib/types';
import AddBookingModal from './AddBookingModal';
import CreateOutingFromBookingsModal from './CreateOutingFromBookingsModal';
import { oggiItalia } from '@/lib/dataLocale';

// Una richiesta dal portale ancora senza risposta: va approvata prima di
// essere lavorabile (niente uscite, niente avvisi, niente conteggi).
const daApprovare = (b: BookingWithMember) =>
  b.source === 'portale' && !b.accepted_at && !b.refused_at;

interface InstructorAbsence {
  id: string;
  instructor_id: string;
  absence_date: string;
  session_template_id: string | null;
  notes: string | null;
  instructor: { id: string; first_name: string; last_name: string } | null;
}

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

  // Modal: avvisa via WhatsApp
  const [notificaPortaleFor, setNotificaPortaleFor] = useState<{
    template: SessionTemplate;
    destinatari: number;
  } | null>(null);
  const [notifyFor, setNotifyFor] = useState<{
    template: SessionTemplate;
    bookings: BookingWithMember[];
  } | null>(null);

  const [showMulti, setShowMulti] = useState(false);
  const [showAbsences, setShowAbsences] = useState(false);
  const [absences, setAbsences] = useState<InstructorAbsence[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, absRes] = await Promise.all([
        fetch(`/api/bookings?date=${date}`),
        fetch(`/api/planning/assenze?date=${date}`),
      ]);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      setBookings(data.bookings || []);
      if (absRes.ok) {
        const absData = await absRes.json();
        setAbsences(absData.absences || []);
      }
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

  const handleToggleWaitlist = async (bookingId: string, toWaitlist: boolean) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_waitlist: toWaitlist }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Errore');
      }
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Errore');
    }
  };

  const handlePrintSlotPdf = (template: SessionTemplate, slotBookings: BookingWithMember[]) => {
    generateSlotPdf({
      date,
      sessionName: template.name,
      departureTime: template.default_departure_time,
      returnTime: template.default_return_time,
      bookings: slotBookings.map((b) => ({
        name: `${b.first_name} ${b.last_name}`,
        discipline: b.preferred_discipline || undefined,
        participation: b.participation_type || undefined,
        isWaitlist: b.is_waitlist,
      })),
    });
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
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={() => setShowAbsences(true)}>
          <UserX className="h-3.5 w-3.5 mr-1.5" />
          Assenze
          {absences.length > 0 && (
            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">
              {absences.length}
            </span>
          )}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowMulti(true)}>
          <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />
          Prenotazione multipla
        </Button>
      </div>
      {visibleTemplates.map((template) => {
        const slotBookings = bookingsByTemplate.get(template.id) || [];
        return (
          <SlotBlock
            key={template.id}
            template={template}
            bookings={slotBookings}
            onReload={load}
            onAddBooking={() => setAddBookingFor(template)}
            onCreateOuting={() => setCreateOutingFor({ template, bookings: slotBookings.filter((b) => !b.is_waitlist && !daApprovare(b)) })}
            onDeleteBooking={handleDeleteBooking}
            onNotify={() => setNotifyFor({ template, bookings: slotBookings.filter((b) => !b.is_waitlist && !daApprovare(b)) })}
            onNotificaPortale={() =>
              setNotificaPortaleFor({
                template,
                // Stessi destinatari della funzione SQL: tutti tranne i
                // "da approvare" — lista d'attesa inclusa.
                destinatari: slotBookings.filter((b) => !daApprovare(b) && !b.is_waitlist).length,
              })
            }
            onToggleWaitlist={handleToggleWaitlist}
            absences={absences.filter((a) => a.session_template_id === template.id || a.session_template_id === null)}
            onPrintPdf={() => handlePrintSlotPdf(template, slotBookings)}
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

      {notificaPortaleFor && (
        <NotificaPortaleModal
          open
          onClose={() => setNotificaPortaleFor(null)}
          date={date}
          template={notificaPortaleFor.template}
          destinatari={notificaPortaleFor.destinatari}
        />
      )}
      {notifyFor && (
        <NotifyWhatsappModal
          open={true}
          onClose={() => setNotifyFor(null)}
          date={date}
          template={notifyFor.template}
          bookings={notifyFor.bookings}
        />
      )}

      {showMulti && (
        <MultiBookingModal
          open={true}
          onClose={() => setShowMulti(false)}
          startDate={date}
          templates={templates}
          members={members}
          onSuccess={load}
        />
      )}

      {showAbsences && (
        <AbsencesModal
          open={true}
          onClose={() => setShowAbsences(false)}
          date={date}
          templates={templates}
          instructors={instructors}
          absences={absences}
          onChanged={load}
        />
      )}
    </div>
  );
}

// ============================================================================
// SlotBlock - una sessione (Peler / Ora / Ora late ecc.)
// ============================================================================
function SlotBlock({
  template, bookings, onAddBooking, onCreateOuting, onDeleteBooking, onNotify, onNotificaPortale, onToggleWaitlist, absences, onPrintPdf, onReload,
}: {
  template: SessionTemplate;
  bookings: BookingWithMember[];
  onAddBooking: () => void;
  onCreateOuting: () => void;
  onDeleteBooking: (bookingId: string, memberName: string) => void;
  onNotify: () => void;
  onNotificaPortale: () => void;
  onToggleWaitlist: (bookingId: string, toWaitlist: boolean) => void;
  absences: InstructorAbsence[];
  onPrintPdf: () => void;
  onReload: () => void;
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
                : (() => {
                    const conf = bookings.filter((b) => !b.is_waitlist).length;
                    const wait = bookings.filter((b) => b.is_waitlist).length;
                    return `${conf} ${conf === 1 ? 'confermata' : 'confermate'}` +
                      (wait > 0 ? ` · ${wait} in attesa` : '');
                  })()}
            </div>
            {absences.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-amber-400 mt-1.5">
                <UserX className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {absences.map((a) => {
                    const name = a.instructor ? a.instructor.first_name : 'Istruttore';
                    return a.session_template_id === null ? `${name} (giorno intero)` : name;
                  }).join(', ')}
                  {' '}{absences.length > 1 ? 'assenti' : 'assente'}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="secondary" onClick={onAddBooking}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Prenota socio
            </Button>
            {bookings.length > 0 && (
              <Button size="sm" variant="secondary" onClick={onNotify}>
                <MessageCircle className="h-3.5 w-3.5 mr-1" />
                Avvisa
              </Button>
            )}
            {bookings.length > 0 && (
              <Button size="sm" variant="secondary" onClick={onNotificaPortale}>
                <Bell className="h-3.5 w-3.5 mr-1" />
                Portale
              </Button>
            )}
            {bookings.length > 0 && (
              <Button size="sm" variant="secondary" onClick={onPrintPdf}>
                <FileDown className="h-3.5 w-3.5 mr-1" />
                PDF
              </Button>
            )}
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
          <>
            {/* Da approvare: richieste dal portale senza ancora un si'/no.
                Sezione a parte, come la lista d'attesa: non si mescolano
                con le prenotazioni decise. */}
            {bookings.some(daApprovare) && (
              <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-400 mb-2">
                  <Clock className="h-3.5 w-3.5" />
                  Da approvare ({bookings.filter(daApprovare).length})
                  <span className="font-normal text-text-dim">— richieste dal portale soci</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {bookings
                    .filter(daApprovare)
                    .map((b) => (
                      <DaApprovareCard key={b.id} booking={b} onDone={onReload} />
                    ))}
                </div>
              </div>
            )}

            {/* Confermati */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {bookings.filter((b) => !b.is_waitlist && !daApprovare(b)).map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  onDelete={() => onDeleteBooking(b.id, `${b.first_name} ${b.last_name}`)}
                  onToggleWaitlist={() => onToggleWaitlist(b.id, true)}
                />
              ))}
            </div>

            {/* Lista d'attesa */}
            {bookings.some((b) => b.is_waitlist) && (
              <div className="mt-4">
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-400 mb-2">
                  <Clock className="h-3.5 w-3.5" />
                  Lista d&apos;attesa ({bookings.filter((b) => b.is_waitlist).length})
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {bookings.filter((b) => b.is_waitlist && !daApprovare(b)).map((b) => (
                    <BookingCard
                      key={b.id}
                      booking={b}
                      waitlist
                      onDelete={() => onDeleteBooking(b.id, `${b.first_name} ${b.last_name}`)}
                      onToggleWaitlist={() => onToggleWaitlist(b.id, false)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// BookingCard - singola prenotazione
// ============================================================================
function BookingCard({
  booking, onDelete, onToggleWaitlist, waitlist,
}: {
  booking: BookingWithMember;
  onDelete: () => void;
  onToggleWaitlist: () => void;
  waitlist?: boolean;
}) {
  // Avvisi
  const today = oggiItalia();
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const tesseraExpired = booking.expires_at && booking.expires_at < today;
  const tesseraExpiring = booking.expires_at && booking.expires_at >= today && booking.expires_at <= in30;
  const noCert = booking.member_type !== 'sostenitore' && !booking.medical_cert_received;
  const certExpired = booking.medical_cert_received && booking.medical_cert_expires_at && booking.medical_cert_expires_at < today;

  const hasIssues = tesseraExpired || noCert || certExpired;

  return (
    <div className={cn(
      'flex items-center gap-2 p-2.5 rounded border',
      waitlist ? 'bg-amber-500/[0.03] border-amber-500/20' :
      hasIssues ? 'border-amber-500/30 bg-amber-500/[0.02]' : 'border-border bg-bg-elevated/40'
    )}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link href={`/soci/${booking.member_id}`} className="text-sm font-medium text-text hover:text-accent truncate">
            {booking.first_name} {booking.last_name}
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
        {(booking.created_by_name || booking.created_at) && (
          <div className="text-[9px] text-text-dim mt-1">
            Inserito
            {booking.created_by_name && ` da ${booking.created_by_name}`}
            {booking.created_at && ` il ${new Date(booking.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })}`}
          </div>
        )}
      </div>
      <button
        onClick={onToggleWaitlist}
        className={cn(
          'p-1 rounded shrink-0',
          waitlist
            ? 'hover:bg-emerald-500/10 text-text-dim hover:text-emerald-400'
            : 'hover:bg-amber-500/10 text-text-dim hover:text-amber-400'
        )}
        title={waitlist ? 'Sposta tra i confermati' : 'Metti in lista d\'attesa'}
      >
        {waitlist ? <ArrowUp className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
      </button>
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

// ============================================================================
// NotifyWhatsappModal - avvisa i prenotati via WhatsApp
// Due modalita:
//  A) Invio automatico via OpenWA (se OPENWA_URL configurato su Vercel)
//  B) Apri chat uno-per-uno via wa.me (sempre disponibile, fallback)
// ============================================================================
function NotifyWhatsappModal({
  open, onClose, date, template, bookings,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  template: SessionTemplate;
  bookings: BookingWithMember[];
}) {
  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const defaultText =
    `Ciao! Aggiornamento per la sessione ${template.name} di ${dateLabel}.\n\n` +
    `Condizioni meteo: \n` +
    `Ritrovo: \n\n` +
    `A presto,\nCircolo Alto Garda Kite`;

  const [text, setText] = useState(defaultText);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  // Stato OpenWA
  const [openwaStatus, setOpenwaStatus] = useState<'checking' | 'available' | 'session_down' | 'unavailable'>('checking');
  const [sessionStatusLabel, setSessionStatusLabel] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; uncertain?: number; results: { name: string; ok: boolean; warning?: boolean; error?: string }[] } | null>(null);

  const withPhone = bookings.filter((b) => normalizePhone(b.phone) !== null);
  const withoutPhone = bookings.filter((b) => normalizePhone(b.phone) === null);

  useEffect(() => {
    if (!open) return;
    setOpenwaStatus('checking');
    fetch('/api/whatsapp/invia')
      .then((r) => r.json())
      .then((d) => {
        if (!d.configured || !d.reachable) {
          setOpenwaStatus('unavailable');
        } else if (d.sessionReady) {
          setOpenwaStatus('available');
        } else {
          setOpenwaStatus('session_down');
          setSessionStatusLabel(d.sessionStatus || '');
        }
      })
      .catch(() => setOpenwaStatus('unavailable'));
  }, [open]);

  function openChat(b: BookingWithMember) {
    const link = buildWhatsappLink(b.phone, text);
    if (!link) return;
    window.open(link, '_blank', 'noopener,noreferrer');
    setSentIds((prev) => new Set(prev).add(b.id));
  }

  async function sendAll() {
    if (!text.trim() || withPhone.length === 0) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch('/api/whatsapp/invia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          recipients: withPhone.map((b) => ({
            name: `${b.first_name} ${b.last_name}`,
            phone: b.phone,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Se la sessione e' caduta, aggiorna lo stato del modale
        if (data.sessionDown) {
          setOpenwaStatus('session_down');
          setSessionStatusLabel(data.sessionStatus || '');
        }
        throw new Error(data.error || 'Errore invio');
      }
      setSendResult(data);
    } catch (e) {
      setSendResult({ sent: 0, failed: withPhone.length, results: [{ name: 'Errore', ok: false, error: e instanceof Error ? e.message : 'errore' }] });
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Avvisa i prenotati - ${template.name}`}
      description={`${withPhone.length} ${withPhone.length === 1 ? 'persona raggiungibile' : 'persone raggiungibili'} · ${dateLabel}`}
      size="lg"
    >
      <div className="space-y-5">
        <div>
          <Textarea
            label="Messaggio (uguale per tutti)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
          />
        </div>

        {/* MODALITA A: invio automatico via OpenWA */}
        {openwaStatus === 'available' && (
          <div className="p-3 rounded border border-accent/30 bg-accent/5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm">
                <div className="flex items-center gap-1.5 font-medium text-accent">
                  <Zap className="h-4 w-4" />
                  Invio automatico disponibile
                </div>
                <div className="text-xs text-text-muted mt-0.5">
                  Manda a tutti i {withPhone.length} con un click, dal numero del circolo.
                </div>
              </div>
              <Button onClick={sendAll} disabled={sending || withPhone.length === 0}>
                {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Invia a tutti ({withPhone.length})
              </Button>
            </div>

            {sendResult && (
              <div className="mt-3 pt-3 border-t border-accent/20">
                <div className="text-sm">
                  <span className="text-emerald-400">{sendResult.sent} inviati</span>
                  {sendResult.failed > 0 && (
                    <span className="text-red-400 ml-2">{sendResult.failed} falliti</span>
                  )}
                </div>
                {sendResult.uncertain ? (
                  <div className="text-[10px] text-amber-400 mt-1">
                    {sendResult.uncertain} con conferma incerta (quasi sicuramente inviati lo stesso)
                  </div>
                ) : null}
                {sendResult.failed > 0 && (
                  <div className="text-[10px] text-text-dim mt-1.5 space-y-0.5 max-h-24 overflow-y-auto">
                    {sendResult.results.filter((r) => !r.ok).map((r, i) => (
                      <div key={i}>{r.name}: {r.error}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {openwaStatus === 'checking' && (
          <div className="p-2.5 rounded bg-bg-elevated text-xs text-text-muted flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Verifico se l&apos;invio automatico e disponibile...
          </div>
        )}

        {openwaStatus === 'session_down' && (
          <div className="p-3 rounded border border-amber-500/40 bg-amber-500/5">
            <div className="flex items-center gap-1.5 text-sm font-medium text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              WhatsApp disconnesso
            </div>
            <div className="text-xs text-text-muted mt-1">
              La sessione WhatsApp non e collegata{sessionStatusLabel ? ` (stato: ${sessionStatusLabel})` : ''}.
              Apri OpenWA sul PC del circolo e riscansiona il codice QR.
              Intanto puoi usare &quot;Apri chat&quot; qui sotto per inviare manualmente.
            </div>
          </div>
        )}

        {/* MODALITA B: apri chat uno-per-uno (sempre presente come fallback) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-text-muted">
              {openwaStatus === 'available' ? 'Oppure apri le chat manualmente:' : 'Apri la chat di ciascuno:'}
              {' '}({sentIds.size}/{withPhone.length})
            </div>
          </div>
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {withPhone.map((b) => {
              const sent = sentIds.has(b.id);
              return (
                <div
                  key={b.id}
                  className={cn(
                    'flex items-center gap-2 p-2.5 rounded border',
                    sent ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border bg-bg-elevated/40'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-text truncate">
                      {b.first_name} {b.last_name}
                    </div>
                    <div className="text-[10px] text-text-dim flex items-center gap-1">
                      <Phone className="h-2.5 w-2.5" />
                      {b.phone}
                    </div>
                  </div>
                  <Button size="sm" variant={sent ? 'ghost' : 'secondary'} onClick={() => openChat(b)}>
                    {sent ? <><Check className="h-3.5 w-3.5 mr-1" /> Riapri</> : <><ExternalLink className="h-3.5 w-3.5 mr-1" /> Apri chat</>}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        {withoutPhone.length > 0 && (
          <div className="p-3 rounded bg-amber-500/5 border border-amber-500/30">
            <div className="text-xs text-amber-400 flex items-center gap-1.5 mb-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              {withoutPhone.length} senza numero valido:
            </div>
            <div className="text-xs text-text-muted">
              {withoutPhone.map((b) => `${b.first_name} ${b.last_name}`).join(', ')}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-border">
          <Button variant="ghost" onClick={onClose}>Chiudi</Button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// MultiBookingModal - prenotazione multipla: piu soci x piu giorni x piu sessioni
// ============================================================================
function MultiBookingModal({
  open, onClose, startDate, templates, members, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  startDate: string;
  templates: SessionTemplate[];
  members: Pick<Member, 'id' | 'first_name' | 'last_name' | 'membership_number'>[];
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [participationType, setParticipationType] = useState<ParticipationType>('lift_semplice');
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped_count: number; skipped: string[] } | null>(null);

  // Calendario: mese visualizzato
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(startDate + 'T12:00:00');
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const filteredMembers = members
    .filter((m) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) || String(m.membership_number).includes(q);
    })
    .slice(0, 40);

  function toggleMember(id: string) {
    setSelectedMembers((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleDate(d: string) {
    setSelectedDates((prev) => {
      const n = new Set(prev);
      if (n.has(d)) n.delete(d); else n.add(d);
      return n;
    });
  }
  function toggleTemplate(id: string) {
    setSelectedTemplates((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  // Costruisci griglia calendario
  const calDays = (() => {
    const first = new Date(calMonth.year, calMonth.month, 1);
    const startWeekday = (first.getDay() + 6) % 7; // lun=0
    const daysInMonth = new Date(calMonth.year, calMonth.month + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(calMonth.month + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      cells.push(`${calMonth.year}-${mm}-${dd}`);
    }
    return cells;
  })();

  const totalCount = selectedMembers.size * selectedDates.size * selectedTemplates.size;

  async function submit() {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch('/api/bookings/multipla', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_ids: [...selectedMembers],
          dates: [...selectedDates],
          session_template_ids: [...selectedTemplates],
          participation_type: participationType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      setResult(data);
      if (data.created > 0) onSuccess();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Errore');
    } finally {
      setSubmitting(false);
    }
  }

  const monthLabel = new Date(calMonth.year, calMonth.month, 1)
    .toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  return (
    <Modal open={open} onClose={onClose} title="Prenotazione multipla" size="lg">
      {result ? (
        <div className="space-y-4">
          <div className="p-4 rounded border border-emerald-500/30 bg-emerald-500/5 text-emerald-400">
            <div className="text-lg font-display font-bold">{result.created} prenotazioni create</div>
          </div>
          {result.skipped_count > 0 && (
            <div className="p-3 rounded border border-amber-500/30 bg-amber-500/5">
              <div className="text-sm text-amber-400 mb-1.5">
                {result.skipped_count} saltate (gia prenotate):
              </div>
              <div className="text-xs text-text-muted max-h-40 overflow-y-auto space-y-0.5">
                {result.skipped.map((s, i) => <div key={i}>{s}</div>)}
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={onClose}>Chiudi</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-xs">
            {[1, 2, 3].map((s) => (
              <div key={s} className={cn(
                'flex items-center gap-1',
                step === s ? 'text-accent font-medium' : 'text-text-dim'
              )}>
                <span className={cn(
                  'h-5 w-5 rounded-full flex items-center justify-center text-[10px]',
                  step === s ? 'bg-accent text-bg' : 'bg-bg-elevated'
                )}>{s}</span>
                {s === 1 ? 'Soci' : s === 2 ? 'Giorni' : 'Sessioni'}
              </div>
            ))}
          </div>

          {/* STEP 1: SOCI */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="text-sm text-text-muted">
                Scegli uno o piu soci ({selectedMembers.size} selezionati)
              </div>
              <input
                type="text"
                placeholder="Cerca per nome o tessera"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <div className="max-h-64 overflow-y-auto space-y-1 border border-border rounded p-1.5">
                {filteredMembers.map((m) => {
                  const on = selectedMembers.has(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleMember(m.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm',
                        on ? 'bg-accent/10 text-accent' : 'hover:bg-bg-elevated text-text'
                      )}
                    >
                      <span className={cn('h-4 w-4 rounded border flex items-center justify-center shrink-0', on ? 'border-accent bg-accent/20' : 'border-border')}>
                        {on && <Check className="h-3 w-3" />}
                      </span>
                      {m.first_name} {m.last_name}
                      <span className="text-[10px] text-text-dim ml-auto">#{m.membership_number}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: GIORNI (calendario) */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="text-sm text-text-muted">
                Tocca i giorni ({selectedDates.size} selezionati)
              </div>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setCalMonth((c) => c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 })}
                  className="p-1.5 rounded hover:bg-bg-elevated text-text-muted"
                >
                  <ChevronRight className="h-4 w-4 rotate-180" />
                </button>
                <span className="text-sm font-medium capitalize">{monthLabel}</span>
                <button
                  onClick={() => setCalMonth((c) => c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 })}
                  className="p-1.5 rounded hover:bg-bg-elevated text-text-muted"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
                  <div key={i} className="text-[10px] text-text-dim py-1">{d}</div>
                ))}
                {calDays.map((d, i) => {
                  if (!d) return <div key={i} />;
                  const on = selectedDates.has(d);
                  const dayNum = parseInt(d.slice(-2), 10);
                  return (
                    <button
                      key={i}
                      onClick={() => toggleDate(d)}
                      className={cn(
                        'aspect-square rounded text-sm flex items-center justify-center',
                        on ? 'bg-accent text-bg font-semibold' : 'hover:bg-bg-elevated text-text'
                      )}
                    >
                      {dayNum}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: SESSIONI + tipo */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="text-sm text-text-muted">
                Scegli le sessioni ({selectedTemplates.size} selezionate)
              </div>
              <div className="grid grid-cols-2 gap-2">
                {templates.map((t) => {
                  const on = selectedTemplates.has(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleTemplate(t.id)}
                      className={cn(
                        'p-2.5 rounded border text-left text-sm',
                        on ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-bg-surface text-text-muted'
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={cn('h-4 w-4 rounded border flex items-center justify-center shrink-0', on ? 'border-accent bg-accent/20' : 'border-border')}>
                          {on && <Check className="h-3 w-3" />}
                        </span>
                        {t.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="text-xs text-text-muted">Tipo partecipazione</label>
                <select
                  value={participationType}
                  onChange={(e) => setParticipationType(e.target.value as ParticipationType)}
                  className="w-full mt-1 bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-text"
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="lift_semplice">Lift semplice</option>
                  <option value="lift_supervisionato">Lift assistito</option>
                  <option value="corso">Corso</option>
                </select>
              </div>

              {totalCount > 0 && (
                <div className="p-3 rounded bg-bg-elevated border border-border text-sm">
                  Stai per creare fino a <strong className="text-accent">{totalCount}</strong> prenotazioni
                  <div className="text-[11px] text-text-dim mt-0.5">
                    {selectedMembers.size} soci × {selectedDates.size} giorni × {selectedTemplates.size} sessioni
                    <br />Le combinazioni gia prenotate verranno saltate.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigazione step */}
          <div className="flex justify-between gap-3 pt-2 border-t border-border">
            <Button variant="ghost" onClick={step === 1 ? onClose : () => setStep((s) => (s - 1) as 1 | 2 | 3)}>
              {step === 1 ? 'Annulla' : 'Indietro'}
            </Button>
            {step < 3 ? (
              <Button
                onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
                disabled={(step === 1 && selectedMembers.size === 0) || (step === 2 && selectedDates.size === 0)}
              >
                Avanti
              </Button>
            ) : (
              <Button onClick={submit} disabled={submitting || totalCount === 0}>
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CalendarPlus className="h-4 w-4 mr-2" />}
                Crea prenotazioni
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ============================================================================
// AbsencesModal - segnala/rimuovi assenze istruttori del giorno
// ============================================================================
function AbsencesModal({
  open, onClose, date, templates, instructors, absences, onChanged,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  templates: SessionTemplate[];
  instructors: Instructor[];
  absences: InstructorAbsence[];
  onChanged: () => void;
}) {
  const [instructorId, setInstructorId] = useState('');
  const [templateId, setTemplateId] = useState(''); // '' = giorno intero
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  async function add() {
    if (!instructorId) { setErr('Scegli un istruttore'); return; }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/planning/assenze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructor_id: instructorId,
          absence_date: date,
          session_template_id: templateId || null,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      setInstructorId('');
      setTemplateId('');
      setNotes('');
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Errore');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/planning/assenze/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Errore');
      }
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Errore');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Assenze istruttori">
      <div className="space-y-4">
        <p className="text-sm text-text-muted capitalize">{dateLabel}</p>

        {/* Assenze esistenti */}
        {absences.length > 0 ? (
          <div className="space-y-1.5">
            {absences.map((a) => {
              const tpl = templates.find((t) => t.id === a.session_template_id);
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded border border-amber-500/25 bg-amber-500/5"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-text font-medium">
                      {a.instructor ? `${a.instructor.first_name} ${a.instructor.last_name}` : 'Istruttore'}
                    </div>
                    <div className="text-[11px] text-amber-400">
                      {tpl ? tpl.name : 'Giorno intero'}
                      {a.notes && <span className="text-text-dim"> · {a.notes}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => remove(a.id)}
                    className="p-1 rounded hover:bg-red-500/10 text-text-dim hover:text-red-400 shrink-0"
                    title="Rimuovi assenza"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-text-dim">Nessuna assenza segnalata per questo giorno.</p>
        )}

        {/* Aggiungi */}
        <div className="pt-3 border-t border-border space-y-3">
          <div className="text-xs font-medium text-text-muted">Segnala assenza</div>

          <div>
            <label className="text-xs text-text-muted">Istruttore</label>
            <select
              value={instructorId}
              onChange={(e) => setInstructorId(e.target.value)}
              className="w-full mt-1 bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-text"
            >
              <option value="">Scegli...</option>
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>{i.first_name} {i.last_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-text-muted">Quando</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full mt-1 bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-text"
            >
              <option value="">Giorno intero</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>Solo {t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-text-muted">Note (facoltative)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="es. visita medica"
              className="w-full mt-1 bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-text"
            />
          </div>

          {err && <p className="text-xs text-red-400">{err}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Chiudi</Button>
            <Button onClick={add} disabled={saving || !instructorId}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserX className="h-4 w-4 mr-2" />}
              Segnala
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}


// Scheda di una richiesta dal portale in attesa di risposta.
// Accetta/Rifiuta passano dalla stessa API della pagina Richieste:
// stato + avviso al socio in un colpo solo.
function DaApprovareCard({ booking, onDone }: { booking: BookingWithMember; onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  const rispondi = async (accetta: boolean) => {
    let motivo: string | undefined;
    if (!accetta) {
      const m = window.prompt('Il motivo che leggerà il socio (vuoto = standard):');
      if (m === null) return;
      motivo = m || undefined;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/richieste/${booking.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accetta, motivo }),
      });
      if (res.ok) onDone();
      else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || 'Non ha funzionato');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border border-amber-500/30 bg-bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">
            {booking.first_name} {booking.last_name}
          </div>
          {booking.notes && (
            <div className="text-[10px] text-text-dim italic truncate">«{booking.notes}»</div>
          )}
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={() => rispondi(true)}
            disabled={busy}
            className="px-2.5 py-1.5 rounded bg-accent text-bg text-xs font-semibold hover:bg-accent-hover disabled:opacity-50"
            title="Accetta: tiene il posto e avvisa il socio"
          >
            Accetta
          </button>
          <button
            onClick={() => rispondi(false)}
            disabled={busy}
            className="px-2 py-1.5 rounded border border-border text-xs text-text-muted hover:text-text disabled:opacity-50"
            title="Rifiuta col motivo"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}


// Notifica nel PORTALE a tutti i prenotati della sessione. Diversa da
// "Avvisa" (WhatsApp via OpenWA): questa scrive gli avvisi in-app, gratis
// e senza numeri di telefono di mezzo. I destinatari li decide la funzione
// avvisa_sessione(): staff + accettate, lista d'attesa inclusa.
function NotificaPortaleModal({
  open, onClose, date, template, destinatari,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  template: SessionTemplate;
  destinatari: number;
}) {
  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const [tipo, setTipo] = useState<'messaggio' | 'annullamento' | 'promemoria'>('messaggio');
  const [titolo, setTitolo] = useState('');
  const [corpo, setCorpo] = useState('');
  const [busy, setBusy] = useState(false);
  const [esito, setEsito] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  const PRONTI: Record<string, { titolo: string; corpo: string }> = {
    annullamento: {
      titolo: 'Uscita annullata',
      corpo: `La sessione ${template.name} di ${dateLabel} è annullata per condizioni meteo. Non ti viene scalata dal pacchetto.`,
    },
    promemoria: {
      titolo: 'Promemoria uscita',
      corpo: `Ci vediamo ${dateLabel} per la sessione ${template.name}. Ritrovo al Porto San Nicolò 15 minuti prima.`,
    },
    messaggio: { titolo: '', corpo: '' },
  };

  const scegli = (t: 'messaggio' | 'annullamento' | 'promemoria') => {
    setTipo(t);
    setTitolo(PRONTI[t].titolo);
    setCorpo(PRONTI[t].corpo);
  };

  const invia = async () => {
    setBusy(true);
    setErrore(null);
    try {
      const res = await fetch('/api/notifiche-sessione', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, template_id: template.id, titolo, corpo, tipo }),
      });
      const j = await res.json();
      if (!res.ok) setErrore(j.error || 'Non ha funzionato');
      else if (j.avvisati === 0)
        setEsito('Nessun destinatario: su questa sessione non ci sono soci col portale (le richieste non ancora accettate e la lista d\u2019attesa non ricevono).');
      else {
        const conPush = (j.con_push || []) as string[];
        const senzaPush = (j.senza_push || []) as string[];
        let msg = `Avviso creato per ${j.avvisati} ${j.avvisati === 1 ? 'socio' : 'soci'}.`;
        if (conPush.length > 0) msg += ` Notifica sul telefono a: ${conPush.join(', ')}.`;
        if (senzaPush.length > 0)
          msg += ` Da contattare in altro modo (vedranno l\u2019avviso solo aprendo il portale): ${senzaPush.join(', ')}.`;
        setEsito(msg);
      }
    } catch {
      setErrore('Non riesco a raggiungere il server');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-bg-elevated border border-border rounded-xl w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-lg font-bold">Notifica nel portale</h3>
        <p className="text-xs text-text-muted mt-1">
          {template.name} · {dateLabel} · arriverà a <b className="text-text">{destinatari}</b>{' '}
          {destinatari === 1 ? 'socio' : 'soci'} (lista d&apos;attesa inclusa, richieste non
          approvate escluse). Solo chi usa il portale la vede.
        </p>

        {esito ? (
          <>
            <div className="mt-4 rounded-md bg-accent/10 text-accent text-sm px-3 py-2.5">{esito}</div>
            <button
              onClick={onClose}
              className="mt-4 w-full px-4 py-2.5 rounded-md bg-accent text-bg text-sm font-semibold"
            >
              Chiudi
            </button>
          </>
        ) : (
          <>
            <div className="flex gap-1.5 mt-4">
              {(['messaggio', 'annullamento', 'promemoria'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => scegli(t)}
                  className={
                    'flex-1 px-2 py-1.5 rounded-md border text-xs capitalize ' +
                    (tipo === t
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-text-muted hover:text-text')
                  }
                >
                  {t}
                </button>
              ))}
            </div>

            <input
              value={titolo}
              onChange={(e) => setTitolo(e.target.value)}
              placeholder="Titolo"
              className="mt-3 w-full bg-bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
            <textarea
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              rows={4}
              placeholder="Il messaggio che leggeranno i soci…"
              className="mt-2 w-full bg-bg-input border border-border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:border-accent"
            />

            {errore && (
              <div className="mt-2 rounded-md bg-red-500/10 text-red-400 text-xs px-3 py-2">{errore}</div>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-md border border-border text-sm text-text-muted hover:text-text"
              >
                Annulla
              </button>
              <button
                onClick={invia}
                disabled={busy || !titolo.trim() || !corpo.trim() || destinatari === 0}
                className="flex-1 px-4 py-2.5 rounded-md bg-accent text-bg text-sm font-semibold hover:bg-accent-hover disabled:opacity-50"
              >
                {busy ? 'Invio…' : 'Invia la notifica'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
