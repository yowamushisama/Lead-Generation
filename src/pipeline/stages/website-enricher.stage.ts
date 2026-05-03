import { Injectable, Logger } from '@nestjs/common';
import {
  WebsiteAudit,
  EnrichmentStatus,
  WebsiteEnrichmentOutput,
  DeepSignals,
  EmergencyPositioning,
} from './website-enricher.types';
import {
  CTA_PATTERN,
  TECH_FINGERPRINTS,
  FETCH_TIMEOUT_MS,
  CHATBOT_VENDORS,
  BOOKING_VENDORS,
  CRM_VENDORS,
  ANALYTICS_VENDORS,
  EMAIL_MARKETING_VENDORS,
  CALCULATOR_PATTERN,
  LIVE_CHAT_PATTERN,
  EMERGENCY_PATTERN,
  STICKY_HEADER_PATTERN,
  FLOATING_CTA_PATTERN,
  JSON_LD_BLOCK_PATTERN,
  TEAM_PAGE_PATTERN,
  BLOG_PATTERN,
  CASE_STUDIES_PATTERN,
  MAINTENANCE_PLAN_PATTERN,
  LOCATIONS_PATTERN,
} from './website-enricher.config';

export {
  WebsiteAudit,
  EnrichmentStatus,
  WebsiteEnrichmentOutput,
  DeepSignals,
} from './website-enricher.types';

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
    const uniqueStack = [...new Set(techStack)];

    const deepSignals = this.detectDeepSignals(html);

    return {
      title,
      metaDescription,
      h1Count,
      hasViewport,
      ctaPresent,
      techStack: uniqueStack,
      loadMs,
      deepSignals,
    };
  }

  private detectDeepSignals(html: string): DeepSignals {
    // Chatbot vendor
    let chatbotVendor: string | null = null;
    for (const [pattern, name] of CHATBOT_VENDORS) {
      if (pattern.test(html)) {
        chatbotVendor = name;
        break;
      }
    }
    const hasChatbot = chatbotVendor !== null;

    // Booking vendor
    let bookingVendor: string | null = null;
    for (const [pattern, name] of BOOKING_VENDORS) {
      if (pattern.test(html)) {
        bookingVendor = name;
        break;
      }
    }
    const hasBookingWidget = bookingVendor !== null;

    // Estimate calculator
    const hasEstimateCalculator = CALCULATOR_PATTERN.test(html);

    // Live chat (text-based heuristic, distinct from script-based bot)
    const hasLiveChat = !hasChatbot && LIVE_CHAT_PATTERN.test(html);

    // Form field count (sum across all <form> blocks; capped at 100 to avoid noise)
    const formFieldCount = this.countFormFields(html);

    // Schema markup
    const schema = this.parseSchema(html);

    // Mobile UX
    const hasStickyHeader = STICKY_HEADER_PATTERN.test(html);
    const hasClickToCall = /href=["']tel:/i.test(html);
    const hasFloatingCta = FLOATING_CTA_PATTERN.test(html);

    // Emergency positioning
    const emergencyMatches = html.match(new RegExp(EMERGENCY_PATTERN.source, 'gi')) ?? [];
    const emergencyPositioning: EmergencyPositioning =
      emergencyMatches.length === 0
        ? 'none'
        : emergencyMatches.length >= 3
          ? 'prominent'
          : 'mentioned';

    // Stack hints
    const detectedCrm = this.matchVendorList(html, CRM_VENDORS);
    const detectedAnalytics = this.matchVendorList(html, ANALYTICS_VENDORS);
    const detectedEmailMarketing = this.matchVendorList(html, EMAIL_MARKETING_VENDORS);

    // Multi-location
    const locationsListed = (html.match(LOCATIONS_PATTERN) ?? []).length;

    // Content depth
    const hasTeamPage = TEAM_PAGE_PATTERN.test(html);
    const hasBlog = BLOG_PATTERN.test(html);
    const hasCaseStudies = CASE_STUDIES_PATTERN.test(html);
    const hasMaintenancePlanCopy = MAINTENANCE_PLAN_PATTERN.test(html);

    // Aggregate gap count — used as cheap pre-filter for AI report generation
    const gaps = [
      !hasChatbot,
      !hasEstimateCalculator,
      !hasBookingWidget,
      !schema.hasSchemaMarkup,
      !hasMaintenancePlanCopy,
      detectedCrm.length === 0,
      detectedEmailMarketing.length === 0,
      formFieldCount !== null && formFieldCount < 4,
      emergencyPositioning === 'none',
      !hasFloatingCta,
    ].filter(Boolean).length;

    return {
      hasChatbot,
      chatbotVendor,
      hasEstimateCalculator,
      hasBookingWidget,
      bookingVendor,
      hasLiveChat,
      formFieldCount,
      hasSchemaMarkup: schema.hasSchemaMarkup,
      schemaTypes: schema.schemaTypes,
      hasReviewSchema: schema.hasReviewSchema,
      hasFAQSchema: schema.hasFAQSchema,
      hasStickyHeader,
      hasClickToCall,
      hasFloatingCta,
      emergencyPositioning,
      detectedCrm,
      detectedAnalytics,
      detectedEmailMarketing,
      locationsListed,
      hasTeamPage,
      hasBlog,
      hasCaseStudies,
      hasMaintenancePlanCopy,
      gapCount: gaps,
    };
  }

  private countFormFields(html: string): number | null {
    const formBlocks = html.match(/<form[\s\S]*?<\/form>/gi);
    if (!formBlocks || formBlocks.length === 0) return null;
    let total = 0;
    for (const block of formBlocks) {
      const inputs = block.match(/<input\b(?![^>]*type=["'](?:hidden|submit|button)["'])/gi) ?? [];
      const textareas = block.match(/<textarea\b/gi) ?? [];
      const selects = block.match(/<select\b/gi) ?? [];
      total += inputs.length + textareas.length + selects.length;
    }
    return Math.min(total, 100);
  }

  private parseSchema(html: string): {
    hasSchemaMarkup: boolean;
    schemaTypes: string[];
    hasReviewSchema: boolean;
    hasFAQSchema: boolean;
  } {
    const blocks = html.match(JSON_LD_BLOCK_PATTERN) ?? [];
    if (blocks.length === 0) {
      return {
        hasSchemaMarkup: false,
        schemaTypes: [],
        hasReviewSchema: false,
        hasFAQSchema: false,
      };
    }

    const types = new Set<string>();
    for (const block of blocks) {
      const inner = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>\s*$/i, '');
      try {
        const parsed: unknown = JSON.parse(inner);
        this.collectSchemaTypes(parsed, types);
      } catch {
        // ignore malformed JSON-LD blocks
      }
    }

    const arr = [...types];
    return {
      hasSchemaMarkup: arr.length > 0,
      schemaTypes: arr,
      hasReviewSchema: arr.some((t) => /Review|AggregateRating/i.test(t)),
      hasFAQSchema: arr.some((t) => /FAQ/i.test(t)),
    };
  }

  private collectSchemaTypes(node: unknown, out: Set<string>): void {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const item of node) this.collectSchemaTypes(item, out);
      return;
    }
    if (typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      const t = obj['@type'];
      if (typeof t === 'string') out.add(t);
      else if (Array.isArray(t)) t.forEach((x) => typeof x === 'string' && out.add(x));
      const graph = obj['@graph'];
      if (Array.isArray(graph)) for (const g of graph) this.collectSchemaTypes(g, out);
    }
  }

  private matchVendorList(html: string, vendors: Array<[RegExp, string]>): string[] {
    const found = new Set<string>();
    for (const [pattern, name] of vendors) {
      if (pattern.test(html)) found.add(name);
    }
    return [...found];
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
