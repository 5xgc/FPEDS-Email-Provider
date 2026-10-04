import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Archive, FileText, Inbox, LogOut, Menu, PenLine, Plus, Settings, Shield, Star, Tag, X } from 'lucide-react';
import { useGetCurrentUser, useGetMailboxSummary, useListFolders, useSignOut } from '@workspace/api-client-react';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { PREFERENCES_CHANGED_EVENT, readPreference } from '@/lib/preferences';
export function LogoMark() {
  return <BrandLogo />;
}

export function MailShell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [autoSignOut, setAutoSignOut] = useState(() => readPreference('autoSignOut'));
  const queryClient = useQueryClient();
  const userQuery = useGetCurrentUser();
  const summaryQuery = useGetMailboxSummary();
  const foldersQuery = useListFolders();
  const signOut = useSignOut();
  const summary = summaryQuery.data;
  const folders = foldersQuery.data ?? [];
  const username = userQuery.data?.username ?? 'name';
  const sendingAddress = `${username}@fpeds.2bd.net`;
  const receivingAddress = userQuery.data?.email ?? `${username}@fpdf.2bd.net`;
  const close = () => setOpen(false);
  const logout = () => signOut.mutate(undefined, { onSuccess: () => { queryClient.clear(); setLocation('/auth?mode=signup'); } });
  const logoutRef = useRef(logout);
  logoutRef.current = logout;
  useEffect(() => {
    const refreshPreference = () => setAutoSignOut(readPreference('autoSignOut'));
    window.addEventListener(PREFERENCES_CHANGED_EVENT, refreshPreference);
    return () => window.removeEventListener(PREFERENCES_CHANGED_EVENT, refreshPreference);
  }, []);
  useEffect(() => {
    if (!autoSignOut) return;
    let timeout: number;
    const resetTimeout = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => logoutRef.current(), 5 * 60 * 1000);
    };
    const activityEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart', 'wheel'];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetTimeout, { passive: true }));
    resetTimeout();
    return () => {
      window.clearTimeout(timeout);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetTimeout));
    };
  }, [autoSignOut]);
  const nav = [
    { href: '/inbox', label: 'Inbox', icon: Inbox, count: summary?.unread },
    { href: '/starred', label: 'Starred', icon: Star },
    { href: '/sent', label: 'Sent', icon: Archive, count: summary?.sent },
    { href: '/drafts', label: 'Drafts', icon: FileText, count: summary?.drafts },
    { href: '/spam', label: 'Spam', icon: Shield, count: summary?.spam },
  ];
  const selectedFolder = location.split('/')[1] === 'folder'
    ? decodeURIComponent(location.split('/')[2]?.split('?')[0] ?? '')
    : location.split('/')[1] || 'inbox';
  return (
    <div className="moraltown relative min-h-[100dvh] overflow-hidden text-foreground">
      <header className="workspace-header glass relative z-40 flex h-16 min-w-0 items-center justify-between gap-3 overflow-visible border-x-0 border-t-0 px-4 sm:px-5 md:h-[72px] md:px-8">
        <Link href="/inbox" onClick={close} className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2" data-testid="link-logo">
          <LogoMark />
        </Link>
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="hidden min-w-0 max-w-[430px] text-right lg:block">
            <p className="truncate font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">Sending <span data-private-email className="ml-1 inline-block max-w-[220px] truncate align-bottom normal-case tracking-normal text-foreground/75">{sendingAddress}</span></p>
            <p className="mt-1 truncate font-mono text-[9px] uppercase tracking-[.14em] text-primary">Receiving <span data-private-email className="ml-1 inline-block max-w-[220px] truncate align-bottom normal-case tracking-normal text-foreground/75">{receivingAddress}</span></p>
          </div>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 font-mono text-xs text-primary" data-testid="text-avatar">{(userQuery.data?.username?.slice(0, 2) ?? 'FP').toUpperCase()}</div>
          <button onClick={() => setOpen(!open)} className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:hidden" aria-label="Open workspace menu" aria-expanded={open} data-testid="button-toggle-menu"><Menu className="h-4 w-4" /></button>
        </div>
          {open && <div className="absolute right-4 top-12 z-50 w-48 rounded-xl border border-white/10 bg-[#121212]/95 p-2 shadow-2xl backdrop-blur-xl md:hidden">
          <Link href="/settings" onClick={close} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"><Settings className="h-4 w-4" /> Settings</Link>
          <Button variant="ghost" onClick={logout} disabled={signOut.isPending} className="w-full justify-start gap-3 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground"><LogOut className="h-4 w-4" /> Sign out</Button>
        </div>}
      </header>
       <div className="relative z-20 flex min-w-0">
            <aside className={`workspace-sidebar glass fixed bottom-0 left-0 top-16 z-40 w-[min(86vw,300px)] shrink-0 border-y-0 border-l-0 p-4 backdrop-blur-2xl transition-transform duration-300 md:sticky md:top-[72px] md:block md:h-[calc(100dvh-72px)] md:w-[270px] md:translate-x-0 md:p-5 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="mb-3 flex items-center justify-between md:hidden"><span className="font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">Navigation</span><button onClick={close} data-testid="button-close-menu"><X className="h-4 w-4" /></button></div>
           <Link href="/compose" onClick={close} className="compose-cta mb-4 flex h-11 items-center justify-center gap-2 rounded-xl font-semibold transition-transform hover:-translate-y-0.5 md:mb-6 md:h-12" data-testid="link-compose"><PenLine className="h-4 w-4" /> Compose</Link>
            <div className="mb-4 rounded-xl border border-white/[.08] bg-white/[.03] px-3 py-3 md:hidden">
              <p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">Sending <span data-private-email className="ml-1 break-all normal-case tracking-normal text-foreground/75">{sendingAddress}</span></p>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-[.14em] text-primary">Receiving <span data-private-email className="ml-1 break-all normal-case tracking-normal text-foreground/75">{receivingAddress}</span></p>
            </div>
          <nav className="space-y-1" aria-label="Mailbox">
            <p className="mb-3 px-3 font-mono text-[9px] uppercase tracking-[.22em] text-muted-foreground">Mailbox</p>
             {nav.map(item => { const Icon = item.icon; const itemFolder = item.label.toLowerCase(); const active = selectedFolder === itemFolder; return <Link key={item.label} href={item.href} onClick={close} className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors ${active ? 'nav-active font-semibold' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`} data-testid={`link-folder-${item.label.toLowerCase()}`}><span className="flex items-center gap-3"><Icon className={`h-4 w-4 ${active ? 'text-primary' : ''}`} />{item.label}</span>{item.count ? <span className="font-mono text-[10px]">{item.count}</span> : null}</Link>; })}
            <div className="my-6 h-px bg-border/60" />
            <div className="mb-3 flex items-center justify-between px-3"><p className="font-mono text-[9px] uppercase tracking-[.22em] text-muted-foreground">Your folders</p><button className="text-muted-foreground hover:text-primary" onClick={() => setLocation('/settings?panel=folders')} data-testid="button-add-folder"><Plus className="h-3.5 w-3.5" /></button></div>
            {folders.map(folder => <Link key={folder.id} href={`/folder/${encodeURIComponent(folder.name)}`} onClick={close} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${selectedFolder === folder.name ? 'bg-accent font-semibold text-accent-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`} data-testid={`link-custom-folder-${folder.id}`}><span className="flex items-center gap-3"><Tag className="h-4 w-4" />{folder.name}</span><span className="font-mono text-[10px]">{folder.count}</span></Link>)}
          </nav>
          <div className="absolute bottom-5 left-5 right-5 space-y-1">
            <Link href="/settings" onClick={close} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground" data-testid="link-settings"><Settings className="h-4 w-4" /> Settings</Link>
            <Button variant="ghost" onClick={logout} disabled={signOut.isPending} className="w-full justify-start px-3 text-sm text-muted-foreground hover:text-foreground" data-testid="button-signout"><LogOut className="h-4 w-4" /> {signOut.isPending ? 'Closing session…' : 'Sign out'}</Button>
          </div>
        </aside>
         {open && <button className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={close} aria-label="Close navigation" data-testid="button-overlay" />}
           <main className="scroll-stage w-full min-w-0 flex-1 overflow-x-hidden pb-20 md:pb-0">{children}</main>
      </div>
        <nav className="workspace-mobile-nav glass fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-x-0 border-b-0 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-2xl md:hidden" aria-label="Mobile mailbox">
         {[
           { href: '/inbox', label: 'Inbox', icon: Inbox },
           { href: '/starred', label: 'Starred', icon: Star },
           { href: '/compose', label: 'Compose', icon: PenLine },
           { href: '/settings', label: 'Settings', icon: Settings },
         ].map(item => {
           const Icon = item.icon;
           const active = item.href === '/inbox' ? selectedFolder === 'inbox' : location === item.href;
           return <Link key={item.href} href={item.href} onClick={close} className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`} data-testid={`mobile-nav-${item.label.toLowerCase()}`}><Icon className="h-5 w-5" /><span>{item.label}</span></Link>;
         })}
       </nav>
    </div>
  );
}

export function LoadingBlock({ label = 'Loading private workspace' }: { label?: string }) {
  return <div className="mx-auto w-full max-w-3xl space-y-4 px-5 py-12" aria-label={label} aria-busy="true"><div className="h-4 w-28 animate-pulse rounded bg-secondary" /><div className="h-8 w-2/3 animate-pulse rounded bg-secondary" /><div className="glass space-y-4 rounded-2xl p-5"><div className="h-12 animate-pulse rounded-lg bg-secondary/70" /><div className="h-12 animate-pulse rounded-lg bg-secondary/70" /><div className="h-12 animate-pulse rounded-lg bg-secondary/70" /></div><span className="sr-only">{label}</span></div>;
}

export function ErrorBlock({ retry }: { retry: () => void }) {
  return <div className="mx-auto my-16 max-w-md rounded-2xl border border-primary/25 bg-primary/5 p-8 text-center"><p className="font-display text-2xl">A quiet interruption.</p><p className="mt-2 text-sm text-muted-foreground">We could not reach the mailbox just now. Check your connection and try again.</p><Button onClick={retry} className="mt-5" data-testid="button-retry">Try again</Button></div>;
}