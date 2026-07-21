import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

// Solo il numero di richieste da rispondere. Serve alla sidebar per
// aggiornare il badge senza ricaricare la pagina.
export async function GET() {
  const auth = await getAuth();
  if (!auth || !auth.isStaff) {
    return NextResponse.json({ count: 0 });
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from('bookings_da_rispondere')
    .select('*', { count: 'exact', head: true });

  return NextResponse.json({ count: count || 0 });
}
