'use client';

import { useEffect, useState } from 'react';
import { Calendar, Loader2, Check } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface Season {
  start_month_day: string; // MM-DD
  end_month_day: string;
}

const MONTHS = [
  '01', '02', '03', '04', '05', '06',
  '07', '08', '09', '10', '11', '12',
];

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function parseMd(md: string): { month: string; day: string } {
  const [m, d] = md.split('-');
  return { month: m || '01', day: d || '01' };
}

function formatItalianRange(start: string, end: string): string {
  const monthNames = [
    'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
    'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
  ];
  const s = parseMd(start);
  const e = parseMd(end);
  return `${parseInt(s.day)} ${monthNames[parseInt(s.month) - 1]} – ${parseInt(e.day)} ${monthNames[parseInt(e.month) - 1]}`;
}

export default function SeasonSettingsCard() {
  const [season, setSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savedTick, setSavedTick] = useState(false);

  // form state
  const [startMonth, setStartMonth] = useState('04');
  const [startDay, setStartDay] = useState('01');
  const [endMonth, setEndMonth] = useState('10');
  const [endDay, setEndDay] = useState('31');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/stagione');
      if (res.ok) {
        const data: Season = await res.json();
        setSeason(data);
        const s = parseMd(data.start_month_day);
        const e = parseMd(data.end_month_day);
        setStartMonth(s.month);
        setStartDay(s.day);
        setEndMonth(e.month);
        setEndDay(e.day);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const start_month_day = `${pad(parseInt(startMonth))}-${pad(parseInt(startDay))}`;
      const end_month_day = `${pad(parseInt(endMonth))}-${pad(parseInt(endDay))}`;
      const res = await fetch('/api/settings/stagione', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_month_day, end_month_day }),
      });
      if (res.ok) {
        setSeason({ start_month_day, end_month_day });
        setEditing(false);
        setSavedTick(true);
        setTimeout(() => setSavedTick(false), 2000);
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || 'Errore salvataggio');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-bg-surface border border-border rounded-lg p-5 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight flex items-center gap-2">
            <Calendar className="h-5 w-5 text-accent" />
            Date stagione
          </h2>
          <p className="text-xs text-text-muted mt-1">
            Determina la finestra di validità di default degli abbonamenti stagionali.
            Modificabile solo da amministratori.
          </p>
        </div>
        {!editing && !loading && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Modifica
          </Button>
        )}
      </div>

      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
      ) : !editing ? (
        <div className="flex items-center gap-3">
          <div className="font-display text-xl text-text capitalize">
            {season && formatItalianRange(season.start_month_day, season.end_month_day)}
          </div>
          {savedTick && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <Check className="h-3 w-3" />
              Salvato
            </span>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-text-dim">Inizio stagione</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  className="rounded-md bg-bg-elevated border border-border px-3 py-2 text-sm text-text"
                  style={{ colorScheme: 'dark' }}
                >
                  {MONTHS.map((m) => <option key={m} value={m}>Mese {m}</option>)}
                </select>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={startDay}
                  onChange={(e) => setStartDay(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-text-dim">Fine stagione</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={endMonth}
                  onChange={(e) => setEndMonth(e.target.value)}
                  className="rounded-md bg-bg-elevated border border-border px-3 py-2 text-sm text-text"
                  style={{ colorScheme: 'dark' }}
                >
                  {MONTHS.map((m) => <option key={m} value={m}>Mese {m}</option>)}
                </select>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={endDay}
                  onChange={(e) => setEndDay(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setEditing(false); load(); }}>
              Annulla
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
              Salva
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
