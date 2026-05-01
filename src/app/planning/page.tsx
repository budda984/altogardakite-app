import { createClient } from '@/lib/supabase/server';
import PlanningView from './PlanningView';

export const dynamic = 'force-dynamic';

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: queryDate } = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const date = queryDate || today;

  const supabase = await createClient();

  // Pre-load risorse statiche (barche, istruttori, soci, servizi)
  const [boatsRes, instructorsRes, membersRes, servicesRes] = await Promise.all([
    supabase.from('boats').select('*').eq('active', true).order('name'),
    supabase.from('instructors').select('*').eq('active', true).order('last_name'),
    supabase.from('members').select('id,first_name,last_name,membership_number').eq('active', true).order('last_name'),
    supabase.from('services').select('*').eq('is_active', true).order('sort_order'),
  ]);

  return (
    <PlanningView
      initialDate={date}
      boats={boatsRes.data || []}
      instructors={instructorsRes.data || []}
      members={membersRes.data || []}
      services={servicesRes.data || []}
    />
  );
}
