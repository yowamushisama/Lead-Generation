import { LeadBoard } from './lead-board';

export default function LeadsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Lead Board</h1>
        <p className="text-sm text-zinc-500">Drag cards to move leads through the pipeline</p>
      </div>
      <LeadBoard />
    </div>
  );
}
