import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Archive, ChevronDown, FileText, Inbox, LogOut, Menu, PenLine, Plus, Settings, Shield, Star, Tag, X } from 'lucide-react';
import { useGetCurrentUser, useGetMailboxSummary, useListFolders, useSignOut, getGetCurrentUserQueryKey } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';

export function LogoMark() {
  return <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_8px_25px_hsl(0_72%_45%/.35)]"><span className="font-mono text-sm font-bold tracking-[-.16em]">fp</span></span>;
}

export function MailShell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const userQuery = useGetCurrentUser();
  const summaryQuery = useGetMailboxSummary();
  const foldersQuery = useListFolders();
  const signOut = useSignOut();
  const summary = summaryQuery.data;
  const folders = foldersQuery.data ?? [];
  const close = () => setOpen(false);
  const logout = () => signOut.mutate(undefined, { onSuccess: () => { queryClient.removeQueries({ queryKey: getGetCurrentUserQueryKey() }); setLocation('/'); } });
  const nav = [
    { href: '/inbox', label: 'Inbox', icon: Inbox, count: summary?.unread },
    { href: '/inbox?folder=starred', label: 'Starred', icon: Star },
    { href: '/inbox?folder=sent', label: 'Sent', icon: Archive, count: summary?.sent },
    { href: '/inbox?folder=drafts', label: 'Drafts', icon: FileText, count: summary?.drafts },
    { href: '/inbox?folder=spam', label: 'Spam', icon: Shield, count: summary?.spam },
  ];
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="fixed inset-0 pointer-events-none opacity-40" style={{ background: 'linear-gradient(125deg, transparent 35%, hsl(0 72% 45% / .08), transparent 62%)' }} />
      <header className="relative z-30 flex h-[72px] items-center justify-between border-b hairline px-5 md:px-8">
        <Link href="/inbox" onClick={close} className="flex items-center gap-3" data-testid="link-logo">
          <LogoMark /><span className="text-[15px] font-extrabold tracking-[.22em] text-foreground">FPEDS<span className="text-primary">.</span></span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 text-right sm:flex"><p className="text-sm font-semibold">{userQuery.data?.username ?? 'Private member'}</p><p className="font-mono text-[10px] text-muted-foreground">{userQuery.data?.email ?? 'fpeds.jo3.org'}</p></div>
          <div className="grid h-9 w-9 place-items-center rounded-full border border-primary/40 bg-primary/10 font-mono text-xs text-primary" data-testid="text-avatar">{(userQuery.data?.username?.slice(0, 2) ?? 'FP').toUpperCase()}</div>
          <button onClick={() => setOpen(!open)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary" data-testid="button-toggle-menu"><Menu className="h-4 w-4" /></button>
        </div>
      </header>
      <div className="relative z-20 flex">
        <aside className={`fixed inset-y-[72px] left-0 z-20 w-[270px] border-r hairline bg-[hsl(0_0%_5%/.96)] p-5 backdrop-blur-xl transition-transform duration-300 md:sticky md:top-[72px] md:block md:h-[calc(100dvh-72px)] md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="mb-7 flex items-center justify-between md:hidden"><span className="font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">Navigation</span><button onClick={close} data-testid="button-close-menu"><X className="h-4 w-4" /></button></div>
          <Link href="/compose" onClick={close} className="mb-7 flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground shadow-[0_8px_24px_hsl(0_72%_45%/.18)] transition-transform hover:-translate-y-0.5" data-testid="link-compose"><PenLine className="h-4 w-4" /> Compose</Link>
          <nav className="space-y-1" aria-label="Mailbox">
            <p className="mb-3 px-3 font-mono text-[9px] uppercase tracking-[.22em] text-muted-foreground">Mailbox</p>
            {nav.map(item => { const Icon = item.icon; const active = location === item.href || (item.href === '/inbox' && location === '/inbox'); return <Link key={item.label} href={item.href} onClick={close} className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors ${active ? 'bg-accent font-semibold text-accent-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`} data-testid={`link-folder-${item.label.toLowerCase()}`}><span className="flex items-center gap-3"><Icon className={`h-4 w-4 ${active ? 'text-primary' : ''}`} />{item.label}</span>{item.count ? <span className="font-mono text-[10px]">{item.count}</span> : null}</Link>; })}
            <div className="my-6 h-px bg-border/60" />
            <div className="mb-3 flex items-center justify-between px-3"><p className="font-mono text-[9px] uppercase tracking-[.22em] text-muted-foreground">Your folders</p><button className="text-muted-foreground hover:text-primary" onClick={() => setLocation('/settings?panel=folders')} data-testid="button-add-folder"><Plus className="h-3.5 w-3.5" /></button></div>
            {folders.map(folder => <Link key={folder.id} href={`/inbox?folder=${encodeURIComponent(folder.name)}`} onClick={close} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground" data-testid={`link-custom-folder-${folder.id}`}><span className="flex items-center gap-3"><Tag className="h-4 w-4" />{folder.name}</span><span className="font-mono text-[10px]">{folder.count}</span></Link>)}
          </nav>
          <div className="absolute bottom-5 left-5 right-5 space-y-1">
            <Link href="/settings" onClick={close} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground" data-testid="link-settings"><Settings className="h-4 w-4" /> Settings</Link>
            <Button variant="ghost" onClick={logout} disabled={signOut.isPending} className="w-full justify-start px-3 text-sm text-muted-foreground hover:text-foreground" data-testid="button-signout"><LogOut className="h-4 w-4" /> {signOut.isPending ? 'Closing session…' : 'Sign out'}</Button>
          </div>
        </aside>
        {open && <button className="fixed inset-0 z-10 bg-black/50 md:hidden" onClick={close} aria-label="Close navigation" data-testid="button-overlay" />}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

export function LoadingBlock({ label = 'Loading private workspace' }: { label?: string }) {
  return <div className="flex min-h-[300px] items-center justify-center"><div className="flex items-center gap-3 text-sm text-muted-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" /><span>{label}</span></div></div>;
}

export function ErrorBlock({ retry }: { retry: () => void }) {
  return <div className="mx-auto my-16 max-w-md rounded-2xl border border-primary/25 bg-primary/5 p-8 text-center"><p className="font-display text-2xl">A quiet interruption.</p><p className="mt-2 text-sm text-muted-foreground">We could not reach your mailbox. Your messages are still safe.</p><Button onClick={retry} className="mt-5" data-testid="button-retry">Try again</Button></div>;
}