import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Archive, FileText, Inbox, LogOut, Menu, PenLine, Plus, Settings, Shield, Star, Tag, X } from 'lucide-react';
import { useGetCurrentUser, useGetMailboxSummary, useListFolders, useSignOut, getGetCurrentUserQueryKey } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import fpedsIcon from '@assets/image_1788396108244.png';

export function LogoMark() {
  return <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl border border-white/15 bg-black shadow-[0_8px_25px_hsl(0_72%_45%/.35)]"><img src={fpedsIcon} alt="FPEDS" className="h-full w-full object-cover grayscale" /></span>;
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
    { href: '/starred', label: 'Starred', icon: Star },
    { href: '/sent', label: 'Sent', icon: Archive, count: summary?.sent },
    { href: '/drafts', label: 'Drafts', icon: FileText, count: summary?.drafts },
    { href: '/spam', label: 'Spam', icon: Shield, count: summary?.spam },
  ];
  const selectedFolder = location.split('/')[1] === 'folder'
    ? decodeURIComponent(location.split('/')[2]?.split('?')[0] ?? '')
    : location.split('/')[1] || 'inbox';
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="fixed inset-0 pointer-events-none opacity-40" style={{ background: 'linear-gradient(125deg, transparent 35%, hsl(0 72% 45% / .08), transparent 62%)' }} />
      <header className="relative z-40 flex h-16 items-center justify-between border-b hairline px-4 sm:px-5 md:h-[72px] md:px-8">
        <Link href="/inbox" onClick={close} className="flex items-center gap-3" data-testid="link-logo">
          <LogoMark /><span className="text-[15px] font-extrabold tracking-[.22em] text-foreground">FPEDS<span className="text-primary">.</span></span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 text-right sm:flex"><p className="text-sm font-semibold">{userQuery.data?.username ?? 'Private member'}</p><p className="font-mono text-[10px] text-muted-foreground">{userQuery.data?.email ?? 'fpeds.2bd.net'}</p></div>
          <div className="grid h-9 w-9 place-items-center rounded-full border border-primary/40 bg-primary/10 font-mono text-xs text-primary" data-testid="text-avatar">{(userQuery.data?.username?.slice(0, 2) ?? 'FP').toUpperCase()}</div>
          <button onClick={() => setOpen(!open)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary" aria-label="Open workspace menu" aria-expanded={open} data-testid="button-toggle-menu"><Menu className="h-4 w-4" /></button>
        </div>
         {open && <div className="absolute right-4 top-12 z-50 hidden w-48 rounded-xl border border-white/10 bg-[#121212]/95 p-2 shadow-2xl backdrop-blur-xl md:right-5 md:top-14 md:block">
          <Link href="/settings" onClick={close} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"><Settings className="h-4 w-4" /> Settings</Link>
          <Button variant="ghost" onClick={logout} disabled={signOut.isPending} className="w-full justify-start gap-3 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground"><LogOut className="h-4 w-4" /> Sign out</Button>
        </div>}
      </header>
      <div className="relative z-20 flex">
         <aside className={`fixed bottom-0 left-0 top-16 z-40 w-[min(86vw,300px)] border-r hairline bg-[hsl(0_0%_5%/.98)] p-4 backdrop-blur-xl transition-transform duration-300 md:sticky md:top-[72px] md:block md:h-[calc(100dvh-72px)] md:w-[270px] md:translate-x-0 md:p-5 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="mb-7 flex items-center justify-between md:hidden"><span className="font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">Navigation</span><button onClick={close} data-testid="button-close-menu"><X className="h-4 w-4" /></button></div>
          <Link href="/compose" onClick={close} className="mb-7 flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground shadow-[0_8px_24px_hsl(0_72%_45%/.18)] transition-transform hover:-translate-y-0.5" data-testid="link-compose"><PenLine className="h-4 w-4" /> Compose</Link>
          <nav className="space-y-1" aria-label="Mailbox">
            <p className="mb-3 px-3 font-mono text-[9px] uppercase tracking-[.22em] text-muted-foreground">Mailbox</p>
            {nav.map(item => { const Icon = item.icon; const itemFolder = item.label.toLowerCase(); const active = selectedFolder === itemFolder; return <Link key={item.label} href={item.href} onClick={close} className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors ${active ? 'bg-accent font-semibold text-accent-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`} data-testid={`link-folder-${item.label.toLowerCase()}`}><span className="flex items-center gap-3"><Icon className={`h-4 w-4 ${active ? 'text-primary' : ''}`} />{item.label}</span>{item.count ? <span className="font-mono text-[10px]">{item.count}</span> : null}</Link>; })}
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
         <main className="min-w-0 flex-1 pb-20 md:pb-0">{children}</main>
      </div>
       <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t hairline bg-[#0d0d0d]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden" aria-label="Mobile mailbox">
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
  return <div className="flex min-h-[300px] items-center justify-center"><div className="flex items-center gap-3 text-sm text-muted-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" /><span>{label}</span></div></div>;
}

export function ErrorBlock({ retry }: { retry: () => void }) {
  return <div className="mx-auto my-16 max-w-md rounded-2xl border border-primary/25 bg-primary/5 p-8 text-center"><p className="font-display text-2xl">A quiet interruption.</p><p className="mt-2 text-sm text-muted-foreground">We could not reach your mailbox. Your messages are still safe.</p><Button onClick={retry} className="mt-5" data-testid="button-retry">Try again</Button></div>;
}