import { createClient } from '@/lib/supabase/server';
import ReportView from './ReportView';

export const dynamic = 'force-dynamic';

export default async function ReportPage() {
  const supabase = await createClient();

  const [boatsRes, instructorsRes, membersRes] = await Promise.all([
    supabase.from('boats').select('id, name, boat_type').order('name'),
    supabase.from('instructors').select('id, first_name, last_name').eq('active', true).order('last_name'),
    supabase.from('members')
      .select('id, first_name, last_name, membership_number')
      .order('last_name'),
  ]);

  return (
    <ReportView
      boats={boatsRes.data || []}
      instructors={instructorsRes.data || []}
      members={membersRes.data || []}
    />
  );
}
