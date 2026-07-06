'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Plus, Loader2, Trash2, Anchor, Wind, Sparkles, AlertTriangle,
  Users, Sailboat, ChevronRight, GraduationCap, Heart,
  MessageCircle, Send, Phone, Check, Zap, ExternalLink,
  Clock, ArrowUp,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';
import { buildWhatsappLink, normalizePhone } from '@/lib/whatsapp';
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

  // Modal: avvisa via WhatsApp
  const [notifyFor, setNotifyFor] = useState<{
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
            onCreateOuting={() => setCreateOutingFor({ template, bookings: slotBookings.filter((b) => !b.is_waitlist) })}
            onDeleteBooking={handleDeleteBooking}
            onNotify={() => setNotifyFor({ template, bookings: slotBookings.filter((b) => !b.is_waitlist) })}
            onToggleWaitlist={handleToggleWaitlist}
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

      {notifyFor && (
        <NotifyWhatsappModal
          open={true}
          onClose={() => setNotifyFor(null)}
          date={date}
          template={notifyFor.template}
          bookings={notifyFor.bookings}
        />
      )}
    </div>
  );
}

// ============================================================================
// SlotBlock - una sessione (Peler / Ora / Ora late ecc.)
// ============================================================================
function SlotBlock({
  template, bookings, onAddBooking, onCreateOuting, onDeleteBooking, onNotify, onToggleWaitlist,
}: {
  template: SessionTemplate;
  bookings: BookingWithMember[];
  onAddBooking: () => void;
  onCreateOuting: () => void;
  onDeleteBooking: (bookingId: string, memberName: string) => void;
  onNotify: () => void;
  onToggleWaitlist: (bookingId: string, toWaitlist: boolean) => void;
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
            {/* Confermati */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {bookings.filter((b) => !b.is_waitlist).map((b) => (
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
                  {bookings.filter((b) => b.is_waitlist).map((b) => (
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
  const today = new Date().toISOString().slice(0, 10);
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
