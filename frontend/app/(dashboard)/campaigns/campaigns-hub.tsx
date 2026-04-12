'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pause, Play, BarChart2, Users, MessageSquare,
  TrendingUp, Calendar, X, Megaphone,
} from 'lucide-react';
import { campaigns as campaignsApi } from '@/lib/api-client';
import type { Campaign } from '@/models';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, formatPercent, relativeTime } from '@/lib/utils';

export function CampaignsHub() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const { data: campaignList = [], isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => campaignsApi.list(),
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => campaignsApi.pause(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => campaignsApi.resume(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });

  const createMutation = useMutation({
    mutationFn: () => campaignsApi.create({ name: newName, description: newDesc }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
    },
  });

  const replyRate = (c: Campaign) =>
    c.messagesSent > 0 ? c.replies / c.messagesSent : 0;

  const convRate = (c: Campaign) =>
    c.leadsGenerated > 0 ? c.conversions / c.leadsGenerated : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-700 text-ink">Campaigns</h1>
          <p className="mt-0.5 font-mono text-[11px] text-dusk">{campaignList.length} campaigns</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-aqua/10 px-4 py-2 font-mono text-[12px] font-500 text-aqua ring-1 ring-aqua/20 hover:bg-aqua/15 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Campaign
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-base/80 backdrop-blur-sm">
          <Card className="w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-[15px] font-600 text-ink">New Campaign</h2>
              <button onClick={() => setShowCreate(false)}><X className="h-4 w-4 text-dusk hover:text-mist" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="section-label mb-1.5 block">Campaign Name</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-lg border border-ink/[0.06] bg-elevated px-3 py-2 font-mono text-[12px] text-ink focus:border-aqua/30 focus:outline-none"
                  placeholder="Q2 SaaS Outreach"
                />
              </div>
              <div>
                <label className="section-label mb-1.5 block">Description (optional)</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-ink/[0.06] bg-elevated px-3 py-2 font-mono text-[12px] text-mist focus:border-aqua/30 focus:outline-none"
                  placeholder="Target SaaS founders with 10-100 employees…"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button onClick={() => setShowCreate(false)} className="rounded-lg border border-ink/[0.06] px-4 py-2 font-mono text-[11px] text-dusk hover:text-mist">
                  Cancel
                </button>
                <button
                  onClick={() => createMutation.mutate()}
                  disabled={!newName.trim() || createMutation.isPending}
                  className="rounded-lg bg-aqua/10 px-4 py-2 font-mono text-[11px] font-500 text-aqua ring-1 ring-aqua/20 disabled:opacity-50 hover:bg-aqua/15"
                >
                  {createMutation.isPending ? 'Creating…' : 'Create Campaign'}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Campaign grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-48 rounded-xl" />)}
        </div>
      ) : campaignList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Megaphone className="h-10 w-10 text-dusk" />
          <p className="text-[14px] font-500 text-mist">No campaigns yet</p>
          <p className="font-mono text-[11px] text-dusk">Create your first campaign to start acquiring leads</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaignList.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              replyRate={replyRate(campaign)}
              convRate={convRate(campaign)}
              onPause={() => pauseMutation.mutate(campaign.id)}
              onResume={() => resumeMutation.mutate(campaign.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignCard({
  campaign,
  replyRate,
  convRate,
  onPause,
  onResume,
}: {
  campaign: Campaign;
  replyRate: number;
  convRate: number;
  onPause: () => void;
  onResume: () => void;
}) {
  const isActive = campaign.status === 'ACTIVE';
  return (
    <div className={cn(
      'rounded-xl border bg-surface p-4 transition-all hover:bg-elevated',
      isActive ? 'border-jade/15' : 'border-ink/[0.06]',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[14px] font-600 text-ink truncate">{campaign.name}</h3>
          {campaign.description && (
            <p className="font-mono text-[10px] text-dusk mt-0.5 line-clamp-1">{campaign.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn(
            'flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px]',
            isActive ? 'bg-jade/10 text-jade' : 'bg-dusk/10 text-dusk',
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full', isActive ? 'bg-jade animate-pulse-dot' : 'bg-dusk')} />
            {campaign.status}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {[
          { icon: Users,        label: 'Leads',     value: campaign.leadsGenerated, color: 'text-aqua' },
          { icon: MessageSquare, label: 'Sent',     value: campaign.messagesSent,   color: 'text-orchid' },
          { icon: TrendingUp,   label: 'Reply',     value: formatPercent(replyRate), color: 'text-jade' },
          { icon: BarChart2,    label: 'Convert',   value: formatPercent(convRate),  color: 'text-gold' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-lg bg-elevated p-2">
            <div className="flex items-center gap-1 mb-0.5">
              <Icon className={cn('h-3 w-3', color)} />
              <span className="font-mono text-[9px] text-dusk">{label}</span>
            </div>
            <span className={cn('num font-mono text-[13px] font-600', color)}>{value}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-ink/[0.06] pt-3">
        <div className="flex items-center gap-1 font-mono text-[10px] text-dusk">
          <Calendar className="h-3 w-3" />
          {relativeTime(campaign.createdAt)}
        </div>
        <button
          onClick={isActive ? onPause : onResume}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[10px] transition-colors',
            isActive
              ? 'border-gold/20 text-gold hover:bg-gold/5'
              : 'border-jade/20 text-jade hover:bg-jade/5',
          )}
        >
          {isActive ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          {isActive ? 'Pause' : 'Resume'}
        </button>
      </div>
    </div>
  );
}
