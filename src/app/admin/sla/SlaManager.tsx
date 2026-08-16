'use client';

import { PlayCircle, Slack, Timer } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge, PriorityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Checkbox, Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { formatMinutes } from '@/lib/utils';

type Policy = {
  id: string;
  name: string;
  priority: string;
  firstResponseMins: number;
  resolutionMins: number;
  escalateAfterMins: number;
  notifySlack: boolean;
  isActive: boolean;
  ticketCount: number;
};

const ALL_PRIORITIES = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const;

const DEFAULTS: Record<string, { firstResponseMins: number; resolutionMins: number }> = {
  URGENT: { firstResponseMins: 15, resolutionMins: 240 },
  HIGH: { firstResponseMins: 60, resolutionMins: 480 },
  MEDIUM: { firstResponseMins: 240, resolutionMins: 1440 },
  LOW: { firstResponseMins: 480, resolutionMins: 4320 },
};

export function SlaManager({
  policies,
  openEscalations,
  slackConfigured,
  cronIntervalSeconds,
}: {
  policies: Policy[];
  openEscalations: number;
  slackConfigured: boolean;
  cronIntervalSeconds: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sweeping, setSweeping] = useState(false);

  const byPriority = new Map(policies.map((policy) => [policy.priority, policy]));

  async function runSweep() {
    setSweeping(true);
    try {
      const result = await apiFetch<{
        checked: number;
        newEscalations: number;
        slackSent: number;
        slackFailed: number;
      }>('/api/cron/sla-check', { method: 'POST' });

      toast.success(
        `Checked ${result.checked} open ticket${result.checked === 1 ? '' : 's'}`,
        result.newEscalations > 0
          ? `${result.newEscalations} new escalation(s) · Slack ${result.slackSent} sent, ${result.slackFailed} failed.`
          : 'No new breaches found.',
      );
      router.refresh();
    } catch (caught) {
      toast.error('Sweep failed', errorMessage(caught));
    } finally {
      setSweeping(false);
    }
  }

  async function savePolicy(priority: string, form: PolicyForm) {
    setSaving(true);
    try {
      const result = await apiFetch<{ message: string }>('/api/admin/sla', {
        method: 'PUT',
        body: {
          priority,
          name: form.name,
          firstResponseMins: form.firstResponseMins,
          resolutionMins: form.resolutionMins,
          escalateAfterMins: form.escalateAfterMins,
          notifySlack: form.notifySlack,
          isActive: form.isActive,
        },
      });
      toast.success(result.message);
      setEditing(null);
      router.refresh();
    } catch (caught) {
      toast.error('Could not save the policy', errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Alert tone={slackConfigured ? 'info' : 'warning'} className="mb-4">
        <p>
          Breaches are detected by a sweep at{' '}
          <code className="font-mono text-xs">POST /api/cron/sla-check</code>, run by{' '}
          <code className="font-mono text-xs">npm run sla:worker</code> every {cronIntervalSeconds}s
          (or any external scheduler).{' '}
          {slackConfigured
            ? 'Slack alerts are configured and will fire on each new breach.'
            : 'SLACK_WEBHOOK_URL is not set — escalations are recorded in-app but not pushed to Slack.'}
        </p>
      </Alert>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {openEscalations} open escalation{openEscalations === 1 ? '' : 's'} right now.
        </p>
        <Button variant="outline" loading={sweeping} onClick={runSweep}>
          {!sweeping && <PlayCircle className="h-4 w-4" aria-hidden />}
          Run breach sweep now
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {ALL_PRIORITIES.map((priority) => {
          const policy = byPriority.get(priority);
          return (
            <Card key={priority}>
              <CardHeader
                title={policy?.name ?? `${priority} (not configured)`}
                icon={<Timer className="h-4 w-4" />}
                description={
                  policy
                    ? `${policy.ticketCount} ticket${policy.ticketCount === 1 ? '' : 's'} using this policy`
                    : 'Falls back to the built-in default until configured'
                }
                action={<PriorityBadge priority={priority} />}
              />
              <CardBody className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Metric
                    label="First response"
                    value={formatMinutes(policy?.firstResponseMins ?? DEFAULTS[priority].firstResponseMins)}
                  />
                  <Metric
                    label="Resolution"
                    value={formatMinutes(policy?.resolutionMins ?? DEFAULTS[priority].resolutionMins)}
                  />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={policy?.isActive ?? false ? 'success' : 'neutral'} dot>
                    {policy ? (policy.isActive ? 'Active' : 'Inactive') : 'Using default'}
                  </Badge>
                  <Badge tone={policy?.notifySlack ?? true ? 'info' : 'neutral'}>
                    <Slack className="h-3 w-3" aria-hidden />
                    {policy?.notifySlack ?? true ? 'Slack alerts on' : 'Slack alerts off'}
                  </Badge>
                </div>

                <Button size="sm" variant="outline" fullWidth onClick={() => setEditing(priority)}>
                  {policy ? 'Edit policy' : 'Configure policy'}
                </Button>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted">
        Saving a policy applies to newly created tickets immediately. Existing tickets keep their
        current deadlines until their priority changes — moving a deadline retroactively would
        rewrite history and could fabricate or erase a breach that already happened.
      </p>

      {editing && (
        <PolicyModal
          priority={editing}
          policy={byPriority.get(editing) ?? null}
          saving={saving}
          onClose={() => setEditing(null)}
          onSave={(form) => savePolicy(editing, form)}
        />
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/40 px-3 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

type PolicyForm = {
  name: string;
  firstResponseMins: number;
  resolutionMins: number;
  escalateAfterMins: number;
  notifySlack: boolean;
  isActive: boolean;
};

function PolicyModal({
  priority,
  policy,
  saving,
  onClose,
  onSave,
}: {
  priority: string;
  policy: Policy | null;
  saving: boolean;
  onClose: () => void;
  onSave: (form: PolicyForm) => void;
}) {
  const [name, setName] = useState(policy?.name ?? `${priority.charAt(0)}${priority.slice(1).toLowerCase()} priority`);
  const [firstResponse, setFirstResponse] = useState(
    String(policy?.firstResponseMins ?? DEFAULTS[priority].firstResponseMins),
  );
  const [resolution, setResolution] = useState(
    String(policy?.resolutionMins ?? DEFAULTS[priority].resolutionMins),
  );
  const [escalateAfter, setEscalateAfter] = useState(String(policy?.escalateAfterMins ?? 30));
  const [notifySlack, setNotifySlack] = useState(policy?.notifySlack ?? true);
  const [isActive, setIsActive] = useState(policy?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const first = Number(firstResponse);
    const resolve = Number(resolution);
    const escalate = Number(escalateAfter);

    if (!Number.isInteger(first) || first < 1) return setError('First response must be at least 1 minute.');
    if (!Number.isInteger(resolve) || resolve < 5) return setError('Resolution must be at least 5 minutes.');
    if (resolve <= first) return setError('Resolution target must be longer than the first-response target.');
    if (!Number.isInteger(escalate) || escalate < 1) return setError('Escalation delay must be at least 1 minute.');
    if (name.trim().length < 2) return setError('Give the policy a name.');

    setError(null);
    onSave({
      name: name.trim(),
      firstResponseMins: first,
      resolutionMins: resolve,
      escalateAfterMins: escalate,
      notifySlack,
      isActive,
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${priority.charAt(0)}${priority.slice(1).toLowerCase()} priority SLA`}
      description="Targets are measured from the moment the ticket is created."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Save policy
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}

        <Input label="Policy name" value={name} onChange={(event) => setName(event.target.value)} />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First response (minutes)"
            type="number"
            min={1}
            value={firstResponse}
            onChange={(event) => setFirstResponse(event.target.value)}
            hint={formatMinutes(Number(firstResponse) || 0)}
          />
          <Input
            label="Resolution (minutes)"
            type="number"
            min={5}
            value={resolution}
            onChange={(event) => setResolution(event.target.value)}
            hint={formatMinutes(Number(resolution) || 0)}
          />
        </div>

        <Input
          label="Escalation step (minutes)"
          type="number"
          min={1}
          value={escalateAfter}
          onChange={(event) => setEscalateAfter(event.target.value)}
          hint="Guidance for how quickly a breach should be picked up. Escalation level rises every 2 hours a breach stays open."
        />

        <Checkbox
          label="Send Slack alerts for breaches on this priority"
          checked={notifySlack}
          onChange={(event) => setNotifySlack(event.target.checked)}
        />

        <Checkbox
          label="Policy active"
          hint="When inactive, tickets at this priority fall back to the built-in default targets."
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
        />
      </div>
    </Modal>
  );
}
