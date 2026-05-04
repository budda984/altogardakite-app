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

/** Converte una stringa "gg/mm/aaaa" in ISO "yyyy-mm-dd". Torna '' se invalida */
function parseItalianDate(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!match) return '';
  const [, dd, mm, yyyyRaw] = match;
  let yyyy = parseInt(yyyyRaw, 10);
  if (yyyy < 100) yyyy = yyyy < 30 ? 2000 + yyyy : 1900 + yyyy;
  const day = parseInt(dd, 10);
  const month = parseInt(mm, 10);
  if (day < 1 || day > 31 || month < 1 || month > 12) return '';
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
    setText(newText);
    const iso = parseItalianDate(newText);
    onChange(iso);
  };

  const handleTextBlur = () => {
    const iso = parseItalianDate(text);
    if (iso) {
      setText(formatIso(iso));
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
