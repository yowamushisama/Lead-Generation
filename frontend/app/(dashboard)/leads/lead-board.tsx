'use client';

import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { leads as leadsApi } from '@/lib/api-client';
import type { Lead, LeadStatus } from '@/models';
import { KANBAN_COLUMNS, TIER_COLORS, SOURCE_LABELS } from '@/constants';

export function LeadBoard() {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => leadsApi.list({ limit: 100 }),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) =>
      leadsApi.updateStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-zinc-400">
        Loading leads...
      </div>
    );
  }

  const allLeads = data?.data ?? [];
  const byStatus = Object.fromEntries(
    KANBAN_COLUMNS.map((col) => [col.id, allLeads.filter((l) => l.status === col.id)]),
  ) as Record<LeadStatus, Lead[]>;

  const activeLead = activeId ? allLeads.find((l) => l.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    // `over` can be a column id or another card id — resolve to column
    const targetStatus = resolveColumn(over.id as string, allLeads);
    if (!targetStatus) return;

    const lead = allLeads.find((l) => l.id === active.id);
    if (lead && lead.status !== targetStatus) {
      moveMutation.mutate({ id: lead.id, status: targetStatus });
    }
  }

  function handleDragOver(event: DragOverEvent) {
    // Optimistic reorder handled by re-query on success
    void event;
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((col) => (
          <Column
            key={col.id}
            column={col}
            leads={byStatus[col.id] ?? []}
          />
        ))}
      </div>

      <DragOverlay>
        {activeLead ? <LeadCard lead={activeLead} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function resolveColumn(overId: string, allLeads: Lead[]): LeadStatus | null {
  // If over a column header droppable
  const col = KANBAN_COLUMNS.find((c) => c.id === overId);
  if (col) return col.id;
  // If over another card — use that card's current status
  const lead = allLeads.find((l) => l.id === overId);
  if (lead) return lead.status;
  return null;
}

function Column({
  column,
  leads,
}: {
  column: { id: LeadStatus; label: string };
  leads: Lead[];
}) {
  const { setNodeRef } = useSortable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className="flex w-52 shrink-0 flex-col rounded-lg bg-white shadow-sm ring-1 ring-zinc-200"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {column.label}
        </span>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
          {leads.length}
        </span>
      </div>

      <SortableContext
        items={leads.map((l) => l.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2 p-2 min-h-[80px]">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function LeadCard({
  lead,
  isDragging = false,
}: {
  lead: Lead;
  isDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } =
    useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`rounded-md bg-white p-3 ring-1 ring-zinc-200 cursor-grab active:cursor-grabbing select-none ${
        isDragging ? 'shadow-lg ring-2 ring-zinc-400' : ''
      }`}
    >
      <p className="text-sm font-medium text-zinc-900 truncate">
        {lead.company ?? lead.name ?? 'Unknown'}
      </p>
      {lead.name && lead.company && (
        <p className="text-xs text-zinc-500 truncate">{lead.name}</p>
      )}
      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
        {lead.tier && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TIER_COLORS[lead.tier] ?? ''}`}
          >
            {lead.tier}
          </span>
        )}
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">
          {SOURCE_LABELS[lead.source] ?? lead.source}
        </span>
        {lead.score != null && (
          <span className="ml-auto text-[11px] font-medium text-zinc-400">
            {lead.score}
          </span>
        )}
      </div>
    </div>
  );
}
