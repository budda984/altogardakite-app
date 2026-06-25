import type { Metadata } from 'next';
import './globals.css';
import { Sidebar, MobileNav } from '@/components/Sidebar';
import { getAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Alto Garda Kite — Gestionale',
  description: 'Sistema gestionale Circolo Altogarda Kite ASD',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getAuth();
  let pendingCount = 0;

  if (auth?.isAdmin) {
    const supabase = await createClient();
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'pending')
      .eq('suspended', false);
    pendingCount = count || 0;
  }

  return (
    <html lang="it">
      <body>
        <div className="flex min-h-screen">
          <Sidebar isAdmin={auth?.isAdmin || false} pendingCount={pendingCount} />
          <main className="flex-1 pb-20 lg:pb-0">
            {children}
          </main>
        </div>
        <MobileNav />
      </body>
    </html>
  );
}
