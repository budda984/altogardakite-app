import type { Metadata } from 'next';
import './globals.css';
import { Sidebar, MobileNav } from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Alto Garda Kite — Gestionale',
  description: 'Sistema gestionale Circolo Altogarda Kite ASD',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 pb-20 lg:pb-0">
            {children}
          </main>
        </div>
        <MobileNav />
      </body>
    </html>
  );
}
