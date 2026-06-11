import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';
import { memberSchema } from '@/lib/validation/schemas';

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    // Anche utenti senza ruolo possono creare se si iscrivono da soli
    // (ma noi assumiamo lo staff) — qui facciamo registrazione "amministrativa"

    const body = await request.json();
    const parsed = memberSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validazione fallita', issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const data = parsed.data;

    // Normalizza dati base
    const memberInsert = {
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      birth_date: data.birth_date || null,
      birth_place: data.birth_place || null,
      birth_province: data.birth_province?.toUpperCase() || null,
      fiscal_code: data.fiscal_code ? data.fiscal_code.toUpperCase().trim() : null,
      is_foreign: data.is_foreign,
      foreign_id_doc: data.foreign_id_doc?.trim() || null,
      phone: data.phone || null,
      email: data.email ? data.email.toLowerCase() : null,
      // Indirizzo: usiamo il campo libero address come address_street per compatibilita'
      address_street: data.address || null,
      address_number: null,
      city: null,
      cap: null,
      is_minor: data.is_minor,
      parent_first_name: data.is_minor ? data.parent_first_name : null,
      parent_last_name: data.is_minor ? data.parent_last_name : null,
      parent_phone: data.is_minor ? data.parent_phone : null,
      parent_email: data.is_minor ? data.parent_email : null,
      // Tipo associativo e dati tessera
      member_type: data.member_type,
      // Certificato medico
      medical_cert_received: data.medical_cert_received,
      medical_cert_expires_at: data.medical_cert_expires_at || null,
      // Note
      notes: data.notes || null,
      active: true,
      // Marcatore: il socio ha sempre firmato cartaceo nel nuovo flusso
      paper_form_signed: true,
    };

    const { data: member, error } = await supabase
      .from('members')
      .insert(memberInsert as Record<string, unknown>)
      .select('id')
      .single();

    if (error) {
      console.error('Errore inserimento socio:', error);
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Esiste gia un socio con questo codice fiscale' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: error.message || 'Errore inserimento' },
        { status: 500 }
      );
    }

    // Subito dopo la creazione: registra la tessera (rinnovo iniziale)
    // tramite la function renew_membership
    const { error: renewErr } = await supabase.rpc('renew_membership', {
      p_member_id: member.id,
      p_new_type: data.member_type,
      p_paid_now: data.membership_paid_now,
      p_payment_method: data.membership_payment_method,
      p_renewed_by: auth?.userId || null,
    });

    if (renewErr) {
      console.error('Errore creazione tessera:', renewErr);
      // Non blocco la creazione, ma logga l'errore
    }

    return NextResponse.json({ id: member.id }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
