/**
 * Helper WhatsApp.
 * - normalizePhone: normalizza in formato internazionale senza '+' (E.164)
 * - buildWhatsappLink: costruisce un link wa.me con testo precompilato
 */

export function normalizePhone(raw: string | null | undefined, defaultCountry = '39'): string | null {
  if (!raw) return null;
  let s = raw.trim().replace(/[^\d+]/g, '');
  if (!s) return null;

  if (s.startsWith('+')) {
    s = s.slice(1);
  } else if (s.startsWith('00')) {
    s = s.slice(2);
  } else if (s.startsWith('3') && s.length >= 9 && s.length <= 11) {
    // Cellulare italiano senza prefisso (es. 347...)
    s = defaultCountry + s;
  } else if (s.startsWith('0')) {
    // Fisso italiano: anteponi prefisso paese mantenendo lo 0
    s = defaultCountry + s;
  } else {
    s = defaultCountry + s;
  }

  if (s.length < 10 || s.length > 15) return null;
  return s;
}

export function buildWhatsappLink(phone: string | null | undefined, text: string): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}
