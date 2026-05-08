'use client';

import { MessageSquare } from 'lucide-react';
import { cn, relativeTime } from '@/lib/utils';
import { Card, CardLabel } from '@/components/ui/card';

interface OutreachMessage {
  id: string;
  channel: string;
  subject?: string | null;
  body: string;
  status: string;
  createdAt: string;
}

function msgStatusCls(status: string) {
  if (status === 'SENT' || status === 'DELIVERED')   return 'text-jade border-jade/30 bg-jade/5';
  if (status === 'REPLIED')                           return 'text-aqua border-aqua/30 bg-aqua/5';
  if (status === 'DRAFT' || status === 'PENDING_APPROVAL') return 'text-gold border-gold/30 bg-gold/5';
  return 'text-mist border-ink/20';
}

export function LeadMessagesCard({ messages }: { messages: OutreachMessage[] }) {
  if (!messages.length) return null;

  return (
    <Card id="messages" className="space-y-3">
      <CardLabel>Outreach Messages</CardLabel>
      <div className="space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className="rounded-lg border border-ink/[0.06] bg-elevated/40 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3 w-3 text-mist shrink-0" />
                <span className="font-mono text-[11px] text-mist uppercase tracking-wider">{msg.channel}</span>
                {msg.subject && (
                  <span className="font-mono text-[12px] font-600 text-ink truncate">{msg.subject}</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn('font-mono text-[9px] uppercase tracking-wider border rounded px-1.5 py-0.5', msgStatusCls(msg.status))}>
                  {msg.status}
                </span>
                <span className="font-mono text-[10px] text-dusk">{relativeTime(msg.createdAt)}</span>
              </div>
            </div>
            <p className="font-mono text-[11px] text-ink leading-relaxed line-clamp-3">{msg.body}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
