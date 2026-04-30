'use client';

import { useState } from 'react';
import { Settings, Copy, Check, ExternalLink, Info } from 'lucide-react';
import {
  COURSE_LABELS, RENTAL_LABELS, EQUIPMENT_LABELS,
  INSTRUCTOR_ROLE_LABELS, BOAT_LABELS, WIND_SESSION_LABELS,
  PARTICIPATION_LABELS,
} from '@/lib/types';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

interface EnumGroup {
  key: string;
  enumName: string;
  title: string;
  description: string;
  values: Record<string, string>;
}

const ENUMS: EnumGroup[] = [
  {
    key: 'course_type',
    enumName: 'course_type',
    title: 'Tipologie corsi',
    description: 'Tipi di corso disponibili (base, avanzato, wing foil...)',
    values: COURSE_LABELS,
  },
  {
    key: 'rental_type',
    enumName: 'rental_type',
    title: 'Tipologie noleggio',
    description: 'Modalita di noleggio attrezzatura nelle uscite',
    values: RENTAL_LABELS,
  },
  {
    key: 'participation_type',
    enumName: 'participation_type',
    title: 'Tipologie lift',
    description: 'Modalita di partecipazione alle uscite (corso, lift supervisionato, lift semplice)',
    values: PARTICIPATION_LABELS,
  },
  {
    key: 'equipment_type',
    enumName: 'equipment_type',
    title: 'Tipologie attrezzatura',
    description: 'Categorie di attrezzatura nellinventario',
    values: EQUIPMENT_LABELS,
  },
  {
    key: 'instructor_role',
    enumName: 'instructor_role',
    title: 'Ruoli istruttori',
    description: 'Ruoli del personale (istruttore, assistente, direttore)',
    values: INSTRUCTOR_ROLE_LABELS,
  },
  {
    key: 'boat_type',
    enumName: 'boat_type',
    title: 'Tipologie imbarcazioni',
    description: 'Tipi di imbarcazione utilizzati dalla scuola',
    values: BOAT_LABELS,
  },
  {
    key: 'wind_session',
    enumName: 'wind_session',
    title: 'Sessioni di vento',
    description: 'Tipi di sessione vento sul lago di Garda (Peler, Ora, Ora serale)',
    values: WIND_SESSION_LABELS,
  },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export default function ConfigurazionePage() {
  const [modalEnum, setModalEnum] = useState<EnumGroup | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [copied, setCopied] = useState(false);

  const openAdd = (g: EnumGroup) => {
    setModalEnum(g);
    setNewLabel('');
    setNewSlug('');
    setSlugManuallyEdited(false);
    setCopied(false);
  };

  const handleLabelChange = (v: string) => {
    setNewLabel(v);
    if (!slugManuallyEdited) setNewSlug(slugify(v));
  };

  const handleSlugChange = (v: string) => {
    setNewSlug(slugify(v));
    setSlugManuallyEdited(true);
  };

  const generatedSQL = modalEnum && newSlug
    ? `ALTER TYPE ${modalEnum.enumName} ADD VALUE '${newSlug}';`
    : '';

  const copySQL = async () => {
    if (!generatedSQL) return;
    await navigator.clipboard.writeText(generatedSQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 lg:p-10 max-w-5xl pb-24 lg:pb-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-3">
          <Settings className="h-7 w-7 text-accent" />
          Configurazione
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Tipologie e categorie disponibili nel sistema
        </p>
      </div>

      <div className="mb-8 p-4 rounded-lg border border-blue-500/30 bg-blue-500/5 flex gap-3">
        <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-text-muted">
          <p className="text-text font-medium mb-1">Come funzionano le tipologie</p>
          <p>
            Le tipologie sono memorizzate come <code className="text-accent font-mono text-xs px-1 py-0.5 rounded bg-bg-elevated">ENUM</code> nel database PostgreSQL,
            per garantire integrita dei dati. Per aggiungere un nuovo valore puoi
            usare il generatore qui sotto e poi incollare lo SQL nel
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline ml-1 inline-flex items-center gap-1"
            >
              SQL Editor di Supabase <ExternalLink className="h-3 w-3" />
            </a>.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {ENUMS.map((g) => (
          <div key={g.key} className="bg-bg-surface border border-border rounded-lg overflow-hidden">
            <div className="p-5 border-b border-border flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg font-semibold tracking-tight">{g.title}</h2>
                <p className="text-xs text-text-muted mt-1">{g.description}</p>
                <code className="text-[10px] uppercase tracking-widest text-text-dim font-mono mt-2 inline-block">
                  enum: {g.enumName}
                </code>
              </div>
              <Button size="sm" variant="secondary" onClick={() => openAdd(g)}>
                Aggiungi tipologia
              </Button>
            </div>
            <div className="p-5 flex flex-wrap gap-2">
              {Object.entries(g.values).map(([slug, label]) => (
                <div
                  key={slug}
                  className="px-3 py-1.5 rounded bg-bg-elevated border border-border text-sm flex items-center gap-2"
                >
                  <span className="text-text">{label}</span>
                  <code className="text-[10px] text-text-dim font-mono">{slug}</code>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={modalEnum !== null}
        onClose={() => setModalEnum(null)}
        title={`Aggiungi: ${modalEnum?.title || ''}`}
        description="Compila i campi e copia lo SQL generato. Poi incollalo nel SQL Editor di Supabase ed eseguilo."
        size="lg"
      >
        {modalEnum && (
          <div className="space-y-5">
            <Input
              label="Etichetta visualizzata *"
              placeholder="es. Wing Foil Avanzato"
              value={newLabel}
              onChange={(e) => handleLabelChange(e.target.value)}
            />

            <Input
              label="Identificatore tecnico (slug) *"
              placeholder="es. wing_foil_avanzato"
              value={newSlug}
              onChange={(e) => handleSlugChange(e.target.value)}
              hint="Solo lettere minuscole, numeri e underscore. Generato automaticamente dalletichetta."
            />

            <div>
              <label className="block text-sm font-medium text-text mb-1.5">SQL da eseguire</label>
              <div className="relative">
                <pre className="p-4 pr-12 rounded-md bg-bg-elevated border border-border text-sm font-mono text-accent overflow-x-auto">
                  {generatedSQL || '— compila i campi sopra —'}
                </pre>
                {generatedSQL && (
                  <button
                    onClick={copySQL}
                    className="absolute top-3 right-3 p-2 rounded hover:bg-bg-surface text-text-muted hover:text-text"
                    aria-label="Copia"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>

            <div className="text-xs text-text-muted bg-bg-elevated p-3 rounded border border-border">
              <p className="font-medium text-text mb-1">Come applicare:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Copia lo SQL generato sopra</li>
                <li>Apri il SQL Editor del tuo progetto Supabase</li>
                <li>Incolla, clicca <strong>Run</strong></li>
                <li>
                  Per avere unetichetta personalizzata, modifica
                  {' '}<code className="font-mono text-accent">src/lib/types.ts</code> e
                  aggiungi la voce nel mapping <code className="font-mono text-accent">{modalEnum.enumName.toUpperCase()}_LABELS</code>
                </li>
              </ol>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setModalEnum(null)}>Chiudi</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
