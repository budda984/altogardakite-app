import type { Metadata } from 'next';
import './globals.css';
import { Sidebar, MobileNav } from '@/components/Sidebar';
import MobileThemeToggle from '@/components/MobileThemeToggle';
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
  let richiesteCount = 0;

  if (auth?.isAdmin) {
    const supabase = await createClient();
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'pending')
      .eq('suspended', false);
    pendingCount = count || 0;
  }

  if (auth?.isStaff) {
    const supabase = await createClient();
    // head+count: ci serve il numero, non le righe.
    // Se la vista non c'e' ancora (migration 0028 non applicata) count resta
    // null e il badge sparisce: il gestionale non deve rompersi per questo.
    const { count } = await supabase
      .from('bookings_da_rispondere')
      .select('*', { count: 'exact', head: true });
    richiesteCount = count || 0;
  }

  return (
    <html lang="it">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('agk-theme');if(t==='light'){document.documentElement.classList.add('light');}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <div className="flex min-h-screen">
          <Sidebar
            isAdmin={auth?.isAdmin || false}
            pendingCount={pendingCount}
            richiesteCount={richiesteCount}
          />
          <main className="flex-1 pb-20 lg:pb-0">
            {children}
          </main>
        </div>
        <MobileNav />
        <MobileThemeToggle />
      </body>
    </html>
  );
}
