import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';
import { planningParticipantSchema } from '@/lib/validation/admin-schemas';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: outingId } = await params;
    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = planningParticipantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const data = parsed.data;

    // Recupera outing per disciplina e date
    const { data: outing, error: outErr } = await supabase
      .from('outings')
      .select('*, boats(name)')
      .eq('id', outingId)
      .single();
    if (outErr || !outing) {
      return NextResponse.json({ error: 'Uscita non trovata' }, { status: 404 });
    }

    // Inserisci il participant
    const { data: participant, error: pErr } = await supabase
      .from('outing_participants')
      .insert({
        outing_id: outingId,
        member_id: data.member_id,
        participation_type: data.participation_type,
        rental_type: data.rental_type,
      })
      .select()
      .single();

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    // Gestione fatturazione (billing_mode)
    const discipline = outing.discipline || 'kite';

    if (data.billing_mode === 'consume_package') {
      // Consuma 1 lift dal pacchetto suggerito (FIFO) o da quello specifico
      if (data.package_id) {
        // Pacchetto specifico
        const { data: pkg } = await supabase
          .from('packages')
          .select('*')
          .eq('id', data.package_id)
          .eq('member_id', data.member_id)
          .single();
        if (!pkg || pkg.is_exhausted) {
          return NextResponse.json(
            { error: 'Pacchetto selezionato non utilizzabile' },
            { status: 400 }
          );
        }
        await supabase
          .from('packages')
          .update({ lifts_used: pkg.lifts_used + 1 })
          .eq('id', pkg.id);
        await supabase.from('movements').insert({
          member_id: data.member_id,
          movement_type: 'consumo_lift',
          description: `Consumo lift ${discipline} (${pkg.service_name_snapshot}) — uscita ${outing.boats?.name || ''}`,
          amount: 0,
          lift_delta: -1,
          lift_discipline: discipline,
          package_id: pkg.id,
          outing_id: outingId,
          created_by: auth.userId,
        });
      } else {
        // FIFO via funzione SQL
        const { data: pkgId, error: fnErr } = await supabase.rpc('consume_lift', {
          p_member_id: data.member_id,
          p_discipline: discipline,
          p_outing_id: outingId,
          p_notes: data.notes || null,
        });
        if (fnErr) {
          return NextResponse.json({ error: fnErr.message }, { status: 500 });
        }
        if (!pkgId) {
          return NextResponse.json(
            { error: 'Nessun pacchetto disponibile per ' + discipline },
            { status: 400 }
          );
        }
      }
    } else if (data.billing_mode === 'charge_unpaid' || data.billing_mode === 'charge_paid') {
      const amount = Number(data.charge_amount || 0);
      if (amount <= 0) {
        return NextResponse.json(
          { error: 'Importo da addebitare obbligatorio' },
          { status: 400 }
        );
      }
      const isPaid = data.billing_mode === 'charge_paid';
      await supabase.from('movements').insert({
        member_id: data.member_id,
        movement_type: isPaid ? 'pagamento' : 'addebito',
        description: `Lift ${discipline} (uscita ${outing.boats?.name || ''})`,
        amount: isPaid ? amount : -amount,
        lift_delta: 0,
        outing_id: outingId,
        paid: isPaid,
        payment_method: isPaid ? data.payment_method : null,
        notes: data.notes || null,
        created_by: auth.userId,
      });
    }
    // billing_mode === 'no_charge': non fa nulla in piu'

    return NextResponse.json(participant, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: outingId } = await params;
    const participantId = request.nextUrl.searchParams.get('participant_id');
    if (!participantId) {
      return NextResponse.json({ error: 'participant_id richiesto' }, { status: 400 });
    }

    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('outing_participants')
      .delete()
      .eq('id', participantId)
      .eq('outing_id', outingId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
