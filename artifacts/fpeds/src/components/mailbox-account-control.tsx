import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, Plus, UserRound, Users, X } from 'lucide-react';
import {
  getGetCurrentUserQueryKey,
  getListMailboxAccountsQueryKey,
  useCreateMailboxAccount,
  useListMailboxAccounts,
  useSwitchMailboxAccount,
  type MailboxAccount,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === 'object' && 'error' in data) {
      return String((data as { error?: unknown }).error ?? fallback);
    }
  }
  return fallback;
}

export function MailboxAccountControl({ isAdmin = false }: { isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'accounts' | 'manage'>('accounts');
  const [emailName, setEmailName] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const client = useQueryClient();
  const accounts = useListMailboxAccounts({
    query: { queryKey: getListMailboxAccountsQueryKey(), enabled: !isAdmin },
  });
  const createMailbox = useCreateMailboxAccount();
  const switchMailbox = useSwitchMailboxAccount();
  const currentAccount = (accounts.data ?? []).find((account) => account.isCurrent);
  const domain = currentAccount?.email.split('@')[1] ?? 'fpdf.2bd.net';

  const close = () => {
    setOpen(false);
    setView('accounts');
    setError('');
    setNotice('');
  };

  const selectMailbox = (mailbox: MailboxAccount) => {
    if (mailbox.isCurrent || switchMailbox.isPending) return;
    setError('');
    switchMailbox.mutate(
      { data: { mailboxId: mailbox.id } },
      {
        onSuccess: (result) => {
          client.clear();
          client.setQueryData(getGetCurrentUserQueryKey(), result.user);
          close();
        },
        onError: (cause) => setError(errorMessage(cause, 'Could not switch mailboxes. Try again.')),
      },
    );
  };

  const addMailbox = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');
    const name = emailName.trim().toLowerCase();
    if (!name) {
      setError('Enter the name to use before the @ sign.');
      return;
    }
    createMailbox.mutate(
      { data: { name } },
      {
        onSuccess: (mailbox) => {
          setEmailName('');
          setNotice(`${mailbox.email} is ready. Sign in with your existing access key.`);
          client.invalidateQueries({ queryKey: getListMailboxAccountsQueryKey() });
        },
        onError: (cause) => setError(errorMessage(cause, 'Could not create this mailbox. Try another name.')),
      },
    );
  };

  if (isAdmin) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setView('accounts'); }}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        data-testid="button-open-account"
      >
        <UserRound className="h-4 w-4" /> Account
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/65 px-4 py-8 backdrop-blur-md"
          onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
          data-testid="overlay-mailbox-account"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="mailbox-account-title"
            className="glass relative w-full max-w-md overflow-hidden rounded-3xl border border-white/12 bg-[#100f0f]/90 shadow-[0_28px_100px_rgba(0,0,0,.62)] backdrop-blur-2xl animate-enter"
            data-testid="dialog-mailbox-account"
          >
            <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
              <div className="flex items-start gap-3">
                {view === 'manage' && (
                  <button
                    type="button"
                    onClick={() => { setView('accounts'); setError(''); setNotice(''); }}
                    className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-white/[.06] hover:text-foreground"
                    aria-label="Back to accounts"
                    data-testid="button-back-account-list"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[.2em] text-primary">
                    {view === 'accounts' ? 'Signed-in identity' : 'Mailbox management'}
                  </p>
                  <h2 id="mailbox-account-title" className="mt-2 font-display text-2xl">
                    {view === 'accounts' ? 'Account' : 'Manage account'}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:bg-white/[.06] hover:text-foreground"
                aria-label="Close account window"
                data-testid="button-close-account"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {view === 'accounts' ? (
              <div className="p-5 sm:p-6">
                <p className="mb-3 font-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground">
                  Your mailboxes
                </p>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {accounts.isLoading ? (
                    <p className="rounded-xl border border-white/[.07] px-4 py-4 text-sm text-muted-foreground">Loading account…</p>
                  ) : (accounts.data ?? []).map((mailbox) => (
                    <button
                      key={mailbox.id}
                      type="button"
                      disabled={mailbox.isCurrent || switchMailbox.isPending}
                      onClick={() => selectMailbox(mailbox)}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                        mailbox.isCurrent
                          ? 'border-primary/35 bg-primary/[.08]'
                          : 'border-white/[.07] bg-white/[.025] hover:border-white/20 hover:bg-white/[.05]'
                      }`}
                      data-testid={`button-select-mailbox-${mailbox.id}`}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[.06] text-primary">
                        {mailbox.isCurrent ? <Check className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span data-private-email className="block truncate text-sm font-semibold text-foreground">{mailbox.email}</span>
                        <span className="mt-1 block text-[10px] text-muted-foreground">{mailbox.isCurrent ? 'Current mailbox' : 'Switch to this mailbox'}</span>
                      </span>
                      {mailbox.isCurrent && <Check className="h-4 w-4 shrink-0 text-primary" aria-label="Selected" />}
                    </button>
                  ))}
                  {!accounts.isLoading && accounts.data?.length === 0 && (
                    <p className="rounded-xl border border-white/[.07] px-4 py-4 text-sm text-muted-foreground">No mailboxes were found.</p>
                  )}
                </div>
                {error && <p role="alert" className="mt-3 rounded-xl border border-primary/25 bg-primary/[.08] px-3 py-2 text-xs text-primary" data-testid="status-account-error">{error}</p>}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setView('manage'); setError(''); }}
                  className="mt-5 h-11 w-full border-white/15 bg-white/[.035]"
                  data-testid="button-manage-account"
                >
                  <Users className="h-4 w-4" /> Manage account
                </Button>
                <p className="mt-3 text-center text-[10px] leading-5 text-muted-foreground">
                  All mailboxes here use this account’s original access key.
                </p>
              </div>
            ) : (
              <form onSubmit={addMailbox} className="p-5 sm:p-6">
                <p className="text-sm leading-6 text-muted-foreground">
                  Create another address under the same access key. Enter only the name before the @ sign.
                </p>
                <label className="mt-5 block">
                  <span className="mb-2 block font-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground">Email name</span>
                  <div className="flex min-w-0 items-center rounded-xl border border-white/10 bg-white/[.035] px-3 focus-within:border-primary/50">
                    <Input
                      value={emailName}
                      onChange={(event) => setEmailName(event.target.value.replace(/[^a-z0-9._-]/gi, '').slice(0, 40))}
                      maxLength={40}
                      autoComplete="off"
                      placeholder="another.name"
                      className="h-11 min-w-0 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                      data-testid="input-new-mailbox-name"
                    />
                    <span className="shrink-0 text-xs text-muted-foreground">@{domain}</span>
                  </div>
                </label>
                {emailName && <p data-private-email className="mt-2 break-all font-mono text-[10px] text-foreground/55">{emailName.toLowerCase()}@{domain}</p>}
                {error && <p role="alert" className="mt-3 rounded-xl border border-primary/25 bg-primary/[.08] px-3 py-2 text-xs text-primary" data-testid="status-account-error">{error}</p>}
                {notice && <p role="status" className="mt-3 rounded-xl border border-emerald-300/15 bg-emerald-300/[.05] px-3 py-2 text-xs text-emerald-200" data-testid="status-account-created">{notice}</p>}
                <Button type="submit" disabled={!emailName.trim() || createMailbox.isPending} className="mt-5 h-11 w-full" data-testid="button-create-mailbox">
                  <Plus className="h-4 w-4" /> {createMailbox.isPending ? 'Creating mailbox…' : 'Create mailbox'}
                </Button>
                <p className="mt-3 text-center text-[10px] leading-5 text-muted-foreground">You can switch to new addresses from the Account menu.</p>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
