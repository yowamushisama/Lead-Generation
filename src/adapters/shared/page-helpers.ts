import type { Page } from 'playwright';

export interface ScrollOptions {
  /** CSS selector of the scrollable container. If omitted, scrolls the window. */
  container?: string;
  /** Pixels per scroll step. Default: 600 */
  stepPx?: number;
  /** Number of scroll steps. Default: 5 */
  steps?: number;
  /** Min ms to wait between steps. Default: 600 */
  minDelayMs?: number;
  /** Max ms to wait between steps. Default: 1200 */
  maxDelayMs?: number;
}

/**
 * Scroll a page or element in steps with human-like random delays.
 * Returns the number of steps actually executed.
 */
export async function scrollPage(page: Page, opts: ScrollOptions = {}): Promise<number> {
  const {
    container,
    stepPx = 600,
    steps = 5,
    minDelayMs = 600,
    maxDelayMs = 1200,
  } = opts;

  for (let i = 0; i < steps; i++) {
    if (container) {
      await (page as any).evaluate(
        ({ sel, px }: { sel: string; px: number }) => {
          const el = document.querySelector(sel);
          if (el) el.scrollTop += px;
        },
        { sel: container, px: stepPx },
      );
    } else {
      await (page as any).evaluate((px: number) => window.scrollBy(0, px), stepPx);
    }
    await page.waitForTimeout(randomDelayMs(minDelayMs, maxDelayMs));
  }

  return steps;
}

export function randomDelayMs(min = 500, max = 2000): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
