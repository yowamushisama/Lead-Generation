import { Suspense } from 'react';
import { LeadDetail } from './lead-detail';

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense>
      <LeadDetail id={id} />
    </Suspense>
  );
}
