import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Copy, Download, FileKey2, KeyRound, LockKeyhole, ShieldCheck, Upload, X } from 'lucide-react';
import { getGetCurrentUserQueryKey, useGetCurrentUser, useSignIn, useSignUp } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { readCredentialFile } from '@/lib/secure-credential-file';
import { solveCaptchaWork } from '@/lib/captcha-work';
import { LanguagePicker } from '@/components/language-picker';

type SecurityChallenge = { token: string; question: string; expiresAt: number; workBits: number };

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
  const adminLogin = new URLSearchParams(window.location.search).get('admin') === '1';
  const initialSignup = !adminLogin && new URLSearchParams(window.location.search).get('mode') === 'signup';
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
  const [captchaWorkNonce, setCaptchaWorkNonce] = useState<string | null>(null);
  const [captchaWorking, setCaptchaWorking] = useState(false);
  const signIn = useSignIn();
  const signUp = useSignUp();
  const pending = signIn.isPending || signUp.isPending;
  const reduceMotion = useReducedMotion();
  const [desktopPromoOpen, setDesktopPromoOpen] = useState(
    () => !adminLogin && mode !== 'file',
  );

  const refreshCaptcha = useCallback(async () => {
    setCaptchaAnswer('');
    setCaptchaWorkNonce(null);
    setCaptchaWorking(true);
    try {
      const response = await fetch('/api/security/captcha', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('Challenge unavailable');
      const challenge = await response.json() as SecurityChallenge;
      setCaptcha(challenge);
      const workNonce = await solveCaptchaWork(challenge.token, challenge.workBits);
      setCaptchaWorkNonce(String(workNonce));
    } catch {
      setCaptcha(null);
      setError('The security check could not be prepared. Refresh the page and try again.');
    } finally {
      setCaptchaWorking(false);
    }
  }, []);

  useEffect(() => { void refreshCaptcha(); }, [refreshCaptcha]);

  useEffect(() => {
    setDesktopPromoOpen(!adminLogin && mode !== 'file');
  }, [adminLogin, mode]);

  useEffect(() => {
    if (!desktopPromoOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDesktopPromoOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [desktopPromoOpen]);

  const captchaProof = () => {
    if (!captcha || !captchaAnswer.trim() || captchaWorkNonce === null) {
      setError('Complete the human check before continuing.');
      return null;
    }
    return {
      captchaToken: captcha.token,
      captchaAnswer: captchaAnswer.trim(),
      captchaWorkNonce,
      website: '',
    };
  };

  const captchaField = (id: string) => (
    <label className="block">
      <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
        {captcha?.question ?? 'Loading human check…'}{captcha && captchaWorking ? ' · checking browser' : ''}
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
    if (!adminLogin && query.get('mode') === 'signup') {
      setMode('signup');
      setAccessKey((key) => key || generateAccessKey());
      setGateStage(storedPurchase ? 'idle' : 'choice');
    }
  }, []);

  const openMode = (nextMode: 'signin' | 'signup' | 'file') => {
    setMode(nextMode);
    setDesktopPromoOpen(!adminLogin && nextMode !== 'file');
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

  const enterWithKey = (key: string, proof: { captchaToken: string; captchaAnswer: string; captchaWorkNonce: string; website: string }) => {
    signIn.mutate(
      { data: { accessKey: key, ...proof, adminOnly: adminLogin } },
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
            {adminLogin ? 'Admin sign in.' : mode === 'signup' ? 'Create account.' : 'Welcome back.'}
          </h1>
          <p className="mt-5 text-sm leading-6 text-white/45">
            {mode === 'file'
              ? 'Unlock your mailbox from an encrypted MoralTown key file.'
              : adminLogin
                ? 'Only the administrator access key is accepted while the site is shut down.'
                : mode === 'signup'
                ? 'Generate your private key, then choose the name people will email.'
                : 'Use the key you were given to enter your mailbox.'}
          </p>
        </div>

        {mode !== 'file' ? (
          <>
            {!adminLogin && <div className="mb-3 flex rounded-2xl border border-white/10 bg-white/[0.03] p-1">
              <button type="button" onClick={() => openMode('signin')} className={`flex-1 rounded-xl py-2.5 text-sm transition ${mode === 'signin' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`} data-testid="button-mode-signin">Sign in</button>
              <button type="button" onClick={() => openMode('signup')} className={`flex-1 rounded-xl py-2.5 text-sm transition ${mode === 'signup' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`} data-testid="button-mode-signup">Create account</button>
            </div>}
            {!adminLogin && <button type="button" onClick={() => openMode('file')} className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs text-white/35 transition hover:bg-white/[.035] hover:text-white/70" data-testid="button-mode-file">
              <FileKey2 className="h-3.5 w-3.5" /> Sign in with an encrypted key file
            </button>}
            <form onSubmit={submit} className="space-y-5">
              {mode === 'signup' && (
                <label className="block">
                  <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">Username</span>
                  <Input value={username} onChange={(event) => setUsername(event.target.value)} maxLength={40} placeholder="your name" className="h-12 border-white/10 bg-white/[0.04] text-white placeholder:text-white/20" data-testid="input-username" />
                  <p className="mt-2 font-mono text-[10px] text-white/35">Your mailbox will be <span className="text-white/65">{previewUsername(username)}@fpdf.2bd.net</span></p>
                </label>
              )}
              <label className="block">
                  <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">{adminLogin ? 'Administrator access key' : '50-character access key'}</span>
                <div className="relative">
                  <Input value={accessKey} onChange={(event) => setAccessKey(event.target.value.replace(/\D/g, '').slice(0, 50))} readOnly={mode === 'signup'} inputMode="numeric" maxLength={50} placeholder="enter your private key" className="h-12 border-white/10 bg-white/[0.04] pr-12 font-mono text-sm tracking-[0.12em] text-white placeholder:font-sans placeholder:tracking-normal placeholder:text-white/20" data-testid="input-access-key" />
                  {mode === 'signup' && <button type="button" onClick={copyKey} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 transition hover:text-white" aria-label="Copy generated access key" data-testid="button-copy-access-key">{copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}</button>}
                </div>
              </label>
              {mode === 'signup' && <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.07] px-3 py-3 text-xs leading-5 text-white/50"><KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>Save this generated key. It is the only way back into your mailbox.</span></div>}
              {captchaField('auth-captcha-answer')}
              {error && <p className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary" data-testid="status-auth-error">{error}</p>}
              <Button type="submit" disabled={pending || !captcha || captchaWorkNonce === null} className="h-12 w-full rounded-xl font-semibold" data-testid="button-submit-auth">{pending ? 'Opening secure channel…' : adminLogin ? 'Verify admin access' : mode === 'signin' ? 'Enter mailbox' : 'Create private mailbox'}{!pending && <ArrowRight className="h-4 w-4" />}</Button>
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
            <Button type="submit" disabled={pending || !captcha || captchaWorkNonce === null} className="h-12 w-full rounded-xl font-semibold" data-testid="button-login-file"><Upload className="h-4 w-4" /> {pending ? 'Opening secure channel…' : 'Unlock key file'}</Button>
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
                  <Button type="submit" disabled={!codeInput.trim() || !captcha || captchaWorkNonce === null} className="h-12 w-full rounded-xl font-semibold">Continue <ArrowRight className="h-4 w-4" /></Button>
                </form>
              </>
            )}
          </section>
        </div>
      )}
      <AnimatePresence>
        {desktopPromoOpen && !adminLogin && mode !== 'file' && (
          <motion.div
            key="desktop-app-promo-backdrop"
            className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/75 px-4 py-7 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.24 }}
            onClick={() => setDesktopPromoOpen(false)}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="desktop-promo-title"
              aria-describedby="desktop-promo-description"
              data-testid="dialog-desktop-app-promo"
              className="relative w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#11100f]/95 text-[#f3f0ed] shadow-[0_38px_140px_rgba(0,0,0,.7)]"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 26, scale: 0.96, rotateX: -4 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.98 }}
              transition={reduceMotion
                ? { duration: 0.12 }
                : { type: 'spring', stiffness: 240, damping: 25 }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setDesktopPromoOpen(false)}
                className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/35 text-white/55 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Close desktop app promotion"
                data-testid="button-close-desktop-promo"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="grid md:grid-cols-[1.02fr_.98fr]">
                <div className="relative z-[1] flex flex-col justify-center p-6 sm:p-9 md:p-10">
                  <div className="flex items-center gap-3">
                    <img
                      src="/images/moraltown-brand.png"
                      alt="MoralTown"
                      className="h-14 w-14 rounded-2xl border border-white/10 bg-black object-contain"
                    />
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-[.22em] text-primary">MoralTown Mail</p>
                      <p className="mt-1 text-xs text-white/45">Windows desktop companion</p>
                    </div>
                  </div>
                  <p className="mt-8 font-mono text-[10px] uppercase tracking-[.22em] text-white/40">Your inbox, at your desk</p>
                  <h2 id="desktop-promo-title" className="mt-3 max-w-lg font-display text-4xl leading-[.98] tracking-[-.055em] sm:text-5xl">
                    Mail that feels like yours.
                  </h2>
                  <p id="desktop-promo-description" className="mt-4 max-w-md text-sm leading-6 text-white/55">
                    Take MoralTown Mail to your Windows desktop. Your access key still opens your mailbox.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="rounded-full border border-primary/20 bg-primary/[.08] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[.12em] text-primary">Windows · 134 MB</span>
                    <span className="rounded-full border border-white/10 bg-white/[.035] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[.12em] text-white/55">Encrypted at rest</span>
                  </div>
                  <div className="mt-7 flex flex-col gap-2 sm:flex-row">
                    <a
                      href="/api/download/desktop"
                      download="MoralTownMailSetup.exe"
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#11100f]"
                      data-testid="button-download-desktop-promo"
                    >
                      <Download className="h-4 w-4" /> Download for Windows
                    </a>
                    <button
                      type="button"
                      onClick={() => setDesktopPromoOpen(false)}
                      className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 px-5 py-3 text-sm text-white/65 transition hover:bg-white/[.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                      data-testid="button-dismiss-desktop-promo"
                    >
                      Continue in webmail
                    </button>
                  </div>
                  <p className="mt-5 font-mono text-[9px] uppercase tracking-[.16em] text-white/35">Built and owned by the MoralTown group</p>
                </div>

                <div className="relative flex min-h-[300px] items-center justify-center overflow-hidden border-t border-white/[.07] bg-[radial-gradient(ellipse_at_72%_22%,rgba(221,56,56,.25),transparent_47%),linear-gradient(145deg,#171414,#0a0a0a_72%)] p-6 sm:min-h-[360px] sm:p-9 md:border-l md:border-t-0">
                  <div className="pointer-events-none absolute -right-20 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full border border-primary/15" />
                  <div className="pointer-events-none absolute -right-12 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full border border-primary/15" />
                  <div className="relative w-full max-w-[390px] -rotate-2 rounded-2xl border border-white/15 bg-[#0d0d0d]/90 p-3 shadow-[0_30px_80px_rgba(0,0,0,.55)]">
                    <div className="flex items-center justify-between border-b border-white/[.08] px-2 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_16px_rgba(221,56,56,.7)]" />
                        <span className="font-display text-xs tracking-tight">MoralTown Mail</span>
                      </div>
                      <div className="flex gap-1.5" aria-hidden="true">
                        <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                        <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                        <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                      </div>
                    </div>
                    <div className="grid grid-cols-[88px_1fr] gap-3 pt-3">
                      <div className="space-y-2 border-r border-white/[.07] pr-3 font-mono text-[8px] uppercase tracking-[.08em] text-white/35">
                        <p className="rounded-md bg-primary/10 px-2 py-2 text-primary">Inbox</p>
                        <p className="px-2 py-1">Sent</p>
                        <p className="px-2 py-1">Projects</p>
                        <p className="px-2 py-1">Drafts</p>
                      </div>
                      <div className="space-y-2">
                        <div className="rounded-xl border border-primary/20 bg-primary/[.06] p-3">
                          <p className="font-mono text-[8px] uppercase tracking-[.14em] text-primary">Private inbox</p>
                          <p className="mt-2 text-sm font-semibold">Welcome to MoralTown</p>
                          <p className="mt-1 text-[10px] text-white/40">Your mailbox is ready.</p>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl border border-white/[.07] p-3">
                          <span className="grid h-7 w-7 place-items-center rounded-full bg-white/[.06] text-[9px] font-semibold text-white/60">R</span>
                          <div className="min-w-0">
                            <p className="truncate text-[10px] font-medium">A note for today</p>
                            <p className="mt-1 truncate text-[9px] text-white/35">Filed in Projects</p>
                          </div>
                          <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-white/[.07] px-1 pt-3 font-mono text-[8px] uppercase tracking-[.12em] text-white/35">
                      <span>Key-based access</span><span className="text-primary">Workspace ready</span>
                    </div>
                  </div>
                  <span className="absolute bottom-5 left-5 rounded-full border border-white/10 bg-black/65 px-3 py-1.5 font-mono text-[8px] uppercase tracking-[.15em] text-white/55 backdrop-blur">
                    A quieter desktop
                  </span>
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
      <LanguagePicker placement="fixed" />
    </main>
  );
}