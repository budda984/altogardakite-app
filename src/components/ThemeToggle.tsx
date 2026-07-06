'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('agk-theme');
      setTheme(saved === 'light' ? 'light' : 'dark');
    } catch { /* ignore */ }
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('agk-theme', next);
    } catch { /* ignore */ }
    if (next === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }

  // Evita mismatch server/client
  if (!mounted) {
    return (
      <button
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-text-muted"
        aria-label="Cambia tema"
      >
        <Moon className="h-4 w-4" />
        {!collapsed && <span className="text-sm">Tema</span>}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className={cn(
        'flex items-center gap-2 w-full px-3 py-2 rounded-lg transition-colors',
        'text-text-muted hover:text-text hover:bg-bg-elevated'
      )}
      aria-label={theme === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
      title={theme === 'dark' ? 'Tema chiaro' : 'Tema scuro'}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {!collapsed && (
        <span className="text-sm">{theme === 'dark' ? 'Tema chiaro' : 'Tema scuro'}</span>
      )}
    </button>
  );
}
