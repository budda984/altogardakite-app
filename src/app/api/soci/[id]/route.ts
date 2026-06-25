import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';
import { memberEditSchema } from '@/lib/validation/admin-schemas';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: memberId } = await params;
    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = memberEditSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const data = parsed.data;

    const { data: updated, error } = await supabase
      .from('members')
      .update({
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        email: data.email ? data.email.toLowerCase().trim() : null,
        phone: data.phone || null,
        address_street: data.address || null,
        fiscal_code: data.fiscal_code
          ? data.fiscal_code.toUpperCase().trim()
          : null,
        notes: data.notes || null,
        medical_cert_received: data.medical_cert_received,
        medical_cert_expires_at: data.medical_cert_expires_at || null,
      })
      .eq('id', memberId)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Codice fiscale gia presente per un altro socio' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
