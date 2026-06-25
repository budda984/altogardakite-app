import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';
import OutingDetailView from './OutingDetailView';

export default async function OutingDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await getAuth();

  const { data: outing } = await supabase
    .from('outings')
    .select('*, boat:boats(*)')
    .eq('id', id)
    .single();

  if (!outing) notFound();

  const [
    { data: instructorRows },
    { data: participants },
    { data: allBoats },
    { data: allInstructors },
    { data: allMembers },
  ] = await Promise.all([
    supabase
      .from('outing_instructors')
      .select('instructor_id, role, instructor:instructors(*)')
      .eq('outing_id', id),
    supabase
      .from('outing_participants')
      .select(`
        *,
        member:members(id, first_name, last_name, membership_number, member_type),
        equipment:outing_participant_equipment(equipment(*))
      `)
      .eq('outing_id', id)
      .order('created_at', { ascending: true }),
    supabase.from('boats').select('id, name, capacity, boat_type, is_active').eq('is_active', true).order('name'),
    supabase.from('instructors').select('id, first_name, last_name, role, is_active').eq('is_active', true).order('last_name'),
    supabase
      .from('members')
      .select('id, first_name, last_name, membership_number, member_type, active')
      .eq('active', true)
      .neq('member_type', 'sostenitore')
      .order('first_name'),
  ]);

  return (
    <OutingDetailView
      outing={outing}
      instructorRows={instructorRows || []}
      participants={participants || []}
      allBoats={allBoats || []}
      allInstructors={allInstructors || []}
      allMembers={allMembers || []}
      isAdmin={auth?.role === 'admin'}
    />
  );
}
