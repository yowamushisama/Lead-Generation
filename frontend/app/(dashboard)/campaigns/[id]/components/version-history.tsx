'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { History, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { promptConfigs as promptConfigsApi } from '@/lib/api-client';
import { relativeTime } from '@/lib/utils';
import type { PromptConfigSnapshot } from '@/models';

interface Props {
  promptConfigId: string;
  currentVersion: number;
  history: PromptConfigSnapshot[];
}

function countChangedFields(data: Partial<Record<string, unknown>>): number {
  return Object.values(data).filter((v) => {
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && v !== '';
  }).length;
}

export function VersionHistory({ promptConfigId, currentVersion, history }: Props) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const restoreMutation = useMutation({
    mutationFn: (version: number) => promptConfigsApi.restore(promptConfigId, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-config', promptConfigId] });
      queryClient.invalidateQueries({ queryKey: ['prompt-configs'] });
    },
  });

  if (history.length === 0) return null;

  return (
    <div className="rounded-xl border border-ink/[0.06] bg-surface">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-elevated">
          <History className="h-3.5 w-3.5 text-dusk" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[11px] font-500 text-mist uppercase tracking-wider">
            Version History
          </p>
          <p className="font-mono text-[10px] text-dusk mt-0.5">
            {history.length} previous {history.length === 1 ? 'version' : 'versions'}
          </p>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-dusk shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-dusk shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t border-ink/[0.06] divide-y divide-ink/[0.04]">
          {/* Current version row */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-6 text-right">
              <span className="font-mono text-[10px] text-aqua">v{currentVersion}</span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-mono text-[11px] text-ink">Current</span>
            </div>
            <span className="rounded-full bg-aqua/10 px-2 py-0.5 font-mono text-[9px] text-aqua">
              Active
            </span>
          </div>

          {/* Historical versions — newest first */}
          {[...history].reverse().map((snap) => {
            const fieldCount = countChangedFields(snap.data as Record<string, unknown>);
            return (
              <div key={snap.version} className="flex items-center gap-3 px-4 py-3 group">
                <div className="w-6 text-right">
                  <span className="font-mono text-[10px] text-dusk">v{snap.version}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-[11px] text-mist">
                    {fieldCount} field{fieldCount !== 1 ? 's' : ''} configured
                  </span>
                  <p className="font-mono text-[9px] text-dusk mt-0.5">
                    {relativeTime(snap.savedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => restoreMutation.mutate(snap.version)}
                  disabled={restoreMutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg border border-ink/[0.06] px-2.5 py-1.5 font-mono text-[10px] text-dusk opacity-0 group-hover:opacity-100 hover:text-ink hover:border-ink/10 transition-all disabled:opacity-50"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  Restore
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
