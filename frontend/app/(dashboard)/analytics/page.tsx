import { AnalyticsDashboard } from './analytics-dashboard';

export default function AnalyticsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Analytics</h1>
        <p className="text-sm text-zinc-500">Last 30 days</p>
      </div>
      <AnalyticsDashboard />
    </div>
  );
}
