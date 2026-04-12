'use client';

import { useQuery } from '@tanstack/react-query';
import { MessageCircle, ExternalLink } from 'lucide-react';
import { conversations as convsApi } from '@/lib/api-client';
import { Card } from '@/components/ui/card';
import { TierBadge } from '@/components/ui/badge';
import { relativeTime } from '@/lib/utils';

export default function ConversationsPage() {
  const { data: convs = [], isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => convsApi.list(),
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="font-display text-xl font-700 text-ink">Conversations</h1>
        <p className="mt-0.5 font-mono text-[11px] text-dusk">{convs.length} active threads</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : convs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <MessageCircle className="h-10 w-10 text-dusk" />
          <p className="text-[14px] font-500 text-mist">No conversations yet</p>
          <p className="font-mono text-[11px] text-dusk">Conversations appear when leads reply to outreach</p>
        </div>
      ) : (
        <div className="space-y-2">
          {convs.map((conv) => (
            <Card key={conv.id} className="hover:bg-elevated transition-colors cursor-pointer">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-aqua/10">
                  <MessageCircle className="h-4 w-4 text-aqua" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-500 text-ink">{conv.lead?.company ?? conv.lead?.name ?? 'Unknown'}</p>
                    {conv.lead?.tier && <TierBadge tier={conv.lead.tier as import('@/models').LeadTier} />}
                    <span className="ml-auto font-mono text-[10px] text-dusk">{relativeTime(conv.lastMessageAt)}</span>
                  </div>
                  {conv.lead?.role && <p className="font-mono text-[10px] text-dusk">{conv.lead.role}</p>}
                  <div className="mt-1 flex items-center gap-3">
                    <span className="font-mono text-[10px] text-mist">{conv.messageCount} messages</span>
                    {conv.sentiment && <span className="font-mono text-[10px] text-orchid">{conv.sentiment}</span>}
                    {conv.objectionType && <span className="font-mono text-[10px] text-gold">Objection: {conv.objectionType}</span>}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
