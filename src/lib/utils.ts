import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, withTime = false) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const opts: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  };
  if (withTime) {
    opts.hour = '2-digit';
    opts.minute = '2-digit';
  }
  return d.toLocaleDateString('it-IT', opts);
}

export function formatTime(time: string | null) {
  if (!time) return '—';
  return time.slice(0, 5); // HH:MM
}

export function calcAge(birthDate: string) {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function isMinor(birthDate: string) {
  return calcAge(birthDate) < 18;
}

export function validateFiscalCode(code: string): boolean {
  // Validazione base codice fiscale italiano (16 caratteri)
  if (!code) return false;
  return /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i.test(code.trim());
}
