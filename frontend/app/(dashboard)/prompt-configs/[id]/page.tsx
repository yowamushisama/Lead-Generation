import { Suspense } from 'react';
import { PromptConfigEditor } from './prompt-config-editor';

export const metadata = { title: 'Edit Prompt Profile' };

export default async function PromptConfigEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense fallback={<div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>}>
      <PromptConfigEditor id={id} />
    </Suspense>
  );
}
