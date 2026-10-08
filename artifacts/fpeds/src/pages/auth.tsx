import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, Copy, FileKey2, KeyRound, LockKeyhole, ShieldCheck, Upload, X } from 'lucide-react';
import { getGetCurrentUserQueryKey, useGetCurrentUser, useSignIn, useSignUp } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { readCredentialFile } from '@/lib/secure-credential-file';

type SecurityChallenge = { token: string; question: string; expiresAt: number };

function generateAccessKey() {
  const digits = new Uint32Array(50);
  crypto.getRandomValues(digits);
  return Array.from(digits, (digit) => String(digit % 10)).join('');
}

function previewUsername(username: string) {
  return username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'yourname';
}

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const currentUser = useGetCurrentUser();
  const queryClient = useQueryClient();
  const initialSignup = new URLSearchParams(window.location.search).get('mode') === 'signup';
  const [mode, setMode] = useState<'signin' | 'signup' | 'file'>(initialSignup ? 'signup' : 'signin');
  const [accessKey, setAccessKey] = useState(() => initialSignup ? generateAccessKey() : '');
  const [username, setUsername] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePassphrase, setFilePassphrase] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [gateStage, setGateStage] = useState<'idle' | 'choice' | 'code'>(initialSignup ? 'choice' : 'idle');
  const [codeInput, setCodeInput] = useState('');
  const [authorizedCode, setAuthorizedCode] = useState('');
  const [purchaseToken, setPurchaseToken] = useState('');
  const [captcha, setCaptcha] = useState<SecurityChallenge | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const signIn = useSignIn();
  const signUp = useSignUp();
  const pending = signIn.isPending || signUp.isPending;

  const refreshCaptcha = useCallback(async () => {
    setCaptchaAnswer('');
    try {
      const response = await fetch('/api/security/captcha', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('Challenge unavailable');
      setCaptcha(await response.json() as SecurityChallenge);
    } catch {
      setCaptcha(null);
    }
  }, []);

  useEffect(() => { void refreshCaptcha(); }, [refreshCaptcha]);

  const captchaProof = () => {
    if (!captcha || !captchaAnswer.trim()) {
      setError('Complete the human check before continuing.');
      return null;
    }
    return { captchaToken: captcha.token, captchaAnswer: captchaAnswer.trim() };
  };

  const captchaField = (id: string) => (
    <label className="block">
      <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
        {captcha?.question ?? 'Loading human check…'}
      </span>
      <Input
        id={id}
        value={captchaAnswer}
        onChange={(event) => setCaptchaAnswer(event.target.value.replace(/\D/g, '').slice(0, 3))}
        inputMode="numeric"
        autoComplete="off"
        maxLength={3}
        placeholder="Answer"
        aria-label={captcha?.question ?? 'Human check answer'}
        className="h-11 border-white/10 bg-white/[0.04] text-white placeholder:text-white/20"
        required
      />
    </label>
  );

  useEffect(() => {
    if (currentUser.data) setLocation('/inbox');
  }, [currentUser.data, setLocation]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const storedPurchase = sessionStorage.getItem('moraltown-purchase-token') ?? '';
    if (storedPurchase) setPurchaseToken(storedPurchase);
    if (query.get('mode') === 'signup') {
      setMode('signup');
      setAccessKey((key) => key || generateAccessKey());
      setGateStage(storedPurchase ? 'idle' : 'choice');
    }
  }, []);

  const openMode = (nextMode: 'signin' | 'signup' | 'file') => {
    setMode(nextMode);
    setLocation(nextMode === 'signup' ? '/auth?mode=signup' : '/auth');
    setError('');
    setCopied(false);
    if (nextMode === 'signup') {
      if (!accessKey) setAccessKey(generateAccessKey());
      setGateStage(purchaseToken || authorizedCode ? 'idle' : 'choice');
    } else {
      setGateStage('idle');
    }
  };

  const enterWithKey = (key: string, proof: { captchaToken: string; captchaAnswer: string }) => {
    signIn.mutate(
      { data: { accessKey: key, ...proof } },
      {
        onSuccess: (session) => {
          queryClient.setQueryData(getGetCurrentUserQueryKey(), session.user);
          setLocation('/inbox');
        },
        onError: () => {
          setError('That access key was not accepted. Check it and try again.');
          void refreshCaptcha();
        },
      },
    );
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (accessKey.length !== 50) {
      setError('Your access key must be exactly 50 characters.');
      return;
    }
    const proof = captchaProof();
    if (!proof) return;
    if (mode === 'signin') {
      enterWithKey(accessKey, proof);
      return;
    }
    if (!username.trim() || !/[a-z]/i.test(username)) {
      setError('Choose a username with at least one letter.');
      return;
    }
    signUp.mutate(
      { data: { accessKey, username: username.trim(), ...proof, ...(purchaseToken ? { purchaseToken } : { accessCode: authorizedCode }) } },
      {
        onSuccess: (session) => {
          sessionStorage.removeItem('moraltown-purchase-token');
          queryClient.setQueryData(getGetCurrentUserQueryKey(), session.user);
          setLocation('/inbox');
        },
        onError: () => {
          setError('We could not create this account. Check the access code or payment status, then try again.');
          void refreshCaptcha();
        },
      },
    );
  };

  const authorizeWithCode = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const proof = captchaProof();
    if (!proof) return;
    try {
      const response = await fetch('/api/auth/check-access-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ accessCode: codeInput.trim(), ...proof }),
      });
      const result = await response.json();
      if (!response.ok || !result.valid) {
        setError('That access code was not accepted.');
        return;
      }
      setAuthorizedCode(codeInput.trim());
      setGateStage('idle');
      setError('');
    } catch {
      setError('We could not verify that code just now. Please try again.');
    } finally {
      void refreshCaptcha();
    }
  };

  const submitFile = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!file || !filePassphrase) {
      setError('Choose your encrypted key file and enter its passphrase.');
      return;
    }
    try {
      const credential = await readCredentialFile(file, filePassphrase);
      const proof = captchaProof();
      if (proof) enterWithKey(credential.accessKey, proof);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : 'That credential file could not be opened.');
    }
  };

  const copyKey = async () => {
    await navigator.clipboard.writeText(accessKey);
    setCopied(true);
  };

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#090909]/80 px-4 text-[#f3f0ed]">
      <div className="pointer-events-none absolute -right-28 -top-36 h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -left-36 h-[520px] w-[520px] rounded-full bg-white/[0.03] blur-3xl" />
      <section className="relative z-10 w-full max-w-[440px] animate-enter">
        <div className="mb-8">
          <h1 className="font-display text-[3.2rem] leading-none tracking-[-.04em] sm:text-[3.65rem]">
            {mode === 'signup' ? 'Create account.' : 'Welcome back.'}
          </h1>
          <p className="mt-5 text-sm leading-6 text-white/45">
            {mode === 'file'
              ? 'Unlock your mailbox from an encrypted MoralTown key file.'
              : mode === 'signup'
                ? 'Generate your private key, then choose the name people will email.'
                : 'Use the key you were given to enter your mailbox.'}
          </p>
        </div>

        {mode !== 'file' ? (
          <>
            <div className="mb-3 flex rounded-2xl border border-white/10 bg-white/[0.03] p-1">
              <button type="button" onClick={() => openMode('signin')} className={`flex-1 rounded-xl py-2.5 text-sm transition ${mode === 'signin' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`} data-testid="button-mode-signin">Sign in</button>
              <button type="button" onClick={() => openMode('signup')} className={`flex-1 rounded-xl py-2.5 text-sm transition ${mode === 'signup' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`} data-testid="button-mode-signup">Create account</button>
            </div>
            <button type="button" onClick={() => openMode('file')} className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs text-white/35 transition hover:bg-white/[.035] hover:text-white/70" data-testid="button-mode-file">
              <FileKey2 className="h-3.5 w-3.5" /> Sign in with an encrypted key file
            </button>
            <form onSubmit={submit} className="space-y-5">
              {mode === 'signup' && (
                <label className="block">
                  <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">Username</span>
                  <Input value={username} onChange={(event) => setUsername(event.target.value)} maxLength={40} placeholder="your name" className="h-12 border-white/10 bg-white/[0.04] text-white placeholder:text-white/20" data-testid="input-username" />
                  <p className="mt-2 font-mono text-[10px] text-white/35">Your mailbox will be <span className="text-white/65">{previewUsername(username)}@fpdf.2bd.net</span></p>
                </label>
              )}
              <label className="block">
                <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">50-character access key</span>
                <div className="relative">
                  <Input value={accessKey} onChange={(event) => setAccessKey(event.target.value.replace(/\D/g, '').slice(0, 50))} readOnly={mode === 'signup'} inputMode="numeric" maxLength={50} placeholder="enter your private key" className="h-12 border-white/10 bg-white/[0.04] pr-12 font-mono text-sm tracking-[0.12em] text-white placeholder:font-sans placeholder:tracking-normal placeholder:text-white/20" data-testid="input-access-key" />
                  {mode === 'signup' && <button type="button" onClick={copyKey} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 transition hover:text-white" aria-label="Copy generated access key" data-testid="button-copy-access-key">{copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}</button>}
                </div>
              </label>
              {mode === 'signup' && <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.07] px-3 py-3 text-xs leading-5 text-white/50"><KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>Save this generated key. It is the only way back into your mailbox.</span></div>}
              {captchaField('auth-captcha-answer')}
              {error && <p className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary" data-testid="status-auth-error">{error}</p>}
              <Button type="submit" disabled={pending || !captcha} className="h-12 w-full rounded-xl font-semibold" data-testid="button-submit-auth">{pending ? 'Opening secure channel…' : mode === 'signin' ? 'Enter mailbox' : 'Create private mailbox'}{!pending && <ArrowRight className="h-4 w-4" />}</Button>
            </form>
          </>
        ) : (
          <form onSubmit={submitFile} className="space-y-5">
            <label className="block cursor-pointer rounded-xl border border-dashed border-white/15 bg-white/[.025] p-4 transition hover:border-primary/50 hover:bg-primary/[.04]">
              <span className="flex items-center gap-3 text-sm"><FileKey2 className="h-4 w-4 text-primary" /> {file ? file.name : 'Choose your encrypted key file'}</span>
              <span className="mt-2 block text-xs leading-5 text-white/40">Encrypted locally. The file passphrase never leaves your browser.</span>
              <input type="file" accept=".fpeds-key,.json,application/json" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="sr-only" data-testid="input-credential-file" />
            </label>
            <Input value={filePassphrase} onChange={(event) => setFilePassphrase(event.target.value)} type="password" placeholder="File passphrase" className="h-12 border-white/10 bg-white/[.04] text-white placeholder:text-white/20" data-testid="input-file-passphrase" />
            {captchaField('file-captcha-answer')}
            {error && <p className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary" data-testid="status-auth-error">{error}</p>}
            <Button type="submit" disabled={pending || !captcha} className="h-12 w-full rounded-xl font-semibold" data-testid="button-login-file"><Upload className="h-4 w-4" /> {pending ? 'Opening secure channel…' : 'Unlock key file'}</Button>
            <button type="button" onClick={() => openMode('signin')} className="w-full text-center text-xs text-white/35 transition hover:text-white/70" data-testid="button-back-to-key-login">Back to access key</button>
          </form>
        )}

        <div className="mt-9 flex items-start gap-3 border-t border-white/10 pt-5 text-xs leading-5 text-white/35">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" />
          <span>Sessions use a secure browser cookie. Encrypted key files never contain session cookies.</span>
        </div>
      </section>
      {mode === 'signup' && gateStage !== 'idle' && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#090909]/85 px-4 py-8 backdrop-blur-md">
          <section role="dialog" aria-modal="true" aria-labelledby="signup-gate-title" className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#11100f] p-6 text-[#f3f0ed] shadow-2xl sm:p-8">
            <button type="button" onClick={() => { setGateStage('idle'); setMode('signin'); setLocation('/auth'); setError(''); }} className="absolute right-4 top-4 rounded-full p-2 text-white/45 transition hover:bg-white/5 hover:text-white" aria-label="Close account options"><X className="h-4 w-4" /></button>
            {gateStage === 'choice' ? (
              <>
                <span className="mb-5 grid h-11 w-11 place-items-center rounded-full border border-primary/20 bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></span>
                <p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Create a MoralTown account</p>
                <h2 id="signup-gate-title" className="mt-3 font-display text-3xl">Choose how to join.</h2>
                <p className="mt-3 text-sm leading-6 text-white/55">Use a free access code or make a one-time $15 lifetime purchase with BTC, SOL, ETH, or LTC.</p>
                <Button type="button" onClick={() => { setGateStage('code'); setError(''); }} className="mt-7 h-12 w-full rounded-xl font-semibold">Enter an access code <ArrowRight className="h-4 w-4" /></Button>
                <Button type="button" variant="outline" onClick={() => setLocation('/checkout')} className="mt-3 h-12 w-full rounded-xl border-white/15 bg-white/[.03] text-white hover:bg-white/[.08]">Buy lifetime access · $15 <ArrowRight className="h-4 w-4" /></Button>
                <div className="mt-5 flex items-start gap-2 border-t border-white/10 pt-4 text-xs leading-5 text-white/40"><KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>Your generated access key cannot be recovered if you lose it. Save it somewhere secure.</span></div>
              </>
            ) : (
              <>
                <button type="button" onClick={() => { setGateStage('choice'); setError(''); }} className="mb-6 inline-flex items-center gap-2 text-xs text-white/45 hover:text-white"><ArrowRight className="h-3.5 w-3.5 rotate-180" /> Back to options</button>
                <p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Free access</p>
                <h2 id="signup-gate-title" className="mt-3 font-display text-3xl">Enter your access code.</h2>
                <p className="mt-3 text-sm leading-6 text-white/55">The code unlocks account creation. You will still receive a separate 50-digit key for signing in.</p>
                <form onSubmit={authorizeWithCode} className="mt-6 space-y-4">
                  <Input autoFocus value={codeInput} onChange={(event) => setCodeInput(event.target.value)} autoComplete="off" className="h-12 border-white/10 bg-white/[0.04] text-white placeholder:text-white/25" placeholder="Access code" aria-label="Free access code" />
                  {captchaField('access-code-captcha-answer')}
                  {error && <p className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">{error}</p>}
                  <Button type="submit" disabled={!codeInput.trim() || !captcha} className="h-12 w-full rounded-xl font-semibold">Continue <ArrowRight className="h-4 w-4" /></Button>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}