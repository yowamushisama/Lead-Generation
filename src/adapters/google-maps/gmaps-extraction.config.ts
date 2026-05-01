export const RELATIVE_DATE_MS: Record<string, number> = {
  'a minute ago': 60_000,
  'an hour ago': 3_600_000,
  'a day ago': 86_400_000,
  'a week ago': 7 * 86_400_000,
  'a month ago': 30 * 86_400_000,
  'a year ago': 365 * 86_400_000,
};

export function parseRelativeDate(text: string): string | null {
  const t = text.trim().toLowerCase();

  for (const [key, ms] of Object.entries(RELATIVE_DATE_MS)) {
    if (t === key) return new Date(Date.now() - ms).toISOString();
  }

  const match = t.match(/^(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago$/);
  if (match) {
    const n = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      minute: 60_000,
      hour: 3_600_000,
      day: 86_400_000,
      week: 7 * 86_400_000,
      month: 30 * 86_400_000,
      year: 365 * 86_400_000,
    };
    const ms = multipliers[unit];
    if (ms) return new Date(Date.now() - n * ms).toISOString();
  }

  return null;
}
