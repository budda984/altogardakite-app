'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sun, Moon } from 'lucide-react';

/**
 * Pulsante tema flottante, visibile solo su mobile (su desktop il toggle
 * e' nella sidebar). Posizionato in alto a destra, discreto.
 */
export default function MobileThemeToggle() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('agk-theme');
      setTheme(saved === 'light' ? 'light' : 'dark');
    } catch { /* ignore */ }
  }, []);

  if (pathname.startsWith('/login') || pathname.startsWith('/registrati') || pathname.startsWith('/attesa')) {
    return null;
  }

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem('agk-theme', next); } catch { /* ignore */ }
    document.documentElement.classList.toggle('light', next === 'light');
  }

  if (!mounted) return null;

  return (
    <button
      onClick={toggle}
      className="lg:hidden fixed top-3 right-3 z-50 h-9 w-9 rounded-full bg-bg-surface border border-border flex items-center justify-center text-text-muted shadow-sm"
      aria-label="Cambia tema"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
