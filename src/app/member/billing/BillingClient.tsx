'use client';

import { Check, CreditCard, Info, ShieldAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, EmptyState } from '@/components/ui/Card';
import { Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { DEMO_PLANS, DEMO_TEST_CARDS } from '@/lib/constants';
import { cn, formatCurrency, formatDateTime } from '@/lib/utils';

type Payment = {
  id: string;
  plan: string;
  amountCents: number;
  currency: string;
  status: string;
  reference: string;
  cardLast4: string;
  cardBrand: string;
  failureCode: string | null;
  isDemo: boolean;
  createdAt: string;
};

type PlanId = 'BASIC' | 'PRO' | 'ELITE';

/**
 * DEMO PAYMENT — NO REAL MONEY.
 * The banner below is intentionally impossible to miss: this screen simulates
 * a gateway so the project can demonstrate a checkout flow end to end.
 */
export function BillingClient({ initialPayments }: { initialPayments: Payment[] }) {
  const toast = useToast();
  const [payments, setPayments] = useState(initialPayments);
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [form, setForm] = useState({ name: '', cardNumber: '', expiry: '', cvc: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  function openCheckout(plan: PlanId) {
    setSelectedPlan(plan);
    setForm({ name: '', cardNumber: '', expiry: '', cvc: '' });
    setErrors({});
    setFormError(null);
  }

  function formatCardNumber(value: string) {
    return value
      .replace(/\D/g, '')
      .slice(0, 19)
      .replace(/(.{4})/g, '$1 ')
      .trim();
  }

  function formatExpiry(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    return digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  function validate() {
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = 'Enter the name on the card.';
    if (form.cardNumber.replace(/\s/g, '').length < 13) next.cardNumber = 'Enter a full card number.';
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(form.expiry)) next.expiry = 'Use MM/YY format.';
    if (!/^\d{3,4}$/.test(form.cvc)) next.cvc = 'CVC must be 3 or 4 digits.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submitPayment(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!selectedPlan || !validate()) return;

    setProcessing(true);
    try {
      const result = await apiFetch<{ message: string; payment: Payment }>('/api/payments', {
        method: 'POST',
        body: {
          plan: selectedPlan,
          name: form.name.trim(),
          cardNumber: form.cardNumber,
          expiry: form.expiry,
          cvc: form.cvc,
        },
      });

      setPayments((current) => [result.payment, ...current]);
      setSelectedPlan(null);
      toast.success('DEMO PAYMENT approved', 'No real money moved — this is a simulation.');
    } catch (caught) {
      // A declined test card is a real, expected outcome — show it in the form.
      setFormError(errorMessage(caught, 'The demo payment could not be processed.'));
      try {
        const refreshed = await apiFetch<{ payments: Payment[] }>('/api/payments');
        setPayments(refreshed.payments);
      } catch {
        /* keep the existing list */
      }
    } finally {
      setProcessing(false);
    }
  }

  const activePlan = payments.find((p) => p.status === 'SUCCEEDED');

  return (
    <div className="space-y-5">
      {/* Unmissable demo notice */}
      <div className="rounded-xl border-2 border-dashed border-amber-500 bg-amber-50 p-4 dark:bg-amber-500/10">
        <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          <ShieldAlert className="h-5 w-5" aria-hidden />
          Demo payment — no real money
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-amber-900/90 dark:text-amber-200/90">
          This checkout is a simulation built for the project showcase. No payment processor is
          contacted, no money moves, and no card details are stored — only the brand and last four
          digits are kept, exactly as a real integration would. Use the test card numbers below;
          never enter a real card.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {DEMO_PLANS.map((plan) => {
          const isActive = activePlan?.plan === plan.id;
          return (
            <Card
              key={plan.id}
              className={cn(
                'relative flex flex-col',
                plan.popular && 'ring-2 ring-brand-500',
                isActive && 'ring-2 ring-emerald-500',
              )}
            >
              {plan.popular && !isActive && (
                <span className="absolute -top-2.5 left-4 rounded-full bg-brand-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  Most popular
                </span>
              )}
              {isActive && (
                <span className="absolute -top-2.5 left-4 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  Current (demo)
                </span>
              )}

              <CardBody className="flex flex-1 flex-col">
                <h3 className="text-sm font-semibold text-ink">{plan.name}</h3>
                <p className="mt-0.5 text-xs text-muted">{plan.blurb}</p>
                <p className="mt-3">
                  <span className="text-3xl font-semibold tracking-tight text-ink">
                    {formatCurrency(plan.amountCents)}
                  </span>
                  <span className="text-sm text-muted"> /month</span>
                </p>

                <ul className="mt-4 flex-1 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm text-muted">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  className="mt-5"
                  fullWidth
                  variant={plan.popular ? 'primary' : 'outline'}
                  onClick={() => openCheckout(plan.id)}
                >
                  <CreditCard className="h-4 w-4" aria-hidden />
                  Run demo checkout
                </Button>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader
          title="Demo payment history"
          description="Simulated transactions recorded against your account"
          icon={<CreditCard className="h-4 w-4" />}
        />
        {payments.length === 0 ? (
          <EmptyState
            icon={<CreditCard className="h-5 w-5" />}
            title="No demo payments yet"
            description="Run a demo checkout above to see how a transaction is recorded."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-2.5 font-medium sm:px-5">Reference</th>
                  <th className="px-4 py-2.5 font-medium">Plan</th>
                  <th className="px-4 py-2.5 font-medium">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Card</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium sm:px-5">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted sm:px-5">
                      {payment.reference}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink">
                      {payment.plan.charAt(0) + payment.plan.slice(1).toLowerCase()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink">
                      {formatCurrency(payment.amountCents, payment.currency)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {payment.cardBrand} ••{payment.cardLast4}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={payment.status === 'SUCCEEDED' ? 'success' : 'danger'}>
                        {payment.status === 'SUCCEEDED' ? 'Approved' : `Declined${payment.failureCode ? ` · ${payment.failureCode}` : ''}`}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted sm:px-5">
                      {formatDateTime(payment.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Checkout modal */}
      <Modal
        open={selectedPlan !== null}
        onClose={() => !processing && setSelectedPlan(null)}
        title="DEMO PAYMENT — NO REAL MONEY"
        description={
          selectedPlan
            ? `Simulated checkout for ${DEMO_PLANS.find((p) => p.id === selectedPlan)?.name} — ${formatCurrency(
                DEMO_PLANS.find((p) => p.id === selectedPlan)?.amountCents ?? 0,
              )}/month`
            : undefined
        }
      >
        <form onSubmit={submitPayment} className="space-y-4" noValidate>
          <Alert tone="warning" title="This is a simulation">
            Do not enter a real card number. Use one of the test cards listed below.
          </Alert>

          {formError && <Alert tone="error">{formError}</Alert>}

          <Input
            label="Name on card"
            placeholder="Priya Raman"
            autoComplete="off"
            value={form.name}
            onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))}
            error={errors.name}
          />

          <Input
            label="Card number"
            placeholder="4242 4242 4242 4242"
            inputMode="numeric"
            autoComplete="off"
            value={form.cardNumber}
            onChange={(event) => setForm((c) => ({ ...c, cardNumber: formatCardNumber(event.target.value) }))}
            error={errors.cardNumber}
            leading={<CreditCard className="h-4 w-4" aria-hidden />}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Expiry"
              placeholder="12/30"
              inputMode="numeric"
              autoComplete="off"
              value={form.expiry}
              onChange={(event) => setForm((c) => ({ ...c, expiry: formatExpiry(event.target.value) }))}
              error={errors.expiry}
            />
            <Input
              label="CVC"
              placeholder="123"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={form.cvc}
              onChange={(event) => setForm((c) => ({ ...c, cvc: event.target.value.replace(/\D/g, '') }))}
              error={errors.cvc}
            />
          </div>

          <div className="rounded-lg border border-line bg-surface-2/60 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-ink">
              <Info className="h-3.5 w-3.5" aria-hidden />
              Test cards
            </p>
            <ul className="mt-2 space-y-1">
              {DEMO_TEST_CARDS.map((card) => (
                <li key={card.number} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setForm((c) => ({ ...c, cardNumber: card.number }))}
                    className="font-mono text-ink transition-colors hover:text-brand-600"
                  >
                    {card.number}
                  </button>
                  <span className="text-muted">{card.outcome}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedPlan(null)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button type="submit" loading={processing}>
              {processing ? 'Processing demo payment…' : 'Pay (demo)'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
