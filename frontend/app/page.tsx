import { redirect } from 'next/navigation';

// Root redirect → handled by (dashboard) layout auth middleware
// The Command Center lives at /overview
export default function Home() {
  redirect('/overview');
}
