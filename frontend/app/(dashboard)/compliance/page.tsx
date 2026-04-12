'use client';

import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, Download, Trash2, UserX } from 'lucide-react';
import { compliance, leads as leadsApi } from '@/lib/api-client';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';

export default function CompliancePage() {
  const retentionQuery = useQuery({
    queryKey: ['compliance', 'retention'],
    queryFn: () => compliance.retentionSummary(),
  });
  const r = retentionQuery.data;

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="font-display text-xl font-700 text-ink">Compliance</h1>
        <p className="mt-0.5 font-mono text-[11px] text-dusk">GDPR data retention · opt-outs · right of access</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Retention summary */}
        <Card>
          <CardHeader>
            <CardTitle>Data Retention</CardTitle>
            <ShieldCheck className="h-4 w-4 text-jade" />
          </CardHeader>
          <div className="space-y-3">
            {[
              { label: 'Total Leads', value: r?.totalLeads ?? 0, color: 'text-ink' },
              { label: 'Opted Out', value: r?.optedOut ?? 0, color: 'text-jade' },
              { label: 'Expiring in 7 days', value: r?.expiringSoon ?? 0, color: 'text-gold' },
              { label: 'Retention Policy', value: r ? `${r.retentionPolicyDays}d` : '—', color: 'text-mist' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[12px] text-mist">{label}</span>
                <span className={`num font-mono text-[13px] font-600 ${color}`}>
                  {typeof value === 'number' ? value.toLocaleString() : value}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Rights panel */}
        <Card>
          <CardHeader>
            <CardTitle>Data Subject Rights</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-ink/[0.06] bg-elevated p-3">
              <p className="text-[12px] font-500 text-ink mb-1">Process Opt-Out by Lead ID</p>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-ink/[0.06] bg-surface px-3 py-2 font-mono text-[11px] text-ink focus:border-aqua/30 focus:outline-none"
                  placeholder="Lead ID…"
                />
                <button className="flex items-center gap-1.5 rounded-lg bg-jade/10 px-3 py-2 font-mono text-[11px] text-jade ring-1 ring-jade/20">
                  <UserX className="h-3.5 w-3.5" />
                  Opt Out
                </button>
              </div>
            </div>
            <div className="rounded-lg border border-ink/[0.06] bg-elevated p-3">
              <p className="text-[12px] font-500 text-ink mb-1">Export Lead Data (GDPR Access)</p>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-ink/[0.06] bg-surface px-3 py-2 font-mono text-[11px] text-ink focus:border-aqua/30 focus:outline-none"
                  placeholder="Lead ID…"
                />
                <button className="flex items-center gap-1.5 rounded-lg bg-aqua/10 px-3 py-2 font-mono text-[11px] text-aqua ring-1 ring-aqua/20">
                  <Download className="h-3.5 w-3.5" />
                  Export
                </button>
              </div>
            </div>
            <div className="rounded-lg border border-crimson/15 bg-crimson/[0.03] p-3">
              <p className="text-[12px] font-500 text-crimson mb-1">Right to Erasure</p>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-ink/[0.06] bg-surface px-3 py-2 font-mono text-[11px] text-ink focus:border-crimson/30 focus:outline-none"
                  placeholder="Lead ID…"
                />
                <button className="flex items-center gap-1.5 rounded-lg bg-crimson/10 px-3 py-2 font-mono text-[11px] text-crimson ring-1 ring-crimson/20">
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
