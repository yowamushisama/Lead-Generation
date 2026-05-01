/**
 * Returns the first element matching any selector in the ordered `selectors`
 * list. The first selector that returns a non-null result wins; the rest are
 * skipped. Invalid selectors are caught and skipped silently.
 *
 * Designed to run inside a `page.evaluate()` callback — it references only
 * browser-available APIs (document.querySelector).
 */
export function firstMatch(
  parent: Element | Document,
  selectors: string[],
): Element | null {
  for (const s of selectors) {
    try {
      const el = parent.querySelector(s);
      if (el) return el;
    } catch {
      /* skip invalid selector */
    }
  }
  return null;
}

/**
 * Returns all elements matching the first selector from `selectors` that
 * returns at least one result. Returns an empty array if no selector matches.
 */
export function firstMatchAll(
  parent: Element | Document,
  selectors: string[],
): Element[] {
  for (const s of selectors) {
    try {
      const els = Array.from(parent.querySelectorAll(s));
      if (els.length > 0) return els;
    } catch {
      /* skip invalid selector */
    }
  }
  return [];
}
