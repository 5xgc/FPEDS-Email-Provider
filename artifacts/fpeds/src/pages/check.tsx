import { useCallback, useEffect, useState } from 'react';
import { useGetCurrentUser } from '@workspace/api-client-react';
import { AlertTriangle, Check, CircleX, LockKeyhole, RefreshCw, ShieldCheck, Workflow } from 'lucide-react';
import { MailShell } from '@/components/mail-shell';
import { Button } from '@/components/ui/button';

type SecurityCheck = {
  mailboxReady: boolean;
  lockdown: boolean;
  lockdownMessage: string;
  apiPaused: boolean;
  announcement: { message: string; updatedAt: string } | null;
  warnings: string[];
  services: Array<{ id: string; name: string; active: boolean; required?: boolean; statusKind?: string; detail: string }>;
  routes: Array<{ path: string; methods: string[]; active: boolean }>;
};
async function getCheck(): Promise<SecurityCheck> {
  const response = await fetch('/api/security/check', { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (typeof body?.message === 'string') message = body.message;
      else if (typeof body?.error === 'string') message = body.error;
    } catch { /* HTTP status is sufficient when no JSON error body is available. */ }
    throw new Error(message);
  }
  return response.json() as Promise<SecurityCheck>;
}

function StatusBadge({ active, label }: { active: boolean; label?: string }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.12em] ${active ? 'border-emerald-400/20 bg-emerald-400/[.08] text-emerald-200' : 'border-primary/30 bg-primary/[.08] text-primary'}`}>
    {active ? <Check className="h-3 w-3" /> : <CircleX className="h-3 w-3" />}{label ?? (active ? 'Active' : 'Unavailable')}
  </span>;
}

export default function CheckPage() {
  const currentUser = useGetCurrentUser();
  const [check, setCheck] = useState<SecurityCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try { setCheck(await getCheck()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load security status.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);
  const unavailable = check ? check.services.filter((service) => !service.active) : [];
  const unavailableRequired = unavailable.filter((service) => service.required !== false);
  const notReady = Boolean(check && (!check.mailboxReady || check.lockdown || check.apiPaused || unavailableRequired.length > 0));
  const encryptionServices = check?.services.filter((service) => /encrypt|crypto|key/i.test(`${service.id} ${service.name}`)) ?? [];
  const mailServices = check?.services.filter((service) => /mail|smtp|inbound|outbound|delivery|send|receive/i.test(`${service.id} ${service.name}`)) ?? [];
  const hasEncryptionDown = encryptionServices.some((service) => !service.active);
  const hasMailDown = mailServices.some((service) => !service.active);

  return <MailShell>
    <div className="mx-auto w-full max-w-[1120px] px-3 pb-10 pt-4 sm:px-6 md:px-8">
      <header className="animate-enter mb-6 flex flex-col justify-between gap-5 sm:mb-8 sm:flex-row sm:items-end">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.22em] text-primary"><LockKeyhole className="h-3.5 w-3.5" /> Security & availability</p>
          <h1 className="mt-2 font-display text-4xl tracking-[-.055em] sm:text-6xl">System check<span className="text-primary">.</span></h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">A live view of mailbox readiness, service dependencies, and registered API routes. No configuration values or message contents are exposed.</p>
        </div>
        <Button variant="outline" onClick={() => { setLoading(true); void load(); }} disabled={loading} className="w-full border-white/15 bg-white/[.03] sm:w-auto">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh status
        </Button>
      </header>
      {currentUser.isError && <p className="mb-4 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-xs text-muted-foreground">Account role could not be verified. Security status remains available to the signed-in session.</p>}

      {error ? <section role="alert" className="glass rounded-2xl border border-primary/25 p-6 sm:p-8">
        <div className="flex items-start gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10"><AlertTriangle className="h-5 w-5 text-primary" /></span>
          <div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-primary">Status unavailable</p><h2 className="mt-2 font-display text-2xl">Could not reach security checks</h2><p className="mt-2 text-sm text-muted-foreground">{error}</p><Button onClick={() => { setLoading(true); void load(); }} className="mt-5">Retry checks</Button></div>
        </div>
      </section> : loading && !check ? <div aria-busy="true" aria-label="Loading security checks" className="space-y-4">
        <div className="glass h-40 animate-pulse rounded-2xl" /><div className="grid gap-4 md:grid-cols-2"><div className="glass h-64 animate-pulse rounded-2xl" /><div className="glass h-64 animate-pulse rounded-2xl" /></div>
      </div> : check && <>
        <section aria-live="polite" className={`animate-enter mb-4 overflow-hidden rounded-2xl border ${notReady ? 'border-primary/40 bg-primary/[.08]' : 'border-white/10 bg-white/[.035]'}`}>
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-7">
            <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${notReady ? 'bg-primary/15 text-primary' : 'bg-white/[.06] text-foreground'}`}>
              {notReady ? <AlertTriangle className="h-7 w-7" /> : <ShieldCheck className="h-7 w-7" />}
            </div>
            <div className="min-w-0 flex-1"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Mailbox readiness</p>
              <h2 className="mt-1 font-display text-3xl tracking-[-.04em]">{notReady ? 'Do not use the mailbox' : 'Required checks are active'}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{notReady
                ? 'One or more required protections or delivery services are unavailable. Wait until all required checks are active before using the mailbox.'
                : 'The reported service and encryption checks are active and the mailbox is ready.'}</p>
            </div>
            <span className={`shrink-0 rounded-full border px-3 py-2 font-mono text-[9px] uppercase tracking-[.14em] ${notReady ? 'border-primary/35 bg-primary/10 text-primary' : 'border-white/15 bg-white/[.04] text-foreground'}`}>{notReady ? 'Action required' : 'Ready'}</span>
          </div>
          {(check.lockdown || check.apiPaused) && <div className="flex flex-col gap-2 border-t border-primary/20 bg-primary/[.06] px-5 py-3 text-xs text-foreground sm:flex-row sm:items-center">
            <LockKeyhole className="h-4 w-4 shrink-0 text-primary" /><span>{check.lockdown ? `Lockdown is active${check.lockdownMessage ? `: ${check.lockdownMessage}` : '.'}` : ''}{check.lockdown && check.apiPaused ? ' ' : ''}{check.apiPaused ? 'API traffic is paused.' : ''}</span>
          </div>}
        </section>

        {check.announcement && <aside className="mb-4 rounded-xl border border-white/10 bg-white/[.025] px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-[.16em] text-primary">Workspace announcement</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{check.announcement.message}</p>
        </aside>}
        {check.warnings.length > 0 && <section className="mb-4 rounded-xl border border-primary/25 bg-primary/[.05] p-4">
          <h2 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.16em] text-primary"><AlertTriangle className="h-4 w-4" /> Warnings</h2>
          <ul className="mt-2 space-y-2">{check.warnings.map((warning, index) => <li key={`${index}-${warning}`} className="flex gap-2 text-sm leading-5 text-foreground/85"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />{warning}</li>)}</ul>
        </section>}
          {(hasMailDown || hasEncryptionDown || unavailableRequired.length > 0) && <div role="alert" className="mb-4 rounded-xl border border-primary/35 bg-primary/[.09] p-4 text-sm leading-6">
            <strong className="text-primary">DO NOT USE THE MAILBOX.</strong> {hasMailDown && 'Mail integrations are unavailable.'}{hasMailDown && hasEncryptionDown ? ' ' : ''}{hasEncryptionDown && 'Encryption service is unavailable.'}{unavailableRequired.length > 0 && ` ${unavailableRequired.length} required protection or service check${unavailableRequired.length === 1 ? ' is' : 's are'} unavailable.`} Wait for all required checks to return active.
        </div>}

        <div className="grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
          <section className="glass overflow-hidden rounded-2xl border border-white/10">
            <div className="flex items-center gap-3 border-b border-white/10 p-4 sm:p-5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10"><ShieldCheck className="h-4 w-4 text-primary" /></span><div><p className="font-mono text-[9px] uppercase tracking-[.17em] text-muted-foreground">Dependencies</p><h2 className="font-display text-2xl">Required services</h2></div></div>
            {!check.services.length ? <div className="p-8 text-center"><p className="text-sm text-muted-foreground">No service checks were returned.</p><p className="mt-1 text-xs text-muted-foreground">Mailbox readiness cannot be confirmed without service status.</p></div> :
              <ul className="divide-y divide-white/[.07]">{check.services.map((service) => <li key={service.id} className="flex gap-3 p-4 sm:px-5">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${service.active ? 'bg-emerald-300' : 'bg-primary'}`} aria-hidden="true" />
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{service.name}</h3><StatusBadge active={service.active} label={service.active && service.statusKind === 'configuration' ? 'Configured' : undefined} /></div>
                  <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{service.detail || 'No additional status detail provided.'}</p>
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground/70">Check: {service.id}</p>
                </div>
              </li>)}</ul>}
            {unavailableRequired.length > 0 && <div className="border-t border-primary/20 bg-primary/[.05] p-4 text-xs leading-5 text-primary">One or more required dependencies are unavailable. DO NOT USE THE MAILBOX until all required integrations and protections are active.</div>}
          </section>

          <section className="glass overflow-hidden rounded-2xl border border-white/10">
            <div className="flex items-center gap-3 border-b border-white/10 p-4 sm:p-5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.05]"><Workflow className="h-4 w-4 text-foreground" /></span><div><p className="font-mono text-[9px] uppercase tracking-[.17em] text-muted-foreground">API surface</p><h2 className="font-display text-2xl">Registered routes</h2></div></div>
            {!check.routes.length ? <div className="p-8 text-center"><p className="text-sm text-muted-foreground">No route checks were returned.</p></div> :
              <div className="max-h-[520px] overflow-auto"><table className="w-full min-w-[420px] border-collapse text-left">
                <thead className="sticky top-0 bg-[#111]"><tr className="font-mono text-[9px] uppercase tracking-[.13em] text-muted-foreground"><th className="px-4 py-3 font-normal">Route</th><th className="px-3 py-3 font-normal">Methods</th><th className="px-4 py-3 text-right font-normal">State</th></tr></thead>
                <tbody className="divide-y divide-white/[.07]">{check.routes.map((route) => <tr key={`${route.path}-${route.methods.join(',')}`} className="hover:bg-white/[.025]">
                  <td className="max-w-[190px] break-all px-4 py-3 font-mono text-[11px] text-foreground/90">{route.path}</td>
                  <td className="px-3 py-3"><div className="flex max-w-[140px] flex-wrap gap-1">{route.methods.map((method) => <span key={method} className="rounded-md border border-white/10 bg-white/[.035] px-1.5 py-1 font-mono text-[8px] uppercase tracking-[.08em] text-muted-foreground">{method}</span>)}</div></td>
                  <td className="px-4 py-3 text-right"><StatusBadge active={route.active} /></td>
                </tr>)}</tbody>
              </table></div>}
            <div className="border-t border-white/[.07] px-4 py-3 text-[10px] leading-5 text-muted-foreground">Only routes returned by the authenticated security check are listed.</div>
          </section>
        </div>
         <footer className="mt-5 flex items-start gap-2 text-[11px] leading-5 text-muted-foreground"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> Status refreshes every 30 seconds. No credentials, environment values, or email content are displayed. App-level throttling is not a substitute for an edge DDoS/WAF service; large traffic floods require a provider such as Cloudflare in front of the domain.</footer>
      </>}
    </div>
  </MailShell>;
}
