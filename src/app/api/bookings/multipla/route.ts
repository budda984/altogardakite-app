import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';
import { z } from 'zod';

const bulkSchema = z.object({
  member_ids: z.array(z.string().uuid()).min(1, 'Almeno un socio'),
  dates: z.array(z.string().min(1)).min(1, 'Almeno un giorno'),
  session_template_ids: z.array(z.string().uuid()).min(1, 'Almeno una sessione'),
  participation_type: z.enum(['corso', 'lift_supervisionato', 'lift_semplice']),
  preferred_discipline: z.enum(['kite', 'wingfoil', 'sit_kite', 'wingfoil_adattato', 'corso', 'altro']).nullable().optional(),
  notes: z.string().optional().or(z.literal('')),
});

/**
 * POST /api/bookings/multipla
 * Crea in blocco le prenotazioni per la combinazione
 * soci × giorni × sessioni. Salta quelle gia esistenti (pending) e
 * riporta il dettaglio.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join('; ');
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { member_ids, dates, session_template_ids, participation_type, preferred_discipline, notes } = parsed.data;
    const supabase = await createClient();

    // Mappa nomi soci per il report
    const { data: membersData } = await supabase
      .from('members')
      .select('id, first_name, last_name')
      .in('id', member_ids);
    const memberName: Record<string, string> = {};
    (membersData || []).forEach((m) => { memberName[m.id] = `${m.first_name} ${m.last_name}`; });

    // Prenotazioni pending gia esistenti nel range, per non duplicare
    const { data: existing } = await supabase
      .from('bookings')
      .select('member_id, booking_date, session_template_id')
      .in('member_id', member_ids)
      .in('booking_date', dates)
      .in('session_template_id', session_template_ids)
      .eq('status', 'pending');

    const existsKey = new Set(
      (existing || []).map((e) => `${e.member_id}|${e.booking_date}|${e.session_template_id}`)
    );

    // Costruisci le righe da inserire, saltando i duplicati
    const toInsert: {
      member_id: string; booking_date: string; session_template_id: string;
      preferred_discipline: string | null; participation_type: string;
      notes: string | null; status: string; created_by: string | null;
    }[] = [];
    const skipped: string[] = [];

    for (const memberId of member_ids) {
      for (const date of dates) {
        for (const templateId of session_template_ids) {
          const key = `${memberId}|${date}|${templateId}`;
          if (existsKey.has(key)) {
            skipped.push(`${memberName[memberId] || 'Socio'} - ${date}`);
            continue;
          }
          toInsert.push({
            member_id: memberId,
            booking_date: date,
            session_template_id: templateId,
            preferred_discipline: preferred_discipline || null,
            participation_type,
            notes: notes || null,
            status: 'pending',
            created_by: auth.userId,
          });
        }
      }
    }

    let created = 0;
    if (toInsert.length > 0) {
      const { error, count } = await supabase
        .from('bookings')
        .insert(toInsert, { count: 'exact' });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      created = count ?? toInsert.length;
    }

    return NextResponse.json({
      ok: true,
      created,
      skipped_count: skipped.length,
      skipped: skipped.slice(0, 50),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
