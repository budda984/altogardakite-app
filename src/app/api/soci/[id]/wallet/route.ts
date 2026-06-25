import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: memberId } = await params;
    const supabase = await createClient();

    const [balancesRes, packagesRes, movementsRes, subsRes] = await Promise.all([
      supabase.from('member_lift_balances').select('*').eq('member_id', memberId),
      supabase.from('packages').select('*').eq('member_id', memberId).order('created_at', { ascending: false }),
      supabase.from('movements').select('id, movement_date, movement_type, description, lift_delta, lift_discipline')
        .eq('member_id', memberId)
        .eq('is_reversed', false)
        .order('movement_date', { ascending: false }).limit(20),
      supabase.from('member_active_subscriptions').select('*').eq('member_id', memberId),
    ]);

    // Filtra pacchetti attivi (non esauriti, escluse subscriptions)
    const activePackages = (packagesRes.data || [])
      .filter((p) => !p.is_subscription && !p.is_exhausted)
      .map((p) => ({
        ...p,
        lifts_remaining: p.lifts_total - p.lifts_used,
      }));

    return NextResponse.json({
      lift_balances: balancesRes.data || [],
      active_packages: activePackages,
      recent_movements: movementsRes.data || [],
      active_subscriptions: subsRes.data || [],
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
