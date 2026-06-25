import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: alerts } = await supabase
      .from('dashboard_alerts')
      .select('*')
      .single();

    // Lista dei prossimi soci con tessera in scadenza (max 10)
    const today = new Date().toISOString().slice(0, 10);
    const in30days = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const [expMembershipsRes, expMedicalsRes] = await Promise.all([
      supabase
        .from('members')
        .select('id, first_name, last_name, expires_at, member_type')
        .eq('active', true)
        .gte('expires_at', today)
        .lte('expires_at', in30days)
        .order('expires_at')
        .limit(10),
      supabase
        .from('members')
        .select('id, first_name, last_name, medical_cert_expires_at')
        .eq('active', true)
        .eq('medical_cert_received', true)
        .gte('medical_cert_expires_at', today)
        .lte('medical_cert_expires_at', in30days)
        .order('medical_cert_expires_at')
        .limit(10),
    ]);

    return NextResponse.json({
      alerts: alerts || {
        memberships_expiring_soon: 0,
        memberships_expired: 0,
        medical_certs_expiring_soon: 0,
        medical_certs_expired: 0,
        members_missing_medical: 0,
      },
      expiring_memberships: expMembershipsRes.data || [],
      expiring_medicals: expMedicalsRes.data || [],
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
