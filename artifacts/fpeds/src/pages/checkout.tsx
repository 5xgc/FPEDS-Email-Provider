import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, Copy, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Currency = 'BTC' | 'SOL' | 'ETH' | 'LTC';
type PaymentStatus = 'pending' | 'checking' | 'confirming' | 'confirmed' | 'expired';
type PaymentOrder = {
  id: string;
  currency: Currency;
  address: string;
  amount: string;
  usdPrice: string;
  status: PaymentStatus;
  confirmations: number;
  requiredConfirmations: number;
  expiresAt: number;
  transactionId?: string | null;
  purchaseToken?: string;
};

const methods: { currency: Currency; symbol: string; name: string; network: string }[] = [
  { currency: 'BTC', symbol: '₿', name: 'Bitcoin', network: 'Bitcoin mainnet' },
  { currency: 'SOL', symbol: '◎', name: 'Solana', network: 'Solana mainnet' },
  { currency: 'ETH', symbol: 'Ξ', name: 'Ethereum', network: 'Ethereum mainnet' },
  { currency: 'LTC', symbol: 'Ł', name: 'Litecoin', network: 'Litecoin mainnet' },
];

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Checkout is temporarily unavailable.');
  }
  return data as T;
}

export default function CheckoutPage() {
  const [, setLocation] = useLocation();
  const [stage, setStage] = useState<'plan' | 'method' | 'payment'>('plan');
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const recoverOrder = async () => {
      const orderId = sessionStorage.getItem('moraltown-payment-order-id');
      if (!orderId) return;
      try {
        const recovered = await readResponse<PaymentOrder>(await fetch(`/api/payments/orders/${encodeURIComponent(orderId)}`, { cache: 'no-store' }));
        setOrder(recovered);
        setCurrency(recovered.currency);
        setStage('payment');
      } catch {
        sessionStorage.removeItem('moraltown-payment-order-id');
      }
    };
    void recoverOrder();
  }, []);

  useEffect(() => {
    if (!order || !['checking', 'confirming'].includes(order.status)) return;
    let active = true;
    const check = async () => {
      try {
        const next = await readResponse<PaymentOrder>(await fetch(`/api/payments/orders/${encodeURIComponent(order.id)}`, { cache: 'no-store' }));
        if (active) setOrder(next);
      } catch {
        // Leave the last known status visible. The next scheduled check can recover.
      }
    };
    const timer = window.setInterval(check, 12000);
    void check();
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [order?.id, order?.status]);

  useEffect(() => {
    if (order?.status === 'confirmed' && order.purchaseToken) {
      sessionStorage.setItem('moraltown-purchase-token', order.purchaseToken);
    }
  }, [order]);

  const createOrder = async () => {
    if (!currency) return;
    setBusy(true);
    setError('');
    try {
      const created = await readResponse<PaymentOrder>(await fetch('/api/payments/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency }),
      }));
      sessionStorage.setItem('moraltown-payment-order-id', created.id);
      setOrder(created);
      setStage('payment');
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Checkout is temporarily unavailable.');
    } finally {
      setBusy(false);
    }
  };

  const markSent = async () => {
    if (!order) return;
    setBusy(true);
    setError('');
    try {
      const updated = await readResponse<PaymentOrder>(await fetch(`/api/payments/orders/${encodeURIComponent(order.id)}/sent`, {
        method: 'POST',
      }));
      setOrder(updated);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'We could not start payment confirmation.');
    } finally {
      setBusy(false);
    }
  };

  const copyAddress = async () => {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Clipboard access is unavailable. Select and copy the address.');
    }
  };

  const continueToSignup = () => {
    if (!order?.purchaseToken) return;
    setLocation('/auth?mode=signup');
  };

  const selectedMethod = methods.find((method) => method.currency === currency);

  return (
    <main className="moraltown checkout-page flex min-h-[100dvh] items-center justify-center px-4 py-8 text-foreground sm:px-8">
      <section className="glass checkout-card w-full max-w-[730px] rounded-[1.75rem] p-6 sm:p-10 md:p-12" aria-live="polite">
            {stage === 'plan' && (
              <div className="animate-enter">
                <p className="font-mono text-[10px] uppercase tracking-[.18em] text-foreground/45">One-time purchase</p>
                <div className="mt-5 flex items-end justify-between gap-4 border-b border-white/10 pb-6">
                  <div><h2 className="font-display text-3xl">Lifetime access</h2><p className="mt-2 text-sm text-foreground/55">Pay once. No subscription.</p></div>
                  <p className="font-display text-4xl tabular-nums">$15</p>
                </div>
                <p className="mt-6 text-sm leading-6 text-foreground/65">
                  The final crypto amount is calculated from the live exchange rate when you create a payment request. Exact amount and address appear in the next step.
                </p>
                <Button onClick={() => setStage('method')} className="mt-7 h-12 w-full rounded-xl font-semibold">
                  Buy now <ArrowRight className="h-4 w-4" />
                </Button>
                <p className="mt-4 text-center text-xs text-foreground/45">Have a free access code? <Link href="/auth?mode=signup" className="font-semibold text-primary hover:underline">Create an account instead</Link></p>
              </div>
            )}

            {stage === 'method' && (
              <div className="animate-enter">
                <button onClick={() => setStage('plan')} className="mb-6 inline-flex items-center gap-2 text-xs text-foreground/50 hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back</button>
                <p className="font-mono text-[10px] uppercase tracking-[.18em] text-foreground/45">Payment method</p>
                <h2 className="mt-2 font-display text-3xl">Choose a network</h2>
                <p className="mt-2 text-sm leading-6 text-foreground/55">Use the matching mainnet. A transfer on another network will not be detected.</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {methods.map((method) => (
                    <button
                      key={method.currency}
                      type="button"
                      onClick={() => { setCurrency(method.currency); setError(''); }}
                      aria-pressed={currency === method.currency}
                      className={`flex min-h-[78px] items-center gap-4 rounded-2xl border p-4 text-left transition ${currency === method.currency ? 'border-primary bg-primary/10 shadow-sm' : 'border-white/10 bg-white/[.035] hover:border-primary/40 hover:bg-white/[.06]'}`}
                    >
                      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-2xl ${currency === method.currency ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}`}>{method.symbol}</span>
                      <span className="min-w-0"><span className="block font-semibold">{method.name} <span className="font-mono text-xs text-foreground/45">{method.currency}</span></span><span className="mt-1 block truncate text-xs text-foreground/50">{method.network}</span></span>
                    </button>
                  ))}
                </div>
                {error && <p className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
                <Button onClick={createOrder} disabled={!currency || busy} className="mt-6 h-12 w-full rounded-xl font-semibold">
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  {busy ? 'Preparing payment request…' : `Buy with ${selectedMethod?.name ?? 'crypto'}`}
                  {!busy ? <ArrowRight className="h-4 w-4" /> : null}
                </Button>
              </div>
            )}

            {stage === 'payment' && order && (
              <div className="animate-enter">
                <button onClick={() => { sessionStorage.removeItem('moraltown-payment-order-id'); setStage('method'); setOrder(null); setError(''); }} className="mb-6 inline-flex items-center gap-2 text-xs text-foreground/50 hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> New payment request</button>
                <p className="font-mono text-[10px] uppercase tracking-[.18em] text-foreground/45">Send exact amount / {order.currency}</p>
                <h2 className="mt-2 font-display text-3xl">Your payment address</h2>
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.035] p-4 sm:p-5">
                  <p className="font-mono text-[9px] uppercase tracking-[.16em] text-foreground/45">Amount · about ${order.usdPrice} USD</p>
                  <p className="mt-2 break-all font-mono text-xl font-semibold tabular-nums text-primary sm:text-2xl">{order.amount} <span className="text-sm">{order.currency}</span></p>
                  <p className="mb-2 mt-5 font-mono text-[9px] uppercase tracking-[.16em] text-foreground/45">Send to · {selectedMethod?.network ?? `${order.currency} mainnet`}</p>
                  <div className="flex min-w-0 items-stretch gap-2">
                    <code className="min-w-0 flex-1 select-all break-all rounded-xl bg-black/35 p-3 font-mono text-[11px] leading-5 text-foreground/80 sm:text-xs">{order.address}</code>
                    <Button variant="outline" onClick={copyAddress} className="h-auto min-h-12 shrink-0 px-3" aria-label="Copy payment address">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
                  </div>
                  <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-foreground/50"><Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />Request expires {new Date(order.expiresAt * 1000).toLocaleString()}. The request is saved in this browser. After you tell us you sent it, confirmation continues while the chain is checked.</p>
                </div>

                {order.status === 'pending' && (
                  <Button onClick={markSent} disabled={busy} className="mt-5 h-12 w-full rounded-xl font-semibold">
                    {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                    I sent the payment
                  </Button>
                )}
                {['checking', 'confirming'].includes(order.status) && (
                  <div className="mt-5 flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/[.055] p-4">
                    <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
                    <div><p className="text-sm font-semibold">{order.status === 'confirming' ? 'Payment found; waiting for confirmations' : 'Checking the public blockchain'}</p><p className="mt-1 text-xs leading-5 text-foreground/55">{order.confirmations} of {order.requiredConfirmations} confirmations. This page checks again automatically.</p></div>
                  </div>
                )}
                {order.status === 'confirmed' && (
                  <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/[.06] p-4">
                    <p className="flex items-center gap-2 font-semibold text-primary"><CheckCircle2 className="h-5 w-5" /> Payment confirmed</p>
                    <p className="mt-2 text-xs leading-5 text-foreground/55">Your one-time account claim is ready. Create one account and save its access key.</p>
                    <Button onClick={continueToSignup} className="mt-4 h-12 w-full rounded-xl font-semibold">Continue to account creation <ArrowRight className="h-4 w-4" /></Button>
                  </div>
                )}
                {order.status === 'expired' && <p className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">This payment request expired before it was marked as sent. Create a new request before paying.</p>}
                {error && <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

                <div className="mt-6 space-y-3 border-t border-white/10 pt-5">
                  <p className="flex items-start gap-2 text-xs leading-5 text-foreground/55"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />Send the exact quoted amount, with the network fee paid separately. A different amount may not match automatically.</p>
                  <p className="text-xs leading-5 text-foreground/50">Blockchain transfers are public and generally irreversible. Payment confirmation uses public blockchain data services; those services can see the address being checked and may retain their own logs. This checkout does not collect an email address.</p>
                </div>
              </div>
            )}
      </section>
    </main>
  );
}