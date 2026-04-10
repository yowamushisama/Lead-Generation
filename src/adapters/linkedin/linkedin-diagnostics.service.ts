import { Injectable } from '@nestjs/common';
import type { Page } from 'playwright';
import { AppLogger } from '../../common/utils/logger.util';
import { LINKEDIN_SELECTORS } from './linkedin-selectors.config';

interface DiagnosticsContext {
  organizationId?: string;
  keyword?: string;
  email?: string;
  phase: string;
}

/** Audit result for a single selector group */
export interface SelectorGroupAudit {
  active: string | null;   // first selector that returned ≥1 element
  counts: Record<string, number>;
}

/** Full DOM audit result — returned from logSearchDiagnostics and the dump script */
export interface DomAuditResult {
  url: string;
  selectorVersion: number;
  postContainers: SelectorGroupAudit;
  authorName: SelectorGroupAudit;
  authorLink: SelectorGroupAudit;
  content: SelectorGroupAudit;
  headline: SelectorGroupAudit;
  postedAt: SelectorGroupAudit;
  totalCards: number;
  firstCardLinks: string[];
  firstCardHtml: string | null;
}

@Injectable()
export class LinkedInDiagnosticsService {
  private readonly logger = new AppLogger(LinkedInDiagnosticsService.name);

  async logPageState(page: Page, context: DiagnosticsContext): Promise<void> {
    const currentUrl = this.safeUrl(page);
    const title = await page.title().catch(() => '<unavailable>');

    this.logger.debug({
      message: 'LinkedIn page state',
      module: 'linkedin',
      ...context,
      url: currentUrl,
      title,
      isLoginPage: currentUrl.includes('/login'),
      isAuthwall: currentUrl.includes('/authwall'),
      isCheckpoint: currentUrl.includes('/checkpoint'),
      isChallenge: currentUrl.includes('/challenge'),
      isCaptcha: currentUrl.includes('/captcha'),
    });
  }

  /**
   * Runs a full selector audit against the live page DOM and logs the results.
   * Also returns the structured audit data so the dump script can consume it.
   */
  async logSearchDiagnostics(
    page: Page,
    context: DiagnosticsContext,
  ): Promise<DomAuditResult | null> {
    const sel = LINKEDIN_SELECTORS;

    const audit = await page
      .evaluate(
        (s) => {
          function auditGroup(selectors: string[]): { active: string | null; counts: Record<string, number> } {
            const counts: Record<string, number> = {};
            let active: string | null = null;
            for (const css of selectors) {
              try {
                const n = document.querySelectorAll(css).length;
                counts[css] = n;
                if (n > 0 && active === null) active = css;
              } catch {
                counts[css] = -1; // invalid selector
              }
            }
            return { active, counts };
          }

          // Count cards from the winning container selector
          let totalCards = 0;
          for (const css of s.postContainers) {
            try {
              const n = document.querySelectorAll(css).length;
              if (n > 0) { totalCards = n; break; }
            } catch { /* skip */ }
          }

          // First card for HTML inspection
          const firstCard =
            document.querySelector('[data-urn*="activity"]') ??
            document.querySelector('.occludable-update') ??
            document.querySelector('[data-urn]');

          const firstCardHtml = firstCard ? firstCard.outerHTML.slice(0, 4000) : null;

          const firstCardLinks: string[] = [];
          if (firstCard) {
            firstCard.querySelectorAll('a[href]').forEach((a) => {
              const href = a.getAttribute('href') ?? '';
              if (href && !firstCardLinks.includes(href.slice(0, 100))) {
                firstCardLinks.push(href.slice(0, 100));
              }
            });
          }

          return {
            url: window.location.href,
            selectorVersion: s.version,
            postContainers: auditGroup(s.postContainers),
            authorName: auditGroup(s.authorName),
            authorLink: auditGroup(s.authorLink),
            content: auditGroup(s.content),
            headline: auditGroup(s.headline),
            postedAt: auditGroup(s.postedAt),
            totalCards,
            firstCardLinks,
            firstCardHtml,
          } as {
            url: string;
            selectorVersion: number;
            postContainers: { active: string | null; counts: Record<string, number> };
            authorName: { active: string | null; counts: Record<string, number> };
            authorLink: { active: string | null; counts: Record<string, number> };
            content: { active: string | null; counts: Record<string, number> };
            headline: { active: string | null; counts: Record<string, number> };
            postedAt: { active: string | null; counts: Record<string, number> };
            totalCards: number;
            firstCardLinks: string[];
            firstCardHtml: string | null;
          };
        },
        sel,
      )
      .catch(() => null);

    if (!audit) {
      this.logger.debug({ message: 'LinkedIn search diagnostics failed', module: 'linkedin', ...context });
      return null;
    }

    this.logger.debug({
      message: 'LinkedIn search diagnostics',
      module: 'linkedin',
      ...context,
      url: audit.url,
      selectorVersion: audit.selectorVersion,
      totalCards: audit.totalCards,
      activePostContainer: audit.postContainers.active,
      activeAuthorName: audit.authorName.active,
      activeContent: audit.content.active,
      firstCardLinks: audit.firstCardLinks,
    });

    if (audit.firstCardHtml) {
      this.logger.debug({
        message: 'LinkedIn first card HTML snapshot',
        module: 'linkedin',
        phase: context.phase,
        keyword: context.keyword,
        htmlSnippet: audit.firstCardHtml,
      });
    }

    return audit as DomAuditResult;
  }

  logCredentialShape(_email: string, password: string): void {
    this.logger.debug({
      message: 'LinkedIn credential shape',
      module: 'linkedin',
      phase: 'login',
      passwordLength: password.length,
    });
  }

  private safeUrl(page: Page): string {
    try {
      return page.url();
    } catch {
      return '<unavailable>';
    }
  }
}
