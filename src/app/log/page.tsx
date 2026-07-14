import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import LogView from './LogView';

export default async function LogPage() {
  const auth = await getAuth();
  if (!auth?.isStaff) redirect('/');

  return <LogView />;
}
