'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Users, Sailboat, Package, GraduationCap,
  UserCog, Anchor, Settings, Tag, BarChart3, LogOut, Shield, CalendarDays, ScrollText,
  Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ThemeToggle from '@/components/ThemeToggle';

const MAIN_NAV = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/planning', label: 'Planning', icon: CalendarDays },
  { href: '/richieste', label: 'Richieste', icon: Inbox },
  { href: '/soci', label: 'Soci', icon: Users },
  { href: '/uscite', label: 'Uscite', icon: Sailboat },
  { href: '/statistiche', label: 'Statistiche', icon: BarChart3 },
  { href: '/log', label: 'Log', icon: ScrollText },
];

const ADMIN_NAV = [
  { href: '/istruttori', label: 'Istruttori', icon: UserCog },
  { href: '/barche', label: 'Imbarcazioni', icon: Anchor },
  { href: '/attrezzatura', label: 'Attrezzatura', icon: Package },
  { href: '/corsi', label: 'Corsi', icon: GraduationCap },
  { href: '/servizi', label: 'Listino servizi', icon: Tag },
];

const MOBILE_NAV = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/planning', label: 'Planning', icon: CalendarDays },
  { href: '/richieste', label: 'Richieste', icon: Inbox },
  { href: '/soci', label: 'Soci', icon: Users },
  { href: '/uscite', label: 'Uscite', icon: Sailboat },
  { href: '/configurazione', label: 'Admin', icon: Settings },
];

interface SidebarProps {
  isAdmin?: boolean;
  pendingCount?: number;
  richiesteCount?: number;
}

function NavLink({
  href, label, icon: Icon, active, badge,
}: { href: string; label: string; icon: typeof Home; active: boolean; badge?: number }) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
        active
          ? 'bg-accent/10 text-accent'
          : 'text-text-muted hover:text-text hover:bg-bg-elevated'
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">
          {badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({ isAdmin = false, pendingCount = 0, richiesteCount = 0 }: SidebarProps) {
  const pathname = usePathname();
  if (pathname.startsWith('/login') || pathname.startsWith('/registrati') || pathname.startsWith('/attesa')) {
    return null;
  }

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

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

      <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
        <div className="space-y-1">
          {MAIN_NAV.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={isActive(item.href)}
              badge={item.href === '/richieste' ? richiesteCount : undefined}
            />
          ))}
        </div>

        <div>
          <div className="px-3 mb-2 text-[10px] uppercase tracking-widest text-text-dim font-medium">
            Anagrafiche
          </div>
          <div className="space-y-1">
            {ADMIN_NAV.map((item) => (
              <NavLink key={item.href} {...item} active={isActive(item.href)} />
            ))}
          </div>
        </div>

        {isAdmin && (
          <div>
            <div className="px-3 mb-2 text-[10px] uppercase tracking-widest text-text-dim font-medium">
              Amministrazione
            </div>
            <div className="space-y-1">
              <NavLink
                href="/utenti"
                label="Utenti"
                icon={Shield}
                active={isActive('/utenti')}
                badge={pendingCount}
              />
            </div>
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-border space-y-1">
        <NavLink
          href="/configurazione"
          label="Configurazione"
          icon={Settings}
          active={isActive('/configurazione')}
        />
        <ThemeToggle />
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-text-muted hover:text-red-400 hover:bg-bg-elevated transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Esci
          </button>
        </form>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  if (pathname.startsWith('/login') || pathname.startsWith('/registrati') || pathname.startsWith('/attesa')) {
    return null;
  }

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-bg-surface border-t border-border z-40">
      <div className="grid grid-cols-6">
        {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
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
