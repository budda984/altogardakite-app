import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: memberId } = await params;
    const supabase = await createClient();

    const [walletRes, balancesRes, packagesRes, movementsRes, subsRes] = await Promise.all([
      supabase.from('member_wallets').select('*').eq('member_id', memberId).single(),
      supabase.from('member_lift_balances').select('*').eq('member_id', memberId),
      supabase.from('packages').select('*').eq('member_id', memberId).order('created_at', { ascending: false }),
      supabase.from('movements').select('*').eq('member_id', memberId).order('movement_date', { ascending: false }).limit(100),
      supabase.from('member_active_subscriptions').select('*').eq('member_id', memberId),
    ]);

    return NextResponse.json({
      wallet: walletRes.data,
      lift_balances: balancesRes.data || [],
      packages: packagesRes.data || [],
      movements: movementsRes.data || [],
      active_subscriptions: subsRes.data || [],
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
