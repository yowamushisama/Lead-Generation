import { MessageQueue } from './message-queue';

export default function MessagesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Message Approval</h1>
        <p className="text-sm text-zinc-500">Review and approve AI-generated outreach messages</p>
      </div>
      <MessageQueue />
    </div>
  );
}
