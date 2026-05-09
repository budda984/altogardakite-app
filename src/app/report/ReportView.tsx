'use client';

import { useState } from 'react';
import { FileText, Loader2, Download, Calendar, User, Anchor, Users, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import {
  generateSeasonReport,
  generateMemberReport,
  generateBoatReport,
  generateInstructorReport,
  generateDayReport,
} from './pdfGenerators';

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  membership_number: number;
}
interface Boat {
  id: string;
  name: string;
  boat_type: string;
}
interface Instructor {
  id: string;
  first_name: string;
  last_name: string;
}

interface Props {
  boats: Boat[];
  instructors: Instructor[];
  members: Member[];
}

type ReportType = 'season' | 'member' | 'boat' | 'instructor' | 'day';

const REPORT_OPTIONS: { type: ReportType; label: string; description: string; icon: typeof BarChart3 }[] = [
  {
    type: 'season',
    label: 'Riassunto periodo',
    description: 'Cash flow, statistiche uscite, ripartizione per disciplina e barca',
    icon: BarChart3,
  },
  {
    type: 'member',
    label: 'Report singolo socio',
    description: 'Storia uscite, pacchetti, abbonamenti, pagamenti',
    icon: User,
  },
  {
    type: 'boat',
    label: 'Report per barca',
    description: 'Uscite, ore di utilizzo, partecipanti, ricavi generati',
    icon: Anchor,
  },
  {
    type: 'instructor',
    label: 'Report per istruttore',
    description: 'Sessioni gestite, ore di lavoro, partecipanti seguiti',
    icon: Users,
  },
  {
    type: 'day',
    label: 'Report giornaliero',
    description: 'Riepilogo di tutte le sessioni di una singola giornata',
    icon: Calendar,
  },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function startOfYear() {
  return `${new Date().getFullYear()}-01-01`;
}

export default function ReportView({ boats, instructors, members }: Props) {
  const [type, setType] = useState<ReportType>('season');
  const [from, setFrom] = useState(startOfYear());
  const [to, setTo] = useState(todayIso());
  const [selectedId, setSelectedId] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsId = type === 'member' || type === 'boat' || type === 'instructor';
  const isDay = type === 'day';

  const filteredMembers = memberSearch.trim()
    ? members.filter((m) =>
        `${m.first_name} ${m.last_name}`.toLowerCase().includes(memberSearch.toLowerCase()) ||
        String(m.membership_number).includes(memberSearch)
      ).slice(0, 30)
    : members.slice(0, 30);

  const handleGenerate = async () => {
    setError(null);
    if (needsId && !selectedId) {
      setError('Seleziona un elemento');
      return;
    }
    setGenerating(true);
    try {
      // Per "day": from = to = la data scelta (usiamo `from`)
      const params = new URLSearchParams({
        type,
        from: isDay ? from : from,
        to: isDay ? from : to,
      });
      if (needsId) params.set('id', selectedId);

      const res = await fetch(`/api/report?${params}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Errore caricamento dati');
      }
      const data = await res.json();

      // Genera PDF lato client
      if (type === 'season') generateSeasonReport(data);
      else if (type === 'member') generateMemberReport(data);
      else if (type === 'boat') generateBoatReport(data);
      else if (type === 'instructor') generateInstructorReport(data);
      else if (type === 'day') generateDayReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-5xl pb-24 lg:pb-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-3">
          <FileText className="h-7 w-7 text-accent" />
          Report PDF
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Esporta i dati di gestione in formato PDF stampabile
        </p>
      </div>

      {/* Selezione tipo report */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {REPORT_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const selected = type === opt.type;
          return (
            <button
              key={opt.type}
              onClick={() => { setType(opt.type); setSelectedId(''); }}
              className={cn(
                'p-4 rounded-lg border text-left transition-colors',
                selected
                  ? 'bg-accent/10 border-accent'
                  : 'bg-bg-surface border-border hover:border-text-muted'
              )}
            >
              <Icon className={cn('h-5 w-5 mb-2', selected ? 'text-accent' : 'text-text-muted')} />
              <div className={cn('font-medium', selected ? 'text-accent' : 'text-text')}>
                {opt.label}
              </div>
              <div className="text-xs text-text-muted mt-1">{opt.description}</div>
            </button>
          );
        })}
      </div>

      {/* Periodo */}
      <div className="bg-bg-surface border border-border rounded-lg p-5 mb-6">
        <h2 className="text-sm font-medium text-text mb-3">
          {isDay ? 'Giorno' : 'Periodo'}
        </h2>
        <div className={cn('grid gap-4', isDay ? 'grid-cols-1' : 'grid-cols-2')}>
          <Input
            label={isDay ? 'Data' : 'Da'}
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          {!isDay && (
            <Input
              label="A"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          )}
        </div>
        {!isDay && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            <button
              type="button"
              onClick={() => { setFrom(startOfYear()); setTo(todayIso()); }}
              className="text-xs px-2 py-1 rounded bg-bg-elevated border border-border hover:border-accent text-text-muted"
            >
              Da inizio anno
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                setFrom(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
                setTo(todayIso());
              }}
              className="text-xs px-2 py-1 rounded bg-bg-elevated border border-border hover:border-accent text-text-muted"
            >
              Mese corrente
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                d.setMonth(d.getMonth() - 1);
                setFrom(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
                const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
                setTo(last.toISOString().slice(0, 10));
              }}
              className="text-xs px-2 py-1 rounded bg-bg-elevated border border-border hover:border-accent text-text-muted"
            >
              Mese scorso
            </button>
          </div>
        )}
      </div>

      {/* Selezione entita (se necessario) */}
      {needsId && (
        <div className="bg-bg-surface border border-border rounded-lg p-5 mb-6">
          <h2 className="text-sm font-medium text-text mb-3">
            {type === 'member' && 'Seleziona socio'}
            {type === 'boat' && 'Seleziona imbarcazione'}
            {type === 'instructor' && 'Seleziona istruttore'}
          </h2>

          {type === 'member' && (
            <>
              <Input
                placeholder="Cerca per cognome, nome o numero tessera..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="mb-3"
              />
              <div className="max-h-72 overflow-y-auto bg-bg-elevated border border-border rounded divide-y divide-border">
                {filteredMembers.length === 0 ? (
                  <p className="p-3 text-sm text-text-muted text-center">Nessun socio trovato.</p>
                ) : (
                  filteredMembers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedId(m.id)}
                      className={cn(
                        'w-full p-2.5 text-left text-sm flex items-center justify-between',
                        selectedId === m.id ? 'bg-accent/10 text-accent' : 'hover:bg-bg-surface text-text'
                      )}
                    >
                      <span>{m.last_name} {m.first_name}</span>
                      <span className="text-xs text-text-dim">#{m.membership_number}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          {type === 'boat' && (
            <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              <option value="">— Seleziona —</option>
              {boats.map((b) => (
                <option key={b.id} value={b.id}>{b.name} ({b.boat_type})</option>
              ))}
            </Select>
          )}

          {type === 'instructor' && (
            <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              <option value="">— Seleziona —</option>
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>{i.last_name} {i.first_name}</option>
              ))}
            </Select>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-400 mb-6">
          {error}
        </div>
      )}

      <Button
        onClick={handleGenerate}
        disabled={generating || (needsId && !selectedId)}
        size="lg"
        className="w-full"
      >
        {generating ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Download className="h-5 w-5 mr-2" />}
        Genera e scarica PDF
      </Button>
    </div>
  );
}
