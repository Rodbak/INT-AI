// Build a wa.me link that opens WhatsApp with a message pre-filled. Formats a
// Ghana number (leading 0 → +233); with no number it opens the contact picker.
export function waLink(phone: string | null | undefined, text: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  const intl = digits.startsWith('233') ? digits : digits.startsWith('0') ? `233${digits.slice(1)}` : digits;
  const base = intl ? `https://wa.me/${intl}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
}

// The shop's name as the owner set it (saved by Home). Falls back gracefully.
export function shopName(): string {
  try { return localStorage.getItem('int-shop') || 'my shop'; } catch { return 'my shop'; }
}
