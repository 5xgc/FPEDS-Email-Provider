import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, LoaderCircle, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { syncDocumentPreferences, writePreference } from '@/lib/preferences';

const TOKEN_KEY = 'moraltown:deletion-token';
const DEADLINE_KEY = 'moraltown:deletion-deadline';

type DeletionProgress = {
  token: string;
  completesAt: number;
};

function readStoredProgress(): DeletionProgress | null {
  try {
    const token = window.sessionStorage.getItem(TOKEN_KEY);
    const completesAt = Number(window.sessionStorage.getItem(DEADLINE_KEY));
    return token && Number.isFinite(completesAt) && completesAt > 0
      ? { token, completesAt }
      : null;
  } catch {
    return null;
  }
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remaining = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remaining}`;
}

function clearStoredProgress() {
  try {
    window.sessionStorage.removeItem(TOKEN_KEY);
    window.sessionStorage.removeItem(DEADLINE_KEY);
  } catch {
    // In-memory progress still works for the open page.
  }
}

export function AccountDeletionSettings() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [accessKey, setAccessKey] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletion, setDeletion] = useState<DeletionProgress | null>(readStoredProgress);
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    deletion ? Math.max(0, deletion.completesAt - Math.floor(Date.now() / 1000)) : 240,
  );
  const [checksDone, setChecksDone] = useState(0);
  const [complete, setComplete] = useState(false);
  const [connectionIssue, setConnectionIssue] = useState(false);

  useEffect(() => {
    if (!deletion) return;
    let active = true;

    const checkStatus = async () => {
      try {
        const response = await fetch('/api/account/deletion/status', {
          headers: { Authorization: `Bearer ${deletion.token}` },
          cache: 'no-store',
        });
        if (!response.ok || !active) return;
        const status = await response.json() as {
          status?: string;
          remainingSeconds?: number;
          checksDone?: number;
        };
        if (status.status === 'complete') {
          setComplete(true);
          setRemainingSeconds(0);
          setConnectionIssue(false);
          clearStoredProgress();
          return;
        }
        setChecksDone(status.checksDone ?? 0);
        setRemainingSeconds(status.remainingSeconds ?? 0);
        setConnectionIssue(false);
      } catch {
        if (active) setConnectionIssue(true);
      }
    };

    const tick = window.setInterval(() => {
      const seconds = Math.max(0, deletion.completesAt - Math.floor(Date.now() / 1000));
      setRemainingSeconds(seconds);
      if (seconds === 0 || seconds % 5 === 0) void checkStatus();
    }, 1000);
    void checkStatus();
    return () => {
      active = false;
      window.clearInterval(tick);
    };
  }, [deletion]);

  const startDeletion = async () => {
    setError('');
    setSubmitting(true);
    try {
      const response = await fetch('/api/account/deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ accessKey }),
      });
      const result = await response.json() as {
        error?: string;
        deletionToken?: string;
        completesAt?: number;
      };
      if (!response.ok || !result.deletionToken || !result.completesAt) {
        throw new Error(result.error || 'Account deletion could not be started.');
      }

      const progress = { token: result.deletionToken, completesAt: result.completesAt };
      try {
        window.sessionStorage.setItem(TOKEN_KEY, progress.token);
        window.sessionStorage.setItem(DEADLINE_KEY, String(progress.completesAt));
      } catch {
        // The countdown continues in memory if this browser blocks session storage.
      }
      window.sessionStorage.removeItem('moraltown-purchase-token');
      window.sessionStorage.removeItem('moraltown-payment-order-id');
      writePreference('privacyMode', false);
      writePreference('reduceMotion', false);
      writePreference('autoSignOut', false);
      syncDocumentPreferences();
      queryClient.clear();
      setAccessKey('');
      setConfirmation('');
      setDeletion(progress);
      setRemainingSeconds(Math.max(0, progress.completesAt - Math.floor(Date.now() / 1000)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Account deletion could not be started.');
    } finally {
      setSubmitting(false);
    }
  };

  if (deletion) {
    return (
      <section className="glass overflow-hidden rounded-3xl border border-primary/35 p-5 sm:p-7" aria-live="polite">
        <div className="mx-auto max-w-xl py-3 text-center">
          {complete ? (
            <CheckCircle2 className="mx-auto h-11 w-11 text-primary" />
          ) : (
            <LoaderCircle className="mx-auto h-11 w-11 animate-spin text-primary" />
          )}
          <p className="mt-5 font-mono text-[10px] uppercase tracking-[.2em] text-primary">
            {complete ? 'Account removed' : 'Final account cleanup'}
          </p>
          <h2 className="mt-2 font-display text-3xl tracking-[-.04em]">
            {complete ? 'Deletion complete.' : 'Your account is being removed.'}
          </h2>
          {complete ? (
            <>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                The app has finished its account-data checks. Provider copies, platform logs,
                and public payment-network records are outside this cleanup.
              </p>
              <Button className="mt-6" onClick={() => setLocation('/auth?mode=signup')}>
                Return to MoralTown
              </Button>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Access has been revoked. Messages, folders, notifications, subscriptions,
                and account credentials were cleared when this request began. The server
                will repeat its account-linked database checks, then remove the temporary record.
              </p>
              <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-white/10 bg-black/25 p-5">
                <p className="font-mono text-4xl tabular-nums text-foreground" aria-label={`${remainingSeconds} seconds remaining`}>
                  {formatCountdown(remainingSeconds)}
                </p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-1000"
                    style={{ width: `${Math.min(100, Math.max(0, ((240 - remainingSeconds) / 240) * 100))}%` }}
                  />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {checksDone} database checks completed
                </p>
              </div>
              {connectionIssue && (
                <p className="mt-4 text-xs text-primary" role="status">
                  The status check is offline. Deletion continues on the server; this screen will update when it reconnects.
                </p>
              )}
              <p className="mt-5 text-xs leading-5 text-muted-foreground">
                This countdown verifies records in MoralTown’s database. It does not delete
                copies held by email providers, hosting/platform logs, or public payment networks.
              </p>
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="glass overflow-hidden rounded-3xl border border-primary/30">
      <div className="border-b border-white/[.08] p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[.2em] text-primary">Permanent action</p>
            <h2 className="mt-2 font-display text-2xl tracking-[-.03em]">Kill switch</h2>
            <p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">
              Revoke access and permanently erase account data stored by this app.
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        {!expanded ? (
          <Button
            variant="outline"
            onClick={() => setExpanded(true)}
            className="border-primary/40 bg-primary/[.06] text-primary hover:bg-primary/10"
            data-testid="button-review-account-deletion"
          >
            <AlertTriangle className="h-4 w-4" /> Review permanent deletion
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-primary/25 bg-primary/[.06] p-4 text-xs leading-5">
              <p className="font-semibold text-foreground">What happens when you start:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                <li>Access is revoked immediately; this account cannot be restored or signed into.</li>
                <li>Messages, folders, notifications, subscriptions, account keys, and stored contact emails are erased or scrubbed from this service.</li>
                <li>The server checks for remaining account-linked rows for four minutes, then removes its temporary deletion record.</li>
              </ul>
              <p className="mt-3 text-muted-foreground">
                This cannot erase messages already delivered to other mailboxes, copies kept by mail or hosting providers,
                platform/security logs, or public blockchain payment records. Non-identifying payment settlement details may be retained.
              </p>
              <p className="mt-3 font-semibold text-primary">There is no cancel or restore after deletion begins.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="delete-access-key" className="text-xs font-medium">Current 50-digit access key</label>
                <Input
                  id="delete-access-key"
                  type="password"
                  autoComplete="current-password"
                  inputMode="numeric"
                  maxLength={50}
                  value={accessKey}
                  onChange={(event) => setAccessKey(event.target.value)}
                  placeholder="Enter your access key"
                  className="bg-white/[.04]"
                  data-testid="input-delete-access-key"
                />
                <p className="text-[11px] text-muted-foreground">Required to confirm it is you. The key is sent only in the protected request body.</p>
              </div>
              <div className="space-y-2">
                <label htmlFor="delete-confirmation" className="text-xs font-medium">Type DELETE to confirm</label>
                <Input
                  id="delete-confirmation"
                  autoComplete="off"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder="DELETE"
                  className="bg-white/[.04]"
                  data-testid="input-delete-confirmation"
                />
                <p className="text-[11px] text-muted-foreground">This starts the irreversible four-minute cleanup.</p>
              </div>
            </div>

            {error && <p className="text-sm text-primary" role="alert">{error}</p>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setExpanded(false)} disabled={submitting}>
                Go back
              </Button>
              <Button
                onClick={startDeletion}
                disabled={submitting || !/^\d{50}$/.test(accessKey) || confirmation !== 'DELETE'}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="button-start-account-deletion"
              >
                {submitting ? 'Starting deletion…' : 'Delete account permanently'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}