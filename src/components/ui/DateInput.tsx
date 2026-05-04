'use client';

import { useState, useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DateInputProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  value: string; // ISO yyyy-mm-dd or empty - controlled
  onChange: (isoDate: string) => void;
  onBlur?: () => void;
  className?: string;
}

/** Trasforma "01052026" in "01/05/2026" inserendo automaticamente le slash */
function autoFormat(raw: string): string {
  // Strip tutto tranne digit, slash, dash, punto
  const cleaned = raw.replace(/[^\d\/\-.]/g, '');
  // Estrai solo le cifre
  const digits = cleaned.replace(/\D/g, '');

  if (digits.length === 0) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  // Massimo 8 digit
  const truncated = digits.slice(0, 8);
  return `${truncated.slice(0, 2)}/${truncated.slice(2, 4)}/${truncated.slice(4)}`;
}

/** Parsa "gg/mm/aaaa" → ISO "yyyy-mm-dd". Richiede formato COMPLETO. */
function parseItalianDate(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (!match) return '';
  const [, dd, mm, yyyyRaw] = match;
  const yyyy = parseInt(yyyyRaw, 10);
  const day = parseInt(dd, 10);
  const month = parseInt(mm, 10);
  if (day < 1 || day > 31 || month < 1 || month > 12) return '';
  if (yyyy < 1900 || yyyy > 2100) return '';
  const iso = `${yyyy.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  const d = new Date(iso + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return '';
  if (d.getDate() !== day || d.getMonth() + 1 !== month || d.getFullYear() !== yyyy) return '';
  return iso;
}

function formatIso(iso: string): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function DateInput({
  label, error, hint, required, value, onChange, onBlur, className,
}: DateInputProps) {
  const [text, setText] = useState(formatIso(value));
  const pickerRef = useRef<HTMLInputElement>(null);

  // Sincronizza testo con il valore esterno (es. dopo reset form)
  useEffect(() => {
    setText(formatIso(value));
  }, [value]);

  const handleTextChange = (newText: string) => {
    const formatted = autoFormat(newText);
    setText(formatted);
    // Parsa SOLO se la stringa e completa (10 caratteri "gg/mm/aaaa")
    if (formatted.length === 10) {
      const iso = parseItalianDate(formatted);
      onChange(iso);
    } else {
      // Mentre digita: nessun valore valido ancora
      onChange('');
    }
  };

  const handleTextBlur = () => {
    // Al blur, prova a parsare. Se l'input e parziale (es. "5/3" senza anno),
    // applica defaults sensati: anno corrente.
    const trimmed = text.trim();
    if (trimmed && trimmed.length < 10) {
      const partial = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})$/);
      if (partial) {
        const currentYear = new Date().getFullYear();
        const completed = `${partial[1].padStart(2, '0')}/${partial[2].padStart(2, '0')}/${currentYear}`;
        const iso = parseItalianDate(completed);
        if (iso) {
          setText(completed);
          onChange(iso);
        }
      }
    } else if (trimmed.length === 10) {
      const iso = parseItalianDate(trimmed);
      if (iso) setText(formatIso(iso)); // re-formatta canonicamente
    }
    onBlur?.();
  };

  const handlePickerChange = (newIso: string) => {
    setText(formatIso(newIso));
    onChange(newIso);
  };

  const openPicker = () => {
    if (pickerRef.current) {
      const el = pickerRef.current as HTMLInputElement & { showPicker?: () => void };
      if (typeof el.showPicker === 'function') {
        el.showPicker();
      } else {
        el.click();
      }
    }
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label className="text-sm font-medium text-text">
          {label} {required && <span className="text-accent">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          placeholder="gg/mm/aaaa"
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={handleTextBlur}
          maxLength={10}
          className={cn(
            'w-full rounded-md bg-bg-input border border-border px-3 py-2 pr-10 text-sm',
            'placeholder:text-text-dim text-text font-mono',
            'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent',
            error && 'border-danger focus:border-danger focus:ring-danger'
          )}
        />
        <button
          type="button"
          onClick={openPicker}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-accent"
          tabIndex={-1}
          aria-label="Apri calendario"
        >
          <Calendar className="h-4 w-4" />
        </button>
        <input
          ref={pickerRef}
          type="date"
          value={parseItalianDate(text)}
          onChange={(e) => handlePickerChange(e.target.value)}
          className="absolute opacity-0 pointer-events-none w-0 h-0"
          tabIndex={-1}
          aria-hidden
        />
      </div>
      {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
