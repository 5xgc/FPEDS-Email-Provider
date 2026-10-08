import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight, CheckCircle2, Copy, LoaderCircle, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { solveCaptchaWork } from '@/lib/captcha-work';

type Step = 'checking' | 'invalid' | 'verified' | 'account';
type SecurityChallenge = { token: string; question: string; expiresAt: number; workBits: number };

function generateAccessKey() {
  const digits = new Uint32Array(50);
  crypto.getRandomValues(digits);
  return Array.from(digits, (digit) => String(digit % 10)).join('');
}

export default function ClaimPage() {
  const [, setLocation] = useLocation();
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token') ?? '');
  const [step, setStep] = useState<Step>('checking');
  const [secondsRemaining, setSecondsRemaining] = useState(5);
  const [username, setUsername] = useState('');
  const [accessKey] = useState(generateAccessKey);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [captcha, setCaptcha] = useState<SecurityChallenge | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaWorkNonce, setCaptchaWorkNonce] = useState<string | null>(null);
  const [captchaWorking, setCaptchaWorking] = useState(false);

  const refreshCaptcha = async () => {
    setCaptchaAnswer('');
    setCaptchaWorkNonce(null);
    setCaptchaWorking(true);
    try {
      const response = await fetch('/api/security/captcha', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Challenge unavailable');
      const challenge = await response.json() as SecurityChallenge;
      setCaptcha(challenge);
      setCaptchaWorkNonce(String(await solveCaptchaWork(challenge.token, challenge.workBits)));
    } catch {
      setCaptcha(null);
      setError('The security check could not be prepared. Refresh the page and try again.');
    } finally {
      setCaptchaWorking(false);
    }
  };

  useEffect(() => { void refreshCaptcha(); }, []);

  useEffect(() => {
    let active = true;
    const validate = async () => {
      if (!token) {
        setStep('invalid');
        return;
      }
      try {
        const response = await fetch(`/api/payments/claims/validate?token=${encodeURIComponent(token)}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        const result = await response.json();
        if (active) setStep(response.ok && result.valid ? 'verified' : 'invalid');
      } catch {
        if (active) {
          setStep('invalid');
          setError('We could not check this link. Open it again or try another connection.');
        }
      }
    };
    void validate();
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (step !== 'verified' || secondsRemaining <= 0) return;
    const timer = window.setTimeout(() => {
      setSecondsRemaining((remaining) => Math.max(0, remaining - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [step, secondsRemaining]);

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(accessKey);
      setCopied(true);
    } catch {
      setError('Clipboard access is unavailable. Select and copy the key manually.');
    }
  };

  const createAccount = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!/[a-z]/i.test(username.trim())) {
      setError('Choose a username with at least one letter.');
      return;
    }
    if (!captcha || !captchaAnswer.trim() || captchaWorkNonce === null) {
      setError('Complete the human check before continuing.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          accessKey,
          username: username.trim(),
          claimToken: token,
          captchaToken: captcha.token,
          captchaAnswer: captchaAnswer.trim(),
          captchaWorkNonce,
          website: '',
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof result.error === 'string' ? result.error : 'We could not create the account.');
      }
      setLocation('/inbox');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'We could not create the account.');
      void refreshCaptcha();
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="moraltown flex min-h-[100dvh] items-center justify-center px-4 py-8 text-foreground sm:px-8">
      <section className="glass w-full max-w-[520px] rounded-[1.75rem] p-6 sm:p-10" aria-live="polite">
        <Link href="/auth?mode=signup" className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-foreground">
          <BrandLogo />
        </Link>

        {step === 'checking' && (
          <div className="py-12 text-center">
            <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-sm text-foreground/60">Verifying your payment link…</p>
          </div>
        )}

        {step === 'invalid' && (
          <div className="py-8">
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Account claim</p>
            <h1 className="mt-3 font-display text-3xl">This link is unavailable.</h1>
            <p className="mt-3 text-sm leading-6 text-foreground/60">
              It may have already been used or the link may be incomplete. An unused payment link does not expire.
            </p>
            {error && <p role="alert" className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
            <Button asChild className="mt-6 h-12 w-full rounded-xl font-semibold">
              <Link href="/auth?mode=signup">Account options <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        )}

        {step === 'verified' && (
          <div role="dialog" aria-modal="true" aria-labelledby="claim-verified-title" className="py-8 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-primary/20 bg-primary/10 text-primary">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <p className="mt-5 font-mono text-[10px] uppercase tracking-[.18em] text-primary">Payment verified</p>
            <h1 id="claim-verified-title" className="mt-3 font-display text-3xl">You have verified your payment.</h1>
            <p className="mt-2 text-lg font-semibold text-primary">THANK YOU :)</p>
            <p className="mt-4 text-sm leading-6 text-foreground/55">
              Your account link does not expire, but it can be used once to create one account.
            </p>
            <Button
              onClick={() => setStep('account')}
              disabled={secondsRemaining > 0}
              className="mt-7 h-12 w-full rounded-xl font-semibold"
            >
              {secondsRemaining > 0 ? `Next in ${secondsRemaining} seconds` : <>Next <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </div>
        )}

        {step === 'account' && (
          <div className="mt-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              <ShieldCheck className="h-4 w-4" /> Payment verified
            </span>
            <h1 className="mt-5 font-display text-3xl">Create your account.</h1>
            <p className="mt-2 text-sm leading-6 text-foreground/55">Choose a username and save the 50-digit key below. The key is required every time you sign in.</p>

            <form onSubmit={createAccount} className="mt-6 space-y-5">
              <div>
                <label htmlFor="claim-username" className="text-sm font-medium">Username</label>
                <Input
                  id="claim-username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  autoFocus
                  maxLength={40}
                  className="mt-2 h-12 border-white/10 bg-white/[.035]"
                  placeholder="yourname"
                />
                <p className="mt-2 text-xs text-foreground/45">Your email address will be {username.trim() ? username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '') : 'yourname'}@fpdf.2bd.net</p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="claim-access-key" className="text-sm font-medium">Your sign-in key</label>
                  <button type="button" onClick={copyKey} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                    <Copy className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy key'}
                  </button>
                </div>
                <textarea
                  id="claim-access-key"
                  readOnly
                  value={accessKey}
                  onFocus={(event) => event.currentTarget.select()}
                  className="min-h-20 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-sm leading-6 text-foreground"
                  aria-describedby="claim-key-warning"
                />
                <p id="claim-key-warning" className="mt-2 text-xs leading-5 text-foreground/45">Save this key somewhere secure. It cannot be recovered if you lose it.</p>
              </div>

              <label className="block">
                <span className="mb-2 block font-mono text-[10px] uppercase tracking-[.16em] text-foreground/45">
                  {captcha?.question ?? 'Loading human check…'}{captcha && captchaWorking ? ' · checking browser' : ''}
                </span>
                <Input
                  value={captchaAnswer}
                  onChange={(event) => setCaptchaAnswer(event.target.value.replace(/\D/g, '').slice(0, 3))}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={3}
                  placeholder="Answer"
                  aria-label={captcha?.question ?? 'Human check answer'}
                  className="h-11 border-white/10 bg-white/[.035]"
                  required
                />
              </label>

              {error && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={busy || !username.trim() || !captcha || captchaWorkNonce === null} className="h-12 w-full rounded-xl font-semibold">
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {busy ? 'Creating account…' : 'Create account'}
                {!busy ? <ArrowRight className="h-4 w-4" /> : null}
              </Button>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}