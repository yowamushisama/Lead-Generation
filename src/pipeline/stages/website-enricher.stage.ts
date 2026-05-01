import { Injectable, Logger } from '@nestjs/common';
import { WebsiteAudit, EnrichmentStatus, WebsiteEnrichmentOutput } from './website-enricher.types';
import { CTA_PATTERN, TECH_FINGERPRINTS, FETCH_TIMEOUT_MS } from './website-enricher.config';

export { WebsiteAudit, EnrichmentStatus, WebsiteEnrichmentOutput } from './website-enricher.types';

@Injectable()
export class WebsiteEnricherStage {
  private readonly logger = new Logger(WebsiteEnricherStage.name);

  async process(website: string): Promise<WebsiteEnrichmentOutput> {
    const url = this.normalizeUrl(website);
    if (!url) {
      return { websiteAudit: null, socialHandles: {}, enrichmentStatus: 'NO_WEBSITE' };
    }

    const start = Date.now();
    let html: string;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LeadEnricher/1.0)',
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
      });
      clearTimeout(timer);

      if (!res.ok) {
        return { websiteAudit: null, socialHandles: {}, enrichmentStatus: 'UNREACHABLE' };
      }

      html = await res.text();
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      this.logger.warn({
        message: 'Website fetch failed',
        url,
        reason: isTimeout ? 'timeout' : String(err),
      });
      return {
        websiteAudit: null,
        socialHandles: {},
        enrichmentStatus: isTimeout ? 'TIMEOUT' : 'UNREACHABLE',
      };
    }

    const loadMs = Date.now() - start;

    const audit = this.auditHtml(html, loadMs);
    const socialHandles = this.extractSocialHandles(html);

    return { websiteAudit: audit, socialHandles, enrichmentStatus: 'OK' };
  }

  private normalizeUrl(raw: string): string | null {
    if (!raw || raw.trim() === '') return null;
    const trimmed = raw.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return `https://${trimmed}`;
    }
    return trimmed;
  }

  private auditHtml(html: string, loadMs: number): WebsiteAudit {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : null;

    const metaDescMatch =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["'](.*?)["']/i) ??
      html.match(/<meta[^>]+content=["'](.*?)["'][^>]+name=["']description["']/i);
    const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : null;

    const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;

    const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);

    const ctaPresent =
      CTA_PATTERN.test(html) ||
      /href=["']tel:/i.test(html) ||
      /href=["']mailto:/i.test(html);

    const techStack: string[] = [];
    for (const [pattern, label] of TECH_FINGERPRINTS) {
      if (pattern.test(html)) techStack.push(label);
    }
    // Deduplicate
    const uniqueStack = [...new Set(techStack)];

    return { title, metaDescription, h1Count, hasViewport, ctaPresent, techStack: uniqueStack, loadMs };
  }

  private extractSocialHandles(html: string): { instagram?: string; facebook?: string; tiktok?: string } {
    const handles: { instagram?: string; facebook?: string; tiktok?: string } = {};

    const igMatch = html.match(/https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9_.]+)\/?/);
    if (igMatch) handles.instagram = igMatch[0];

    const fbMatch = html.match(/https?:\/\/(?:www\.)?facebook\.com\/([A-Za-z0-9_./-]+)\/?/);
    if (fbMatch) handles.facebook = fbMatch[0];

    const ttMatch = html.match(/https?:\/\/(?:www\.)?tiktok\.com\/@([A-Za-z0-9_.]+)\/?/);
    if (ttMatch) handles.tiktok = ttMatch[0];

    return handles;
  }
}
