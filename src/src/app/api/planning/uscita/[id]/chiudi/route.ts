import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';
import { findRentalService, findSingleLiftService, RENTAL_TYPE_TO_SLUG } from '@/lib/rental-pricing';
import type { Service, LiftDiscipline } from '@/lib/types';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: outingId } = await params;
    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const supabase = await createClient();

    // Carica il listino servizi per costruire le mappe prezzi da passare a SQL
    const { data: services } = await supabase
      .from('services')
      .select('*')
      .eq('is_active', true);

    const svcs = (services as Service[]) || [];

    // Mappa prezzi lift per disciplina
    const liftPrices: Record<string, number> = {};
    const disciplines: LiftDiscipline[] = ['kite', 'wingfoil', 'sit_kite', 'wingfoil_adattato', 'altro'];
    for (const d of disciplines) {
      const liftSvc = findSingleLiftService(d, svcs, false);
      if (liftSvc) liftPrices[d] = Number(liftSvc.unit_price);
    }

    // Mappa prezzi noleggio per rental_type
    const rentalPrices: Record<string, number> = {};
    for (const rt of Object.keys(RENTAL_TYPE_TO_SLUG)) {
      const svc = findRentalService(rt, svcs);
      if (svc) rentalPrices[rt] = Number(svc.unit_price);
    }

    // Prezzo lezione singola
    const lessonSvc = svcs.find((s) => s.slug === 'lezione_singola');
    const lessonPrice = lessonSvc ? Number(lessonSvc.unit_price) : 60;

    // Esegui la function SQL atomica
    const { data: result, error } = await supabase.rpc('close_outing', {
      p_outing_id: outingId,
      p_closed_by: auth.userId,
      p_lift_prices: liftPrices,
      p_rental_prices: rentalPrices,
      p_lesson_price: lessonPrice,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
