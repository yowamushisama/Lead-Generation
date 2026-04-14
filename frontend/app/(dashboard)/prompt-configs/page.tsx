import { Suspense } from 'react';
import { PromptLibrary } from './prompt-library';

export const metadata = { title: 'Prompt Library' };

export default function PromptConfigsPage() {
  return (
    <Suspense fallback={<div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-32 rounded-xl" />)}</div>}>
      <PromptLibrary />
    </Suspense>
  );
}
