import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useGetCurrentUser } from '@workspace/api-client-react';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Check, ChevronDown, CircleHelp,
  LockKeyhole, Megaphone, RefreshCw, Shield, ShieldCheck, ToggleLeft, Users,
} from 'lucide-react';
import { MailShell } from '@/components/mail-shell';
import { Button } from '@/components/ui/button';
import { getCurrentLocale } from '@/lib/language';

type Overview = {
  totals: { users: number; sentToday: number; receivedToday: number };
  series: { accounts: Array<{ date: string; count: number }>; messages: Array<{ date: string; count: number }> };
  controls: {
    lockdown: boolean; lockdownMessage: string; apiPaused: boolean; apiPausedUntil: string | null;
    sendingEnabled: boolean; sendingEnabledUntil: string | null;
    receivingEnabled: boolean; receivingEnabledUntil: string | null;
  };
  announcement: { message: string; updatedAt: string } | null;
  audit: Array<{ action: string; actor: string; createdAt: string }>;
  traffic: {
    requestsSinceStart: number; rateLimitedSinceStart: number; startedAt: number;
    topRoutes: Array<{ method: string; path: string; count: number }>;
  };
};
type User = { id: string; username: string; role: string; createdAt: string };
type ApiError = { message: string };
const roles = ['user', 'soldier', 'moraltown', 'admin', 'co_founder', 'og', 'fed'];

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (typeof body?.message === 'string') detail = body.message;
      else if (typeof body?.error === 'string') detail = body.error;
    } catch { /* Use the HTTP status when the server has no readable error body. */ }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}
const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(getCurrentLocale(), { month: 'short', day: 'numeric' }).format(date);
};
const dateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(getCurrentLocale(), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
};

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`glass rounded-2xl border border-white/10 ${className}`}>{children}</section>;
}
function Chart({ title, points, accent = false }: { title: string; points: Array<{ date: string; count: number }>; accent?: boolean }) {
  const width = 600;
  const height = 148;
  const max = Math.max(1, ...points.map((point) => point.count));
  const values = points.length > 1 ? points : [{ date: '', count: 0 }, { date: '', count: points[0]?.count ?? 0 }];
  const coords = values.map((point, index) => ({
    x: 8 + (index / Math.max(1, values.length - 1)) * (width - 16),
    y: height - 12 - (point.count / max) * (height - 28),
  }));
  const line = coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const area = `${line} L ${coords[coords.length - 1]?.x ?? width} ${height} L ${coords[0]?.x ?? 0} ${height} Z`;
  return <div className="min-w-0 p-4 sm:p-5">
    <div className="flex items-center justify-between gap-3">
      <h3 className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">{title}</h3>
      <span className="font-mono text-xs text-foreground">{points.length ? points.reduce((sum, point) => sum + point.count, 0).toLocaleString(getCurrentLocale()) : '—'} <span className="text-muted-foreground">in series</span></span>
    </div>
    {points.length === 0 ? <div className="mt-5 grid h-[148px] place-items-center rounded-xl bg-white/[.025] text-xs text-muted-foreground">No analytics available yet.</div> :
      <div className="mt-3">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} chart`} className="h-[148px] w-full overflow-visible">
          <defs><linearGradient id={accent ? 'red-area' : 'silver-area'} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={accent ? 'hsl(0 78% 55%)' : 'hsl(0 0% 75%)'} stopOpacity=".25" />
            <stop offset="100%" stopColor={accent ? 'hsl(0 78% 55%)' : 'hsl(0 0% 75%)'} stopOpacity="0" />
          </linearGradient></defs>
          {[0, 1, 2].map((row) => <line key={row} x1="0" x2={width} y1={24 + row * 48} y2={24 + row * 48} stroke="hsl(0 0% 100% / .08)" strokeDasharray="3 6" />)}
          <path d={area} fill={`url(#${accent ? 'red-area' : 'silver-area'})`} />
          <path d={line} fill="none" stroke={accent ? 'hsl(0 78% 58%)' : 'hsl(0 0% 74%)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {coords.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="3" fill={accent ? 'hsl(0 78% 58%)' : 'hsl(0 0% 84%)'} />)}
        </svg>
        <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
          <span>{dateLabel(points[0].date)}</span><span>{dateLabel(points[Math.floor((points.length - 1) / 2)].date)}</span><span>{dateLabel(points[points.length - 1].date)}</span>
        </div>
      </div>}
  </div>;
}

export default function AdminPage() {
  const currentUser = useGetCurrentUser();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userError, setUserError] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [lockMessage, setLockMessage] = useState('');
  const [search, setSearch] = useState('');
  const [pauseMinutes, setPauseMinutes] = useState(60);
  const role = String((currentUser.data as unknown as { role?: string } | undefined)?.role ?? '').toLowerCase();
  const canOperate = role === 'admin' || role === 'co_founder';
  const canManageRoles = role === 'admin';

  const loadOverview = useCallback(async () => {
    setError('');
    try {
      const data = await request<Overview>('/api/admin/overview');
      setOverview(data);
      setLockMessage(data.controls.lockdownMessage ?? '');
      setAnnouncement(data.announcement?.message ?? '');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load admin overview.'); }
    finally { setLoading(false); }
  }, []);
  const loadUsers = useCallback(async () => {
    setUserError('');
    try {
      const data = await request<{ users: User[] }>('/api/admin/users');
      setUsers(data.users);
    } catch (cause) { setUserError(cause instanceof Error ? cause.message : 'Unable to load user directory.'); }
  }, []);
  useEffect(() => { void loadOverview(); void loadUsers(); }, [loadOverview, loadUsers]);
  const filteredUsers = useMemo(() => users.filter((user) => `${user.username} ${user.role}`.toLowerCase().includes(search.toLowerCase())), [users, search]);

  const performControl = async (key: 'lockdown' | 'apiPaused' | 'sendingEnabled' | 'receivingEnabled', enabled: boolean) => {
    setBusy(key); setNotice('');
    try {
      const data = await request<{ controls: Overview['controls'] }>('/api/admin/control', {
        method: 'POST',
        body: JSON.stringify({
          key,
          enabled,
          ...(!enabled && ['apiPaused', 'sendingEnabled', 'receivingEnabled'].includes(key) ? { durationMinutes: pauseMinutes } : {}),
          ...(key === 'lockdown' ? { message: lockMessage.trim() } : {}),
        }),
      });
      setOverview((old) => old ? { ...old, controls: data.controls } : old);
      setNotice(`${key === 'lockdown' ? 'Lockdown' : key === 'apiPaused' ? 'API pause' : key === 'sendingEnabled' ? 'Sending' : 'Receiving'} setting updated.`);
    } catch (cause) { setNotice(`Could not update setting: ${cause instanceof Error ? cause.message : 'Request failed.'}`); }
    finally { setBusy(''); }
  };
  const publishAnnouncement = async (message = announcement) => {
    setBusy('announcement'); setNotice('');
    try {
      const data = await request<{ announcement: Overview['announcement'] }>('/api/admin/announcement', {
        method: 'POST', body: JSON.stringify({ message: message.trim() }),
      });
      setOverview((old) => old ? { ...old, announcement: data.announcement } : old);
      setAnnouncement(data.announcement?.message ?? '');
      setNotice(data.announcement ? 'Announcement published.' : 'Announcement cleared.');
    } catch (cause) { setNotice(`Announcement was not saved: ${cause instanceof Error ? cause.message : 'Request failed.'}`); }
    finally { setBusy(''); }
  };
  const changeRole = async (user: User, nextRole: string) => {
    if (nextRole === user.role) return;
    setBusy(user.id); setUserError('');
    try {
      const data = await request<{ user: User }>(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: 'PATCH', body: JSON.stringify({ role: nextRole }),
      });
      setUsers((old) => old.map((item) => item.id === data.user.id ? data.user : item));
      setNotice(`Role updated for ${data.user.username}.`);
    } catch (cause) { setUserError(`Role update failed: ${cause instanceof Error ? cause.message : 'Request failed.'}`); }
    finally { setBusy(''); }
  };
  const controls = overview?.controls;

  return <MailShell>
    <div className="mx-auto w-full max-w-[1260px] px-3 pb-10 pt-4 sm:px-6 md:px-8">
      <header className="animate-enter mb-6 flex flex-col justify-between gap-5 sm:mb-8 md:flex-row md:items-end">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.22em] text-primary"><ShieldCheck className="h-3.5 w-3.5" /> Trusted operations</p>
          <h1 className="mt-2 font-display text-4xl tracking-[-.055em] sm:text-6xl">Admin<span className="text-primary">.</span></h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">A privacy-first view of service operations. Message contents and credential values never appear here.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground">
            Signed in as <span className="text-foreground">{(currentUser.data as unknown as { username?: string } | undefined)?.username ?? 'account'}</span>
          </div>
          <Button variant="outline" onClick={() => { void loadOverview(); void loadUsers(); }} disabled={loading} className="border-white/15 bg-white/[.03]" aria-label="Refresh admin data">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </header>

      {notice && <div role="status" className="mb-4 flex items-start gap-2 rounded-xl border border-primary/25 bg-primary/[.08] px-4 py-3 text-sm text-foreground animate-enter"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{notice}</div>}
      {!canOperate && currentUser.data && <div role="alert" className="mb-5 flex gap-3 rounded-xl border border-primary/30 bg-primary/[.08] p-4 text-sm">
        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><strong>Restricted operations.</strong> Your account can view available data but cannot change operating controls{role !== 'admin' ? ' or roles' : ''}. A trusted admin or co-founder account is required.</div>
      </div>}

      {error ? <Panel className="mb-5 p-6"><div role="alert" className="flex items-start gap-3"><AlertTriangle className="mt-1 h-5 w-5 text-primary" /><div className="flex-1"><h2 className="font-display text-xl">Overview unavailable</h2><p className="mt-1 text-sm text-muted-foreground">{error}</p><Button className="mt-4" onClick={() => { setLoading(true); void loadOverview(); }}>Retry overview</Button></div></div></Panel> : loading && !overview ?
        <div aria-busy="true" aria-label="Loading admin overview" className="mb-5 grid gap-3 sm:grid-cols-3"><div className="glass h-28 animate-pulse rounded-2xl" /><div className="glass h-28 animate-pulse rounded-2xl" /><div className="glass h-28 animate-pulse rounded-2xl" /></div> : overview && <>
        <section aria-label="Privacy-safe activity totals" className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Accounts', value: overview.totals.users, icon: Users, note: 'registered mailboxes' },
            { label: 'Sent today', value: overview.totals.sentToday, icon: ArrowUpRight, note: 'message count only' },
            { label: 'Received today', value: overview.totals.receivedToday, icon: ArrowDownRight, note: 'message count only' },
            { label: 'API requests', value: overview.traffic.requestsSinceStart, icon: Activity, note: 'since this process started' },
          ].map((metric, index) => <Panel key={metric.label} className={`animate-enter animate-enter-${Math.min(index + 1, 2)} relative overflow-hidden p-4 sm:p-5`}>
            <span className="absolute -right-3 -top-5 text-primary/[.08]"><metric.icon className="h-24 w-24" /></span>
            <div className="relative flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-[.17em] text-muted-foreground">{metric.label}</span><metric.icon className="h-4 w-4 text-primary" /></div>
            <p className="relative mt-4 font-display text-4xl tracking-[-.05em]">{metric.value.toLocaleString(getCurrentLocale())}</p>
            <p className="relative mt-1 text-xs text-muted-foreground">{metric.note}</p>
          </Panel>)}
        </section>

        <Panel className="mb-4 overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
            <div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Workspace pulse</p><h2 className="mt-1 font-display text-xl">Aggregate activity</h2></div>
            <span className="hidden items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground sm:flex"><Activity className="h-3.5 w-3.5" /> No message data</span>
          </div>
          <div className="grid md:grid-cols-2">
            <Chart title="New accounts" points={overview.series.accounts} />
            <div className="border-t border-white/10 md:border-l md:border-t-0"><Chart title="Messages" points={overview.series.messages} accent /></div>
          </div>
          <p className="border-t border-white/[.07] px-4 py-3 text-[11px] leading-5 text-muted-foreground sm:px-5">Counts only. No subjects, senders, recipients, or message bodies are collected in this view.</p>
        </Panel>

        <Panel className="mb-4 overflow-hidden">
          <div className="flex flex-col justify-between gap-2 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
            <div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Request protection</p><h2 className="mt-1 font-display text-xl">API traffic snapshot</h2></div>
            <span className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground">{overview.traffic.rateLimitedSinceStart.toLocaleString(getCurrentLocale())} rate limited</span>
          </div>
          <div className="grid gap-4 p-4 sm:grid-cols-[.7fr_1.3fr] sm:p-5">
            <div className="rounded-xl border border-white/[.08] bg-white/[.02] p-4">
              <p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">Process started</p>
              <p className="mt-2 text-sm">{dateTime(new Date(overview.traffic.startedAt * 1000).toISOString())}</p>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">Counters reset when this app process restarts. No IP addresses, message contents, or request bodies are retained.</p>
            </div>
            <div className="overflow-x-auto">
              {!overview.traffic.topRoutes.length ? <p className="grid min-h-24 place-items-center text-sm text-muted-foreground">No API traffic counted yet.</p> :
                <table className="w-full min-w-[380px] border-collapse text-left">
                  <thead><tr className="border-b border-white/[.08] font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground"><th className="px-2 py-2 font-normal">API route</th><th className="px-2 py-2 font-normal">Method</th><th className="px-2 py-2 text-right font-normal">Requests</th></tr></thead>
                  <tbody className="divide-y divide-white/[.06]">{overview.traffic.topRoutes.map((route) => <tr key={`${route.method}-${route.path}`} className="hover:bg-white/[.025]"><td className="max-w-[340px] break-all px-2 py-2 font-mono text-[10px]">{route.path}</td><td className="px-2 py-2 font-mono text-[9px] text-muted-foreground">{route.method}</td><td className="px-2 py-2 text-right font-mono text-xs">{route.count.toLocaleString(getCurrentLocale())}</td></tr>)}</tbody>
                </table>}
            </div>
          </div>
        </Panel>

        <div className="mb-4 grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
          <Panel className="overflow-hidden">
            <div className="border-b border-white/10 p-4 sm:p-5"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Service controls</p><h2 className="mt-1 font-display text-2xl">Operating posture</h2><p className="mt-1 text-xs text-muted-foreground">Changes take effect through server-enforced controls.</p></div>
            <div className="border-b border-white/[.07] px-4 py-3 sm:px-5">
              <label htmlFor="pause-duration" className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                <span><strong className="font-medium">Automatic resume</strong><span className="mt-1 block text-[11px] text-muted-foreground">Used when API, sending, or receiving is paused.</span></span>
                <select id="pause-duration" value={pauseMinutes} onChange={(event) => setPauseMinutes(Number(event.target.value))} className="rounded-lg border border-white/10 bg-[#151515] px-3 py-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <option value={15}>15 minutes</option><option value={60}>1 hour</option><option value={360}>6 hours</option><option value={1440}>24 hours</option>
                </select>
              </label>
            </div>
            <div className="divide-y divide-white/[.07] px-4 sm:px-5">
              {([
                ['lockdown', 'Mailbox lockdown', 'Stop mailbox access while an incident is contained.', controls?.lockdown ?? false],
                ['apiPaused', 'Pause API', 'Temporarily pause API traffic.', controls?.apiPaused ?? false],
                ['sendingEnabled', 'Sending enabled', 'Permit outbound mail delivery.', controls?.sendingEnabled ?? false],
                ['receivingEnabled', 'Receiving enabled', 'Permit inbound mail delivery.', controls?.receivingEnabled ?? false],
              ] as const).map(([key, label, description, enabled]) => <div key={key} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><p className="text-sm font-medium">{label}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
                  {key === 'apiPaused' && controls?.apiPausedUntil && <p className="mt-1 font-mono text-[9px] text-primary">Auto-resumes {dateTime(controls.apiPausedUntil)}</p>}
                  {key === 'sendingEnabled' && controls?.sendingEnabledUntil && <p className="mt-1 font-mono text-[9px] text-primary">Auto-resumes {dateTime(controls.sendingEnabledUntil)}</p>}
                  {key === 'receivingEnabled' && controls?.receivingEnabledUntil && <p className="mt-1 font-mono text-[9px] text-primary">Auto-resumes {dateTime(controls.receivingEnabledUntil)}</p>}
                </div>
                <button type="button" onClick={() => void performControl(key, !enabled)} disabled={!canOperate || Boolean(busy) || !controls} aria-pressed={enabled} className={`flex min-h-10 shrink-0 items-center justify-between gap-3 rounded-xl border px-3 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-45 sm:min-w-[136px] ${enabled ? 'border-primary/35 bg-primary/10 text-primary' : 'border-white/10 bg-white/[.025] text-muted-foreground'}`}>
                  <span>{enabled ? 'Enabled' : 'Disabled'}</span><span className={`relative h-5 w-9 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-white/15'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} /></span>
                </button>
              </div>)}
            </div>
            {controls?.lockdown && <div className="border-t border-primary/20 bg-primary/[.06] p-4 sm:p-5">
              <label htmlFor="lockdown-message" className="font-mono text-[9px] uppercase tracking-[.16em] text-primary">Lockdown notice</label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row"><input id="lockdown-message" value={lockMessage} onChange={(event) => setLockMessage(event.target.value)} maxLength={500} placeholder="Short public-facing notice" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary" />
                <Button onClick={() => void performControl('lockdown', true)} disabled={!canOperate || Boolean(busy)}>{busy === 'lockdown' ? 'Saving…' : 'Save notice'}</Button></div>
            </div>}
          </Panel>

          <Panel className="overflow-hidden">
            <div className="border-b border-white/10 p-4 sm:p-5"><p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-primary"><Megaphone className="h-3.5 w-3.5" /> Announcement</p><h2 className="mt-1 font-display text-2xl">Workspace notice</h2><p className="mt-1 text-xs text-muted-foreground">Visible notice only. Never put credentials or private information here.</p></div>
            <div className="p-4 sm:p-5">
              {overview.announcement && <div className="mb-3 rounded-xl border border-white/10 bg-white/[.03] p-3"><p className="whitespace-pre-wrap break-words text-sm">{overview.announcement.message}</p><p className="mt-2 font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground">Published {dateTime(overview.announcement.updatedAt)}</p></div>}
              <label htmlFor="announcement-message" className="sr-only">Announcement message</label>
              <textarea id="announcement-message" value={announcement} onChange={(event) => setAnnouncement(event.target.value)} maxLength={500} rows={4} placeholder="Write a short public workspace notice…" className="w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary" />
              <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Button onClick={() => void publishAnnouncement()} disabled={!canOperate || Boolean(busy)} className="flex-1">{busy === 'announcement' ? 'Publishing…' : 'Publish notice'}</Button><Button variant="outline" onClick={() => { setAnnouncement(''); void publishAnnouncement(''); }} disabled={!canOperate || Boolean(busy) || !overview.announcement} className="border-white/15 bg-white/[.03]">Clear</Button></div>
            </div>
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
          <Panel className="overflow-hidden">
            <div className="flex flex-col justify-between gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-end sm:p-5">
              <div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Access directory</p><h2 className="mt-1 font-display text-2xl">Users & roles</h2><p className="mt-1 text-xs text-muted-foreground">Email addresses are intentionally not shown.</p></div>
              <label className="relative"><span className="sr-only">Filter accounts</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter username or role" className="w-full rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary sm:w-56" /></label>
            </div>
            {userError ? <div className="p-5" role="alert"><p className="text-sm text-primary">{userError}</p><Button variant="outline" className="mt-3 border-white/15" onClick={() => void loadUsers()}>Retry users</Button></div> :
              users.length === 0 ? <div className="p-8 text-center"><Users className="mx-auto h-7 w-7 text-primary/70" /><p className="mt-3 text-sm text-muted-foreground">No user records returned.</p></div> :
                filteredUsers.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No accounts match that filter.</p> :
                  <div className="max-h-[420px] overflow-auto">
                    <table className="w-full min-w-[540px] border-collapse text-left">
                      <thead className="sticky top-0 bg-[#111]"><tr className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground"><th className="px-4 py-3 font-normal sm:px-5">Account</th><th className="px-3 py-3 font-normal">Joined</th><th className="px-4 py-3 text-right font-normal sm:px-5">Role</th></tr></thead>
                      <tbody className="divide-y divide-white/[.07]">{filteredUsers.map((user) => <tr key={user.id} className="hover:bg-white/[.025]">
                        <td className="px-4 py-3 sm:px-5"><p className="truncate text-sm font-medium">{user.username}</p><p className="mt-0.5 font-mono text-[9px] text-muted-foreground">Account ID · {user.id}</p></td>
                        <td className="px-3 py-3 font-mono text-[10px] text-muted-foreground">{dateLabel(user.createdAt)}</td>
                        <td className="px-4 py-3 text-right sm:px-5">{canManageRoles ? <label className="relative inline-flex items-center"><span className="sr-only">Role for {user.username}</span><select value={user.role} disabled={Boolean(busy)} onChange={(event) => void changeRole(user, event.target.value)} className="max-w-[150px] appearance-none rounded-lg border border-white/10 bg-white/[.04] py-2 pl-3 pr-8 text-xs capitalize outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50">{roles.map((item) => <option key={item} value={item} className="bg-[#151515]">{item.replace('_', ' ')}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-muted-foreground" /></label> : <span className="rounded-full border border-white/10 bg-white/[.035] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">{user.role.replace('_', ' ')}</span>}</td>
                      </tr>)}</tbody>
                    </table>
                  </div>}
            <div className="border-t border-white/[.07] px-4 py-3 font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground sm:px-5">{filteredUsers.length} {filteredUsers.length === 1 ? 'account' : 'accounts'} shown</div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="border-b border-white/10 p-4 sm:p-5"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Audit trail</p><h2 className="mt-1 font-display text-2xl">Recent actions</h2><p className="mt-1 text-xs text-muted-foreground">Operational events only; no mail contents.</p></div>
            {!overview.audit.length ? <div className="p-8 text-center"><CircleHelp className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">No audit events available.</p></div> :
              <ol className="divide-y divide-white/[.07]">{overview.audit.slice(0, 12).map((item, index) => <li key={`${item.createdAt}-${index}`} className="flex gap-3 px-4 py-3 sm:px-5"><span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10"><ToggleLeft className="h-3.5 w-3.5 text-primary" /></span><div className="min-w-0 flex-1"><p className="break-words text-xs leading-5">{item.action}</p><p className="mt-1 font-mono text-[9px] text-muted-foreground">{item.actor} · {dateTime(item.createdAt)}</p></div></li>)}</ol>}
          </Panel>
        </div>
        <p className="mt-5 flex items-center gap-2 text-[11px] text-muted-foreground"><Shield className="h-3.5 w-3.5 text-primary" /> Controls are enforced by the API. This console never reads mailbox messages or displays configuration secrets.</p>
      </>}
    </div>
  </MailShell>;
}
