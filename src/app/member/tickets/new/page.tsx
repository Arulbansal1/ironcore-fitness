import { Bot } from 'lucide-react';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

import { NewTicketForm } from './NewTicketForm';

export const metadata: Metadata = { title: 'New ticket' };

export default function NewTicketPage() {
  return (
    <>
      <PageHeader
        title="Open a support ticket"
        description="Describe the problem in your own words — our AI will classify and route it instantly."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Ticket details" description="The more specific you are, the faster we can help." />
          <CardBody>
            <NewTicketForm />
          </CardBody>
        </Card>

        <Card className="h-fit">
          <CardHeader
            title="What happens next"
            icon={<Bot className="h-4 w-4" />}
            description="Automatic, within seconds"
          />
          <CardBody>
            <ol className="space-y-3.5">
              {[
                ['AI classification', 'Your ticket is categorised and given a priority and sentiment score.'],
                ['SLA target set', 'A first-response deadline is applied based on the priority.'],
                ['Staff assigned', 'It routes to the staff who specialises in that category and has capacity.'],
                ['Reply drafted', 'An answer is drafted from our knowledge base for the staff to review and send.'],
              ].map(([title, body], index) => (
                <li key={title} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink">{title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-muted">
              A huma staff always reviews and approves the reply before it reaches you — the AI never
              answers you directly.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
