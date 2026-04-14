'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, Mail } from 'lucide-react';
import { messages as messagesApi } from '@/lib/api-client';
import type { Message } from '@/models';
import { cn } from '@/lib/utils';
import { EmptyState } from './shared';

const MESSAGE_STATUS_COLORS: Partial<Record<string, string>> = {
  PENDING_APPROVAL: 'text-gold',
  APPROVED:         'text-jade',
  REJECTED:         'text-crimson',
  SENT:             'text-aqua',
  DELIVERED:        'text-aqua',
  OPENED:           'text-orchid',
  REPLIED:          'text-jade',
  BOUNCED:          'text-crimson',
  FAILED:           'text-crimson',
};

export function MessagesTab({ campaignId }: { campaignId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ['messages', { campaignId }];

  const { data: messageList = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => messagesApi.list({ campaignId }),
  });

  const approveMutation = useMutation({
    mutationFn: (msgId: string) => messagesApi.approve(msgId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const rejectMutation = useMutation({
    mutationFn: (msgId: string) => messagesApi.reject(msgId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const actionPending = approveMutation.isPending || rejectMutation.isPending;
  const pending = messageList.filter((m) => m.status === 'PENDING_APPROVAL');
  const others  = messageList.filter((m) => m.status !== 'PENDING_APPROVAL');

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-lg" />)}
      </div>
    );
  }

  if (messageList.length === 0) {
    return <EmptyState icon={Mail} label="No messages yet" sub="Messages will appear here once outreach begins" />;
  }

  return (
    <div className="space-y-5">
      {pending.length > 0 && (
        <Section label={`Pending Approval (${pending.length})`}>
          {pending.map((msg) => (
            <MessageRow
              key={msg.id}
              message={msg}
              onApprove={() => approveMutation.mutate(msg.id)}
              onReject={() => rejectMutation.mutate(msg.id)}
              actionPending={actionPending}
            />
          ))}
        </Section>
      )}

      {others.length > 0 && (
        <Section label={`All Messages (${others.length})`}>
          {others.map((msg) => (
            <MessageRow key={msg.id} message={msg} />
          ))}
        </Section>
      )}
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="section-label">{label}</p>
      {children}
    </div>
  );
}

// ── MessageRow ────────────────────────────────────────────────────────────────

function MessageRow({
  message,
  onApprove,
  onReject,
  actionPending,
}: {
  message: Message;
  onApprove?: () => void;
  onReject?: () => void;
  actionPending?: boolean;
}) {
  const isPendingApproval = message.status === 'PENDING_APPROVAL';

  return (
    <div className={cn(
      'rounded-lg border bg-surface px-4 py-3 transition-colors',
      isPendingApproval ? 'border-gold/15' : 'border-ink/[0.06]',
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {message.lead?.name && (
              <span className="font-mono text-[11px] font-500 text-ink">{message.lead.name}</span>
            )}
            <span className="font-mono text-[10px] text-dusk capitalize">{message.channel ?? 'email'}</span>
            {message.spamScore != null && (
              <span className={cn(
                'font-mono text-[9px] rounded px-1',
                message.spamScore > 0.5 ? 'bg-crimson/10 text-crimson' : 'bg-jade/10 text-jade',
              )}>
                spam {Math.round(message.spamScore * 100)}%
              </span>
            )}
          </div>
          {message.subject && (
            <p className="font-mono text-[11px] text-mist truncate">{message.subject}</p>
          )}
          <p className="font-mono text-[10px] text-dusk line-clamp-2 mt-0.5">{message.body}</p>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={cn(
            'font-mono text-[10px]',
            MESSAGE_STATUS_COLORS[message.status] ?? 'text-dusk',
          )}>
            {message.status.replace(/_/g, ' ')}
          </span>
          {isPendingApproval && onApprove && onReject && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onApprove}
                disabled={actionPending}
                className="flex items-center gap-1 rounded-md border border-jade/20 px-2 py-1 font-mono text-[10px] text-jade hover:bg-jade/5 transition-colors disabled:opacity-50"
              >
                <CheckCircle className="h-3 w-3" />
                Approve
              </button>
              <button
                onClick={onReject}
                disabled={actionPending}
                className="flex items-center gap-1 rounded-md border border-crimson/20 px-2 py-1 font-mono text-[10px] text-crimson hover:bg-crimson/5 transition-colors disabled:opacity-50"
              >
                <XCircle className="h-3 w-3" />
                Reject
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
