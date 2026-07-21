// Helpers for turning streamed markdown into natural spoken text.

const synthAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;

/**
 * Speak a block of (markdown) text aloud once, cleaning markdown first. Used by
 * the "read aloud" button on assistant messages in typed mode. Calling again
 * cancels the previous utterance (toggle-off is handled by the caller).
 */
export function speakText(text: string): void {
  if (!synthAvailable) return;
  try {
    window.speechSynthesis.cancel();
    const clean = cleanForSpeech(text.replace(/```[\s\S]*?```/g, ' (code block) '));
    if (!clean) return;
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export function stopSpeaking(): void {
  if (synthAvailable) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Strip markdown so text-to-speech reads clean prose instead of literally
 * voicing "asterisk asterisk", "hash", backticks, list bullets, etc.
 */
export function cleanForSpeech(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, ' ') // drop fenced code blocks entirely
    .replace(/`([^`]+)`/g, '$1') // inline code -> its text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images -> nothing
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links -> label
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
    .replace(/\*([^*]+)\*/g, '$1') // italic
    .replace(/__([^_]+)__/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // headings
    .replace(/^\s*[-*+]\s+/gm, '') // bullet markers
    .replace(/^\s*\d+\.\s+/gm, '') // numbered list markers
    .replace(/^\s*>\s?/gm, '') // blockquotes
    .replace(/[*_~>#`]/g, '') // any stray markdown punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Incrementally pull complete, speakable sentences out of a growing buffer.
 * Returns the cleaned sentences ready to speak and the leftover text still
 * accumulating. Call with `flush: true` at end-of-turn to emit the remainder.
 */
export function drainSentences(
  buffer: string,
  flush = false,
): { sentences: string[]; rest: string } {
  const sentences: string[] = [];
  let rest = buffer;

  // A sentence ends at a newline (always), or at . ! ? … that is followed by
  // whitespace/end — so decimals like "3.14" don't split mid-number.
  const boundary = /^[\s\S]*?(?:[.!?…]["')\]]?(?=\s|$)|\n)/;
  while (true) {
    // Peel any leading list marker ("1. ", "- ") so the number's period isn't
    // mistaken for a sentence end. Requires trailing space, so decimals are safe.
    rest = rest.replace(/^\s*(?:\d{1,3}\.|[-*+])\s+/, '');
    const match = rest.match(boundary);
    if (!match) break;
    const raw = match[0];
    rest = rest.slice(raw.length);
    const clean = cleanForSpeech(raw);
    // Skip fragments that are only punctuation/numbers (e.g. a lone "1.").
    if (clean.length > 1 && /[a-zA-Z]/.test(clean)) {
      sentences.push(clean);
    } else if (clean) {
      rest = `${raw.replace(/[.!?…\n]["')\]]?\s*$/, '')} ${rest}`;
      break;
    }
  }

  if (flush) {
    const clean = cleanForSpeech(rest);
    if (clean.length > 1 && /[a-zA-Z]/.test(clean)) sentences.push(clean);
    rest = '';
  }

  return { sentences, rest };
}
