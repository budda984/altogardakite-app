'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Users, Sailboat, Package, GraduationCap, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/soci', label: 'Soci', icon: Users },
  { href: '/uscite', label: 'Uscite', icon: Sailboat },
  { href: '/attrezzatura', label: 'Attrezzatura', icon: Package },
  { href: '/corsi', label: 'Corsi', icon: GraduationCap },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-64 flex-col bg-bg-surface border-r border-border h-screen sticky top-0">
      <div className="p-6 border-b border-border">
        <Link href="/" className="block">
          <div className="font-display text-xl font-bold tracking-tightest leading-none">
            ALTO<span className="text-accent">GARDA</span>
          </div>
          <div className="font-display text-xl font-bold tracking-tightest leading-none mt-0.5">
            KITE
          </div>
          <div className="text-[10px] uppercase tracking-widest text-text-dim mt-2">
            Gestionale ASD
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-muted hover:text-text hover:bg-bg-elevated'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-text-muted hover:text-text hover:bg-bg-elevated transition-colors"
        >
          <Settings className="h-4 w-4" />
          Impostazioni
        </Link>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-bg-surface border-t border-border z-50">
      <div className="grid grid-cols-5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 py-3 text-[10px]',
                active ? 'text-accent' : 'text-text-muted'
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
