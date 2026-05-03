import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { memberSchema } from '@/lib/validation/schemas';

export async function POST(request: Request) {
  try {
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

    // Normalizza dati
    const insert = {
      ...data,
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      fiscal_code: data.fiscal_code ? data.fiscal_code.toUpperCase().trim() : null,
      foreign_id_doc: data.foreign_id_doc?.trim() || null,
      email: data.email.toLowerCase(),
      birth_province: data.birth_province?.toUpperCase() || null,
      // Pulizia campi parent se non minore
      ...(data.is_minor
        ? {}
        : {
            parent_first_name: null,
            parent_last_name: null,
            parent_birth_date: null,
            parent_birth_place: null,
            parent_fiscal_code: null,
            parent_address_street: null,
            parent_address_number: null,
            parent_city: null,
            parent_cap: null,
            parent_phone: null,
            parent_email: null,
          }),
    };

    const { data: member, error } = await supabase
      .from('members')
      .insert(insert as any)
      .select('id')
      .single();

    if (error) {
      console.error('Errore inserimento socio:', error);
      // Codice fiscale duplicato
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Esiste gia un socio con questo codice fiscale' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: member.id });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e.message ?? 'Errore inatteso' },
      { status: 500 }
    );
  }
}
