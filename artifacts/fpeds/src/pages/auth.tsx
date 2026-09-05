import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Copy, KeyRound, LockKeyhole } from "lucide-react";
import { useSignIn, useSignUp } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function generateAccessKey() {
  const digits = new Uint32Array(50);
  crypto.getRandomValues(digits);
  return Array.from(digits, (digit) => String(digit % 10)).join("");
}

function previewUsername(username: string) {
  return username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "") || "yourname";
}

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [accessKey, setAccessKey] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const signIn = useSignIn();
  const signUp = useSignUp();
  const pending = signIn.isPending || signUp.isPending;

  const openMode = (nextMode: "signin" | "signup") => {
    setMode(nextMode);
    setError("");
    setCopied(false);
    if (nextMode === "signup" && !accessKey) setAccessKey(generateAccessKey());
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (accessKey.length !== 50) {
      setError("Your access key must be exactly 50 characters.");
      return;
    }
    if (mode === "signin") {
      signIn.mutate(
        { data: { accessKey } },
        {
          onSuccess: () => setLocation("/inbox"),
          onError: () => setError("That access key was not accepted. Check it and try again."),
        },
      );
      return;
    }
    if (!username.trim() || !/[a-z]/i.test(username)) {
      setError("Choose a username with at least one letter.");
      return;
    }
    signUp.mutate(
      { data: { accessKey, username: username.trim() } },
      {
        onSuccess: () => setLocation("/inbox"),
        onError: () => setError("We could not create this account. The key may already be in use."),
      },
    );
  };

  const copyKey = async () => {
    await navigator.clipboard.writeText(accessKey);
    setCopied(true);
  };

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#090909] px-4 text-[#f3f0ed]">
      <div className="pointer-events-none absolute -right-28 -top-36 h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -left-36 h-[520px] w-[520px] rounded-full bg-white/[0.03] blur-3xl" />
      <section className="relative w-full max-w-[440px] animate-enter">
        <div className="mb-8">
          <h1 className="font-display text-[3.2rem] leading-none tracking-[-0.04em] sm:text-[3.65rem]">
            {mode === "signin" ? "Welcome back." : "Create account."}
          </h1>
          <p className="mt-5 text-sm leading-6 text-white/45">
            {mode === "signin"
              ? "Use the key you were given to enter your mailbox."
              : "Generate your private key, then choose the name people will email."}
          </p>
        </div>

        <div className="mb-6 flex rounded-2xl border border-white/10 bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => openMode("signin")}
            className={`flex-1 rounded-xl py-2.5 text-sm transition ${
              mode === "signin" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/70"
            }`}
            data-testid="button-mode-signin"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => openMode("signup")}
            className={`flex-1 rounded-xl py-2.5 text-sm transition ${
              mode === "signup" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/70"
            }`}
            data-testid="button-mode-signup"
          >
            Create account
          </button>
        </div>

        <form onSubmit={submit} className="space-y-5">
          {mode === "signup" && (
            <label className="block">
              <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
                Username
              </span>
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                maxLength={40}
                placeholder="your name"
                className="h-12 border-white/10 bg-white/[0.04] text-white placeholder:text-white/20"
                data-testid="input-username"
              />
              <p className="mt-2 font-mono text-[10px] text-white/35">
                Your mailbox will be <span className="text-white/65">{previewUsername(username)}@fraud.jo3.org</span>
              </p>
            </label>
          )}

          <label className="block">
            <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
              50-character access key
            </span>
            <div className="relative">
              <Input
                value={accessKey}
                onChange={(event) => setAccessKey(event.target.value.replace(/\D/g, "").slice(0, 50))}
                readOnly={mode === "signup"}
                inputMode="numeric"
                maxLength={50}
                placeholder="enter your private key"
                className="h-12 border-white/10 bg-white/[0.04] pr-12 font-mono text-sm tracking-[0.12em] text-white placeholder:font-sans placeholder:tracking-normal placeholder:text-white/20"
                data-testid="input-access-key"
              />
              {mode === "signup" && (
                <button
                  type="button"
                  onClick={copyKey}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 transition hover:text-white"
                  aria-label="Copy generated access key"
                >
                  {copied ? <span className="font-mono text-[10px] text-primary">COPIED</span> : <Copy className="h-4 w-4" />}
                </button>
              )}
            </div>
          </label>

          {mode === "signup" && (
            <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.07] px-3 py-3 text-xs leading-5 text-white/50">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>Save this generated key. It is the only way back into your mailbox.</span>
            </div>
          )}

          {error && (
            <p className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary" data-testid="status-auth-error">
              {error}
            </p>
          )}

          <Button type="submit" disabled={pending} className="h-12 w-full rounded-xl font-semibold" data-testid="button-submit-auth">
            {pending ? "Opening secure channel…" : mode === "signin" ? "Enter mailbox" : "Create private mailbox"}
            {!pending && <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>

        <div className="mt-9 flex items-start gap-3 border-t border-white/10 pt-5 text-xs leading-5 text-white/35">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" />
          <span>Access keys are never shown again. FPEDS does not use password recovery or behavioral tracking.</span>
        </div>
      </section>
    </main>
  );
}