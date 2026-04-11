'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { messages as messagesApi } from '@/lib/api-client';
import type { Message } from '@/models';

export function MessageQueue() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['messages', 'pending'],
    queryFn: () => messagesApi.listPending(),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => messagesApi.approve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      messagesApi.reject(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages'] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-zinc-400">
        Loading messages...
      </div>
    );
  }

  const pending = data ?? [];

  if (pending.length === 0) {
    return (
      <div className="rounded-lg bg-white p-8 text-center ring-1 ring-zinc-200">
        <p className="text-sm text-zinc-500">No messages pending approval</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-500">{pending.length} message{pending.length !== 1 ? 's' : ''} awaiting review</p>
      {pending.map((msg) => (
        <MessageRow
          key={msg.id}
          message={msg}
          onApprove={() => approveMutation.mutate(msg.id)}
          onReject={(reason) => rejectMutation.mutate({ id: msg.id, reason })}
          isPending={approveMutation.isPending || rejectMutation.isPending}
        />
      ))}
    </div>
  );
}

function MessageRow({
  message,
  onApprove,
  onReject,
  isPending,
}: {
  message: Message;
  onApprove: () => void;
  onReject: (reason?: string) => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const preview = message.body.slice(0, 120);
  const isTruncated = message.body.length > 120;

  return (
    <div className="rounded-lg bg-white p-4 ring-1 ring-zinc-200 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-900">
            {message.lead.company ?? message.lead.name ?? 'Unknown'}
          </p>
          {message.subject && (
            <p className="text-xs text-zinc-500 mt-0.5">{message.subject}</p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
          Pending
        </span>
      </div>

      {/* Body */}
      <div className="text-sm text-zinc-700 whitespace-pre-wrap">
        {expanded ? message.body : preview}
        {isTruncated && !expanded && (
          <>
            {'... '}
            <button
              onClick={() => setExpanded(true)}
              className="text-zinc-400 hover:text-zinc-600 underline text-xs"
            >
              Show more
            </button>
          </>
        )}
        {expanded && isTruncated && (
          <>
            {' '}
            <button
              onClick={() => setExpanded(false)}
              className="text-zinc-400 hover:text-zinc-600 underline text-xs"
            >
              Show less
            </button>
          </>
        )}
      </div>

      {/* Actions */}
      {rejecting ? (
        <div className="space-y-2">
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection (optional)"
            rows={2}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                onReject(rejectReason || undefined);
                setRejecting(false);
                setRejectReason('');
              }}
              disabled={isPending}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Confirm reject
            </button>
            <button
              onClick={() => { setRejecting(false); setRejectReason(''); }}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={onApprove}
            disabled={isPending}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            onClick={() => setRejecting(true)}
            disabled={isPending}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
