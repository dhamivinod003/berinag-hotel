/**
 * Strip HTML tags and event-handler attributes from user-supplied text.
 * Leaves letters, numbers, spaces, and normal punctuation intact.
 */
export function sanitizeInput(value: string): string {
  let s = value;
  s = s.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  s = s.replace(/javascript\s*:/gi, "");
  s = s.replace(/<\s*\/?\s*[a-zA-Z][^>]*>/g, "");
  s = s.replace(/[<>]/g, "");
  return s.trim();
}

export function sanitizeOptional(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return sanitizeInput(value);
}
