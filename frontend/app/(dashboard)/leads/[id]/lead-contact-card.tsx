'use client';

import { Mail, Phone, Globe, MapPin, Building2, ExternalLink } from 'lucide-react';
import type { Lead } from '@/models';
import { Card, CardLabel } from '@/components/ui/card';

export function LeadContactCard({ lead }: { lead: Lead }) {
  return (
    <Card id="contact" className="space-y-3">
      <CardLabel>Contact & Company</CardLabel>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {lead.email && (
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 shrink-0 text-aqua" />
            <a href={`mailto:${lead.email}`} className="font-mono text-[12px] text-aqua hover:underline truncate">
              {lead.email}
            </a>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 shrink-0 text-jade" />
            <span className="font-mono text-[12px] text-ink">{lead.phone}</span>
          </div>
        )}
        {lead.website && (
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 shrink-0 text-aqua" />
            <a
              href={lead.website}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[12px] text-aqua hover:underline flex items-center gap-1 truncate"
            >
              <span className="truncate">{lead.website.replace(/^https?:\/\//, '')}</span>
              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
            </a>
          </div>
        )}
        {lead.sourceUrl && lead.source === 'linkedin' && (
          <div className="flex items-center gap-2">
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-orchid" />
            <a
              href={lead.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[12px] text-orchid hover:underline flex items-center gap-1"
            >
              LinkedIn profile <ExternalLink className="h-2.5 w-2.5 shrink-0" />
            </a>
          </div>
        )}
        {(lead.location || lead.industry) && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-mist" />
            <span className="font-mono text-[12px] text-ink">
              {[lead.location, lead.industry].filter(Boolean).join(' · ')}
            </span>
          </div>
        )}
        {(lead.companySize || lead.headline) && (
          <div className="flex items-start gap-2 sm:col-span-2">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-mist mt-0.5" />
            <span className="font-mono text-[12px] text-ink leading-relaxed">
              {[lead.companySize, lead.headline].filter(Boolean).join(' — ')}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
