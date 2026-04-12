'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare, Check, X, Edit3, ChevronRight,
  AlertTriangle, Shield, Clock, Bot,
} from 'lucide-react';
import { messages as messagesApi } from '@/lib/api-client';
import type { Message } from '@/models';
import { TierBadge, SourceBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn, relativeTime } from '@/lib/utils';

const REJECT_REASONS = [
  'Too generic', 'Wrong tone', 'Incorrect information',
  'Too salesy', 'Bad timing', 'Other',
];

export function MessageQueue() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editedBody, setEditedBody] = useState('');
  const [editedSubject, setEditedSubject] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const { data: pendingMessages = [], isLoading } = useQuery({
    queryKey: ['messages', 'pending'],
    queryFn: () => messagesApi.listPending(),
    refetchInterval: 15_000,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      messagesApi.approve(id, {
        editedBody: editedBody || undefined,
        editedSubject: editedSubject || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', 'pending'] });
      setSelectedId(null);
      setEditedBody('');
      setEditedSubject('');
      setIsEditing(false);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      messagesApi.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', 'pending'] });
      setSelectedId(null);
      setShowRejectForm(false);
      setRejectReason('');
    },
  });

  const selectedMsg = pendingMessages.find((m) => m.id === selectedId) ?? null;

  function selectMessage(msg: Message) {
    setSelectedId(msg.id);
    setEditedBody(msg.body);
    setEditedSubject(msg.subject ?? '');
    setShowRejectForm(false);
    setIsEditing(false);
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-700 text-ink">Message Queue</h1>
          <p className="mt-0.5 font-mono text-[11px] text-mist">{pendingMessages.length} pending approval</p>
        </div>
        {pendingMessages.length > 5 && (
          <div className="flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-3 py-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-gold" />
            <span className="font-mono text-[11px] text-gold">{pendingMessages.length} need review</span>
          </div>
        )}
      </div>

      <div className="grid h-[calc(100vh-200px)] min-h-[500px] grid-cols-1 gap-4 lg:grid-cols-5">
        {/* List */}
        <div className="lg:col-span-2">
          <Card className="flex h-full flex-col overflow-hidden p-0">
            <div className="border-b border-ink/[0.06] px-4 py-3">
              <span className="section-label">Pending Messages</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="space-y-2 p-3">
                  {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20 rounded-lg" />)}
                </div>
              ) : pendingMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                  <MessageSquare className="h-8 w-8 text-mist" />
                  <div>
                    <p className="text-[13px] font-500 text-mist">Queue is clear</p>
                    <p className="font-mono text-[11px] text-mist">All messages processed</p>
                  </div>
                </div>
              ) : (
                <ul className="divide-y divide-ink/[0.04]">
                  {pendingMessages.map((msg) => (
                    <li
                      key={msg.id}
                      onClick={() => selectMessage(msg)}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-ink/[0.03]',
                        selectedId === msg.id && 'bg-aqua/[0.05] border-l-2 border-l-aqua',
                      )}
                    >
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-elevated">
                        <MessageSquare className="h-3.5 w-3.5 text-aqua" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-[12px] font-500 text-ink">
                            {msg.lead?.company ?? msg.lead?.name ?? 'Unknown Lead'}
                          </p>
                          <span className="shrink-0 font-mono text-[9px] text-mist">{relativeTime(msg.createdAt)}</span>
                        </div>
                        {msg.subject && <p className="font-mono text-[10px] text-mist truncate">{msg.subject}</p>}
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-mist leading-relaxed">
                          {msg.body.slice(0, 100)}…
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>

        {/* Editor */}
        <div className="lg:col-span-3">
          {!selectedMsg ? (
            <Card className="flex h-full items-center justify-center">
              <div className="text-center">
                <ChevronRight className="mx-auto mb-2 h-8 w-8 text-mist" />
                <p className="text-[13px] font-500 text-mist">Select a message to review</p>
                <p className="font-mono text-[11px] text-mist">Click any message from the list</p>
              </div>
            </Card>
          ) : (
            <Card className="flex h-full flex-col p-0 overflow-hidden">
              {/* Lead context */}
              <div className="flex items-center gap-4 border-b border-ink/[0.06] bg-elevated/50 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-500 text-ink">
                    {selectedMsg.lead?.company ?? selectedMsg.lead?.name ?? 'Unknown'}
                  </p>
                  {selectedMsg.lead?.role && (
                    <p className="font-mono text-[10px] text-mist">{selectedMsg.lead.role}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selectedMsg.lead?.tier && (
                    <TierBadge tier={selectedMsg.lead.tier as import('@/models').LeadTier} />
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Channel badges */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 rounded-full border border-aqua/20 bg-aqua/5 px-2.5 py-1">
                    <MessageSquare className="h-3 w-3 text-aqua" />
                    <span className="font-mono text-[10px] text-aqua">LinkedIn DM</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full border border-orchid/20 bg-orchid/5 px-2.5 py-1">
                    <Bot className="h-3 w-3 text-orchid" />
                    <span className="font-mono text-[10px] text-orchid">AI Generated</span>
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="section-label mb-1.5 block">Subject</label>
                  {isEditing ? (
                    <input
                      value={editedSubject}
                      onChange={(e) => setEditedSubject(e.target.value)}
                      className="w-full rounded-lg border border-ink/[0.06] bg-elevated px-3 py-2 font-mono text-[12px] text-ink focus:border-aqua/30 focus:outline-none"
                    />
                  ) : (
                    <p className="text-[13px] font-500 text-ink">{editedSubject || 'No subject'}</p>
                  )}
                </div>

                {/* Body */}
                <div>
                  <label className="section-label mb-1.5 block">Message Body</label>
                  {isEditing ? (
                    <textarea
                      value={editedBody}
                      onChange={(e) => setEditedBody(e.target.value)}
                      rows={10}
                      className="w-full resize-none rounded-lg border border-ink/[0.06] bg-elevated px-3 py-2 font-mono text-[12px] text-mist leading-relaxed focus:border-aqua/30 focus:outline-none"
                    />
                  ) : (
                    <p className="whitespace-pre-wrap font-mono text-[12px] text-mist leading-relaxed">{editedBody}</p>
                  )}
                </div>

                {/* Scores */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Spam Score', value: 0.12, color: 'bg-jade', text: 'text-jade', icon: Shield },
                    { label: 'Uniqueness', value: 0.91, color: 'bg-aqua', text: 'text-aqua', icon: Clock },
                  ].map(({ label, value, color, text, icon: Icon }) => (
                    <div key={label} className="rounded-lg border border-ink/[0.06] bg-elevated p-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Icon className={cn('h-3 w-3', text)} />
                        <span className="section-label">{label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 rounded-full bg-ink/[0.06] h-1.5">
                          <div className={cn('h-1.5 rounded-full', color)} style={{ width: `${value * 100}%` }} />
                        </div>
                        <span className={cn('num font-mono text-[11px]', text)}>{value}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Reject form */}
                {showRejectForm && (
                  <div className="rounded-lg border border-crimson/20 bg-crimson/[0.03] p-3 space-y-2">
                    <p className="section-label text-crimson">Rejection Reason</p>
                    <div className="flex flex-wrap gap-1.5">
                      {REJECT_REASONS.map((r) => (
                        <button
                          key={r}
                          onClick={() => setRejectReason(r)}
                          className={cn(
                            'rounded-full px-2.5 py-1 font-mono text-[10px] transition-colors border',
                            rejectReason === r
                              ? 'border-crimson/30 bg-crimson/10 text-crimson'
                              : 'border-ink/[0.06] text-mist hover:text-ink',
                          )}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Additional notes…"
                      rows={2}
                      className="w-full resize-none rounded-lg border border-ink/[0.06] bg-elevated px-3 py-2 font-mono text-[11px] text-mist focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Action bar */}
              <div className="flex items-center justify-between gap-2 border-t border-ink/[0.06] px-4 py-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setIsEditing(!isEditing); setShowRejectForm(false); }}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-3 py-2 font-mono text-[11px] transition-colors',
                      isEditing ? 'border-aqua/30 bg-aqua/5 text-aqua' : 'border-ink/[0.06] text-mist hover:text-ink',
                    )}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    {isEditing ? 'Editing' : 'Edit'}
                  </button>
                  {!showRejectForm && (
                    <button
                      onClick={() => { setShowRejectForm(true); setIsEditing(false); }}
                      className="flex items-center gap-1.5 rounded-lg border border-ink/[0.06] px-3 py-2 font-mono text-[11px] text-mist hover:border-crimson/20 hover:text-crimson transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {showRejectForm && (
                    <button
                      onClick={() => rejectMutation.mutate({ id: selectedMsg.id, reason: rejectReason })}
                      disabled={rejectMutation.isPending}
                      className="flex items-center gap-1.5 rounded-lg bg-crimson/10 px-4 py-2 font-mono text-[11px] font-500 text-crimson ring-1 ring-crimson/20 hover:bg-crimson/15 disabled:opacity-60"
                    >
                      <X className="h-3.5 w-3.5" />
                      Confirm Reject
                    </button>
                  )}
                  <button
                    onClick={() => approveMutation.mutate(selectedMsg.id)}
                    disabled={approveMutation.isPending}
                    className="flex items-center gap-1.5 rounded-lg bg-jade/10 px-4 py-2 font-mono text-[11px] font-500 text-jade ring-1 ring-jade/20 hover:bg-jade/15 disabled:opacity-60"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {isEditing ? 'Approve with Edits' : 'Approve'}
                  </button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
