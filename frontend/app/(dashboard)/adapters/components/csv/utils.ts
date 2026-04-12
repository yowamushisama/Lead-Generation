import { ColumnMapping, FIELD_ALIASES } from './constants';

// Parses an entire CSV text into rows, correctly handling quoted fields that
// contain the delimiter, embedded newlines, and escaped double-quotes ("").
export function parseCsv(text: string, dc: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { // escaped quote ""
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch; // embedded newlines included verbatim
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (text.startsWith(dc, i)) {
        row.push(current.trim());
        current = '';
        i += dc.length - 1;
      } else if (ch === '\r' && text[i + 1] === '\n') {
        row.push(current.trim());
        if (row.some((f) => f !== '')) rows.push(row);
        row = [];
        current = '';
        i++;
      } else if (ch === '\n') {
        row.push(current.trim());
        if (row.some((f) => f !== '')) rows.push(row);
        row = [];
        current = '';
      } else {
        current += ch;
      }
    }
  }

  // flush last field / row
  row.push(current.trim());
  if (row.some((f) => f !== '')) rows.push(row);

  return rows;
}

export function autoDetectMapping(headers: string[]): Partial<ColumnMapping> {
  const result: Partial<ColumnMapping> = {};
  for (const header of headers) {
    const lower = header.toLowerCase().replace(/\s+/g, '_');
    for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [keyof ColumnMapping, string[]][]) {
      if (aliases.some((a) => lower.includes(a)) && !result[field]) {
        result[field] = header;
      }
    }
  }
  return result;
}
