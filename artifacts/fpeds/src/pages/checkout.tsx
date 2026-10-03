import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, Copy, LoaderCircle, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
  confirmationEmailSent: boolean;
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

function formatCountdown(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map((part) => String(part).padStart(2, '0')).join(':');
}

export default function CheckoutPage() {
  const [, setLocation] = useLocation();
  const [stage, setStage] = useState<'plan' | 'method' | 'payment'>('plan');
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const secondsRemaining = order
    ? Math.max(0, order.expiresAt - now)
    : 0;

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
    if (
      !order ||
      !['pending', 'checking', 'confirming'].includes(order.status) &&
        !(order.status === 'confirmed' && !order.confirmationEmailSent)
    ) return;
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
    if (!order || !['pending', 'checking', 'confirming'].includes(order.status)) return;
    const timer = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [order?.id, order?.status]);

  useEffect(() => {
    if (order?.status === 'confirmed' && order.purchaseToken) {
      sessionStorage.setItem('moraltown-purchase-token', order.purchaseToken);
    }
  }, [order]);

  const createOrder = async () => {
    if (!currency || !emailIsValid) return;
    setBusy(true);
    setError('');
    try {
      const created = await readResponse<PaymentOrder>(await fetch('/api/payments/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency, email: email.trim() }),
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
                <label htmlFor="payment-email" className="mt-6 block text-sm font-medium">Email for your account link</label>
                <div className="relative mt-2">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
                  <Input
                    id="payment-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => { setEmail(event.target.value); setError(''); }}
                    placeholder="you@example.com"
                    className="h-12 border-white/10 bg-white/[.035] pl-10"
                    required
                  />
                </div>
                <p className="mt-2 text-xs leading-5 text-foreground/45">We only use this address to send the one-time link after your payment is verified.</p>
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
                <Button onClick={createOrder} disabled={!currency || !emailIsValid || busy} className="mt-6 h-12 w-full rounded-xl font-semibold">
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
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3.5 py-3">
                    <span className="flex items-center gap-2 text-xs text-foreground/55"><Clock3 className="h-4 w-4 shrink-0 text-primary" />Payment window</span>
                    <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{formatCountdown(secondsRemaining)}</span>
                  </div>
                  <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-foreground/50"><Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />This request is checked automatically against the public blockchain for two hours. You do not need to press a confirmation button.</p>
                </div>

                {['pending', 'checking', 'confirming'].includes(order.status) && (
                  <div className="mt-5 flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/[.055] p-4">
                    <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
                    <div>
                      <p className="text-sm font-semibold">{order.status === 'confirming' ? 'Payment found; waiting for confirmations' : 'Automatically checking the public blockchain'}</p>
                      <p className="mt-1 text-xs leading-5 text-foreground/55">{order.status === 'confirming' ? `${order.confirmations} of ${order.requiredConfirmations} confirmations.` : 'No action needed. We keep checking while this payment request is active.'}</p>
                      {secondsRemaining === 0 && <p className="mt-2 text-xs leading-5 text-foreground/55">The two-hour payment window has ended. We are finishing this check before closing the request.</p>}
                    </div>
                  </div>
                )}
                {order.status === 'confirmed' && (
                  <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/[.06] p-4">
                    <p className="flex items-center gap-2 font-semibold text-primary"><CheckCircle2 className="h-5 w-5" /> Payment confirmed</p>
                    {order.confirmationEmailSent ? (
                      <p className="mt-2 text-xs leading-5 text-foreground/65">Your one-time account link has been emailed. It does not expire and can be used to create one account. Check your spam folder if it is not in your inbox.</p>
                    ) : order.purchaseToken ? (
                      <>
                        <p className="mt-2 text-xs leading-5 text-foreground/55">Your older payment request is confirmed. Continue to create one account and save its access key.</p>
                        <Button onClick={continueToSignup} className="mt-4 h-12 w-full rounded-xl font-semibold">Continue to account creation <ArrowRight className="h-4 w-4" /></Button>
                      </>
                    ) : (
                      <p className="mt-2 flex items-center gap-2 text-xs leading-5 text-foreground/55"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Your permanent account link is being emailed. This page will update automatically.</p>
                    )}
                  </div>
                )}
                {order.status === 'expired' && <p className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">This payment request expired without a matching blockchain transfer. If you already paid, do not pay again until the transfer has been checked.</p>}
                {error && <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

                <div className="mt-6 space-y-3 border-t border-white/10 pt-5">
                  <p className="flex items-start gap-2 text-xs leading-5 text-foreground/55"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />Send the exact quoted amount, with the network fee paid separately. A different amount may not match automatically.</p>
                  <p className="text-xs leading-5 text-foreground/50">Blockchain transfers are public and generally irreversible. Public blockchain data services check the address and may retain their own logs. Your email is used only to deliver the account-creation link.</p>
                </div>
              </div>
            )}
      </section>
    </main>
  );
}