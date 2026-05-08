'use client';

import { LeadIntelligence } from '../../leads/lead-intelligence';

export function LeadsTab({ campaignId }: { campaignId: string }) {
  return <LeadIntelligence campaignId={campaignId} embedded />;
}
