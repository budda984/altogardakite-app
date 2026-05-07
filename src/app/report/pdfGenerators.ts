'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ============================================================================
// HELPERS
// ============================================================================
function formatDate(iso: string): string {
  const d = new Date(iso + (iso.includes('T') ? '' : 'T12:00:00'));
  return d.toLocaleDateString('it-IT');
}
function formatRange(from: string, to: string): string {
  if (from === to) return formatDate(from);
  return `${formatDate(from)} → ${formatDate(to)}`;
}

const DISCIPLINE_LABELS: Record<string, string> = {
  kite: 'Kite', wingfoil: 'Wingfoil', sit_kite: 'Sit-kite',
  wingfoil_adattato: 'Wingfoil adattato', corso: 'Corso', altro: 'Altro',
};
const STATUS_LABELS: Record<string, string> = {
  bozza: 'Bozza', chiusa: 'Chiusa', annullata: 'Annullata',
};
const PARTECIPATION_LABELS: Record<string, string> = {
  corso: 'Corso', lift_supervisionato: 'Lift assistito', lift_semplice: 'Lift',
};

/** Setup standard del PDF: header con logo testuale e footer con paginazione */
function setupDoc(title: string, period: string): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('A.S.D. ALTO GARDA KITE', 14, 12);
  doc.text(`Report generato: ${new Date().toLocaleString('it-IT')}`, 14, 17, { align: 'left' });

  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text(title, 14, 28);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Periodo: ${period}`, 14, 34);

  doc.setDrawColor(220, 220, 220);
  doc.line(14, 38, 196, 38);

  return doc;
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Pagina ${i} di ${pageCount}`, 196, 290, { align: 'right' });
    doc.text('A.S.D. Alto Garda Kite — Riva del Garda', 14, 290);
  }
}

function downloadPdf(doc: jsPDF, filename: string) {
  addFooter(doc);
  doc.save(filename);
}

function computeMinutes(departure: string | null, ret: string | null): number {
  if (!departure || !ret) return 0;
  const [dh, dm] = departure.split(':').map(Number);
  const [rh, rm] = ret.split(':').map(Number);
  return (rh * 60 + rm) - (dh * 60 + dm);
}

// ============================================================================
// SEASON / RIASSUNTO PERIODO (no prezzi)
// ============================================================================
type SeasonData = {
  period: { from: string; to: string };
  outings: {
    total: number; closed: number; cancelled: number; draft: number;
    by_discipline: Record<string, number>;
    by_boat: { name: string; count: number }[];
  };
  members_active: number;
  total_participants?: number;
  total_lifts_consumed?: number;
};

export function generateSeasonReport(data: SeasonData) {
  const doc = setupDoc('Riassunto periodo', formatRange(data.period.from, data.period.to));
  let y = 48;

  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('Sintesi attivita', 14, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [['Metrica', 'Valore']],
    body: [
      ['Soci attivi', String(data.members_active)],
      ['Uscite totali', String(data.outings.total)],
      ['  di cui chiuse', String(data.outings.closed)],
      ['  di cui annullate', String(data.outings.cancelled)],
      ['  di cui ancora bozza', String(data.outings.draft)],
      ...(data.total_participants !== undefined ? [['Partecipazioni complessive', String(data.total_participants)]] : []),
      ...(data.total_lifts_consumed !== undefined ? [['Lift / lezioni consumate', String(data.total_lifts_consumed)]] : []),
    ],
    theme: 'striped',
    headStyles: { fillColor: [93, 206, 170] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  if (Object.keys(data.outings.by_discipline).length > 0) {
    doc.setFontSize(11);
    doc.text('Uscite per disciplina', 14, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Disciplina', 'Numero uscite']],
      body: Object.entries(data.outings.by_discipline)
        .sort(([, a], [, b]) => b - a)
        .map(([d, count]) => [DISCIPLINE_LABELS[d] || d, String(count)]),
      theme: 'striped',
      headStyles: { fillColor: [93, 206, 170] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  if (data.outings.by_boat.length > 0) {
    doc.setFontSize(11);
    doc.text('Uscite per imbarcazione', 14, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Imbarcazione', 'Numero uscite']],
      body: data.outings.by_boat.map((b) => [b.name, String(b.count)]),
      theme: 'striped',
      headStyles: { fillColor: [93, 206, 170] },
      margin: { left: 14, right: 14 },
    });
  }

  downloadPdf(doc, `riassunto_${data.period.from}_${data.period.to}.pdf`);
}

// ============================================================================
// MEMBER REPORT (no prezzi)
// ============================================================================
type MemberData = {
  period: { from: string; to: string };
  member: {
    first_name: string; last_name: string; membership_number: number;
    fiscal_code: string | null; email: string | null; phone: string | null;
    member_type?: string;
  };
  participations: { participation_type: string; rental_type: string; outings: { outing_date: string; status: string; discipline: string | null; boat: { name: string } | { name: string }[] | null }[] | { outing_date: string; status: string; discipline: string | null; boat: { name: string } | { name: string }[] | null } }[];
  movements: {
    movement_date: string; movement_type: string; description: string;
    lift_delta: number; lift_discipline: string | null;
  }[];
  packages: {
    service_name_snapshot: string;
    lifts_total: number; lifts_used: number;
    is_subscription: boolean; valid_from: string | null; valid_until: string | null;
    created_at: string; discipline: string | null;
  }[];
  active_subscriptions: {
    service_name_snapshot: string; discipline: string;
    valid_from: string; valid_until: string; days_remaining: number;
  }[];
  summary: {
    lifts_consumed: number;
    participations_count: number;
  };
};

export function generateMemberReport(data: MemberData) {
  const fullName = `${data.member.last_name} ${data.member.first_name}`;
  const doc = setupDoc(
    `Report socio: ${fullName}`,
    formatRange(data.period.from, data.period.to)
  );
  let y = 48;

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Tessera #${data.member.membership_number}`, 14, y);
  if (data.member.email) doc.text(`Email: ${data.member.email}`, 14, y + 5);
  if (data.member.phone) doc.text(`Telefono: ${data.member.phone}`, 14, y + 10);
  y += 18;

  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('Sintesi periodo', 14, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [['Metrica', 'Valore']],
    body: [
      ['Partecipazioni a uscite', String(data.summary.participations_count)],
      ['Lift / lezioni consumate', String(data.summary.lifts_consumed)],
    ],
    theme: 'striped',
    headStyles: { fillColor: [93, 206, 170] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  if (data.active_subscriptions.length > 0) {
    doc.setFontSize(11);
    doc.text('Abbonamenti stagionali attivi', 14, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Pacchetto', 'Disciplina', 'Validita', 'Giorni residui']],
      body: data.active_subscriptions.map((s) => [
        s.service_name_snapshot,
        DISCIPLINE_LABELS[s.discipline] || s.discipline,
        `${formatDate(s.valid_from)} → ${formatDate(s.valid_until)}`,
        String(s.days_remaining),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [93, 206, 170] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  if (data.packages.length > 0) {
    doc.setFontSize(11);
    doc.text('Pacchetti acquistati nel periodo', 14, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Data', 'Pacchetto', 'Disciplina', 'Lift / Lezioni']],
      body: data.packages.map((p) => [
        formatDate(p.created_at),
        p.service_name_snapshot + (p.is_subscription ? ' (abbonamento)' : ''),
        p.discipline ? (DISCIPLINE_LABELS[p.discipline] || p.discipline) : '—',
        p.is_subscription ? '∞' : `${p.lifts_used} / ${p.lifts_total}`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [93, 206, 170] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // Movimenti: solo quelli con lift_delta != 0 (escludo gli addebiti puramente economici)
  const liftMovements = data.movements.filter((m) => Number(m.lift_delta) !== 0 || m.movement_type === 'correzione');
  if (liftMovements.length > 0) {
    doc.setFontSize(11);
    doc.text('Storico lift / lezioni', 14, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Data', 'Descrizione', 'Disciplina', 'Variazione']],
      body: liftMovements.map((m) => [
        formatDate(m.movement_date),
        m.description,
        m.lift_discipline ? (DISCIPLINE_LABELS[m.lift_discipline] || m.lift_discipline) : '—',
        m.lift_delta > 0 ? `+${m.lift_delta}` : String(m.lift_delta),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [93, 206, 170] },
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8 },
    });
  }

  downloadPdf(doc, `socio_${data.member.last_name}_${data.member.first_name}_${data.period.from}_${data.period.to}.pdf`);
}

// ============================================================================
// BOAT REPORT (no prezzi)
// ============================================================================
type BoatData = {
  period: { from: string; to: string };
  boat: { name: string; boat_type: string; capacity: number | null };
  outings: {
    outing_date: string; status: string; discipline: string | null;
    departure_time: string | null; return_time: string | null;
    weather_notes: string | null;
    outing_participants: { id: string }[];
    outing_instructors: { instructor: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] }[];
  }[];
  summary: {
    total_outings: number; closed: number; cancelled: number;
    total_participants: number; total_hours: number;
  };
};

export function generateBoatReport(data: BoatData) {
  const doc = setupDoc(
    `Report imbarcazione: ${data.boat.name}`,
    formatRange(data.period.from, data.period.to)
  );
  let y = 48;

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Tipo: ${data.boat.boat_type}${data.boat.capacity ? ` · Capienza: ${data.boat.capacity}` : ''}`, 14, y);
  y += 10;

  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('Sintesi periodo', 14, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [['Metrica', 'Valore']],
    body: [
      ['Uscite totali', String(data.summary.total_outings)],
      ['  di cui chiuse', String(data.summary.closed)],
      ['  di cui annullate', String(data.summary.cancelled)],
      ['Partecipanti complessivi', String(data.summary.total_participants)],
      ['Ore di utilizzo', `${data.summary.total_hours} h`],
    ],
    theme: 'striped',
    headStyles: { fillColor: [93, 206, 170] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  if (data.outings.length > 0) {
    doc.setFontSize(11);
    doc.text('Dettaglio uscite', 14, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Data', 'Orario', 'Disciplina', 'Stato', 'Part.', 'Istruttori']],
      body: data.outings.map((o) => {
        const insts = (o.outing_instructors || [])
          .map((oi) => {
            const i = Array.isArray(oi.instructor) ? oi.instructor[0] : oi.instructor;
            return i ? `${i.last_name} ${i.first_name[0]}.` : '';
          })
          .filter(Boolean)
          .join(', ');
        return [
          formatDate(o.outing_date),
          o.departure_time && o.return_time
            ? `${o.departure_time.slice(0, 5)}–${o.return_time.slice(0, 5)}`
            : '—',
          DISCIPLINE_LABELS[o.discipline || ''] || '—',
          STATUS_LABELS[o.status] || o.status,
          String(o.outing_participants?.length || 0),
          insts || '—',
        ];
      }),
      theme: 'striped',
      headStyles: { fillColor: [93, 206, 170] },
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8 },
    });
  }

  downloadPdf(doc, `barca_${data.boat.name}_${data.period.from}_${data.period.to}.pdf`);
}

// ============================================================================
// INSTRUCTOR REPORT (no prezzi)
// ============================================================================
type InstructorData = {
  period: { from: string; to: string };
  instructor: { first_name: string; last_name: string; role: string };
  outings: {
    outing_date: string; status: string; discipline: string | null;
    departure_time: string | null; return_time: string | null;
    role_in_outing: string | null;
    boat: { name: string } | { name: string }[] | null;
    outing_participants: { id: string }[];
  }[];
  summary: {
    total_outings: number; closed: number; cancelled: number;
    total_participants: number; total_hours: number;
  };
};

export function generateInstructorReport(data: InstructorData) {
  const fullName = `${data.instructor.last_name} ${data.instructor.first_name}`;
  const doc = setupDoc(
    `Report istruttore: ${fullName}`,
    formatRange(data.period.from, data.period.to)
  );
  let y = 48;

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Ruolo: ${data.instructor.role}`, 14, y);
  y += 10;

  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('Sintesi periodo', 14, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [['Metrica', 'Valore']],
    body: [
      ['Sessioni gestite', String(data.summary.total_outings)],
      ['  di cui chiuse', String(data.summary.closed)],
      ['  di cui annullate', String(data.summary.cancelled)],
      ['Partecipanti seguiti', String(data.summary.total_participants)],
      ['Ore di lavoro', `${data.summary.total_hours} h`],
    ],
    theme: 'striped',
    headStyles: { fillColor: [93, 206, 170] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  if (data.outings.length > 0) {
    doc.setFontSize(11);
    doc.text('Dettaglio sessioni', 14, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Data', 'Orario', 'Barca', 'Disciplina', 'Stato', 'Part.']],
      body: data.outings.map((o) => {
        const boat = Array.isArray(o.boat) ? o.boat[0] : o.boat;
        return [
          formatDate(o.outing_date),
          o.departure_time && o.return_time
            ? `${o.departure_time.slice(0, 5)}–${o.return_time.slice(0, 5)}`
            : '—',
          boat?.name || '—',
          DISCIPLINE_LABELS[o.discipline || ''] || '—',
          STATUS_LABELS[o.status] || o.status,
          String(o.outing_participants?.length || 0),
        ];
      }),
      theme: 'striped',
      headStyles: { fillColor: [93, 206, 170] },
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8 },
    });
  }

  downloadPdf(doc, `istruttore_${data.instructor.last_name}_${data.period.from}_${data.period.to}.pdf`);
}

// ============================================================================
// DAY REPORT (invariato — gia non aveva prezzi)
// ============================================================================
type DayData = {
  period: { from: string; to: string };
  outings: {
    outing_date: string; status: string; discipline: string | null;
    wind_session: string | null;
    departure_time: string | null; return_time: string | null;
    weather_notes: string | null; notes: string | null;
    cancellation_reason: string | null;
    boat: { name: string; capacity: number | null } | { name: string; capacity: number | null }[] | null;
    outing_instructors: { instructor: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] }[];
    outing_participants: {
      participation_type: string; rental_type: string;
      member: { first_name: string; last_name: string; membership_number: number } | { first_name: string; last_name: string; membership_number: number }[] | null;
    }[];
  }[];
};

export function generateDayReport(data: DayData) {
  const date = data.period.from;
  const doc = setupDoc('Report giornaliero', formatDate(date));
  let y = 48;

  if (data.outings.length === 0) {
    doc.setFontSize(11);
    doc.text('Nessuna sessione registrata in questo giorno.', 14, y);
    downloadPdf(doc, `giornata_${date}.pdf`);
    return;
  }

  for (const o of data.outings) {
    if (y > 230) {
      doc.addPage();
      y = 20;
    }

    const boat = Array.isArray(o.boat) ? o.boat[0] : o.boat;
    const insts = (o.outing_instructors || [])
      .map((oi) => {
        const i = Array.isArray(oi.instructor) ? oi.instructor[0] : oi.instructor;
        return i ? `${i.first_name} ${i.last_name}` : '';
      })
      .filter(Boolean);

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    const headerLine = `${boat?.name || '?'} · ${
      o.departure_time && o.return_time ? `${o.departure_time.slice(0,5)}–${o.return_time.slice(0,5)}` : '—'
    } · ${STATUS_LABELS[o.status] || o.status}`;
    doc.text(headerLine, 14, y);
    y += 5;

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    if (insts.length > 0) {
      doc.text(`Istruttori: ${insts.join(', ')}`, 14, y);
      y += 4;
    }
    if (o.weather_notes) {
      doc.text(`Meteo: ${o.weather_notes}`, 14, y);
      y += 4;
    }
    if (o.cancellation_reason) {
      doc.setTextColor(200, 50, 50);
      doc.text(`Annullata: ${o.cancellation_reason}`, 14, y);
      doc.setTextColor(100, 100, 100);
      y += 4;
    }

    if (o.outing_participants.length > 0) {
      autoTable(doc, {
        startY: y + 1,
        head: [['Tessera', 'Cognome Nome', 'Tipo', 'Noleggio']],
        body: o.outing_participants.map((p) => {
          const m = Array.isArray(p.member) ? p.member[0] : p.member;
          return [
            m ? `#${m.membership_number}` : '—',
            m ? `${m.last_name} ${m.first_name}` : '—',
            PARTECIPATION_LABELS[p.participation_type] || p.participation_type,
            p.rental_type === 'nessuno' ? '—' : p.rental_type.replace('_', ' '),
          ];
        }),
        theme: 'plain',
        headStyles: { fillColor: [240, 240, 240], textColor: [60, 60, 60], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    } else {
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('  (nessun partecipante)', 14, y + 2);
      y += 8;
    }
  }

  downloadPdf(doc, `giornata_${date}.pdf`);
}
