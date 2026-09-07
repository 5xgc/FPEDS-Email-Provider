import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  Bell,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  FolderPlus,
  KeyRound,
  Lock,
  Mail,
  Plus,
  RefreshCw,
  Shield,
  UserRound,
} from 'lucide-react';
import {
  getGetAccessKeyQueryKey,
  getGetCurrentUserQueryKey,
  getListFoldersQueryKey,
  getListNotificationsQueryKey,
  getListSubscriptionsQueryKey,
  useCreateFolder,
  useCreateSubscription,
  useGetAccessKey,
  useGetCurrentUser,
  useListFolders,
  useListNotifications,
  useListSubscriptions,
  useMarkNotificationRead,
  useRotateAccessKey,
  useUpdateProfile,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { MailShell } from '@/components/mail-shell';
import { createCredentialFile, downloadCredentialFile } from '@/lib/secure-credential-file';

const fmt = (date: string) =>
  new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date));

function SettingsCard({
  icon: Icon,
  eyebrow,
  title,
  description,
  children,
  className = '',
}: {
  icon: typeof UserRound;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`glass overflow-hidden rounded-3xl ${className}`}>
      <div className="border-b border-white/[.08] p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[.2em] text-primary">{eyebrow}</p>
            <h2 className="mt-2 font-display text-2xl tracking-[-.03em]">{title}</h2>
            <p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const [location] = useLocation();
  const client = useQueryClient();
  const user = useGetCurrentUser();
  const folders = useListFolders();
  const subs = useListSubscriptions();
  const notifications = useListNotifications();
  const accessKeyQuery = useGetAccessKey({
    query: { queryKey: getGetAccessKeyQueryKey(), enabled: false },
  });
  const updateProfile = useUpdateProfile();
  const createFolder = useCreateFolder();
  const createSubscription = useCreateSubscription();
  const markNotification = useMarkNotificationRead();
  const rotateAccessKey = useRotateAccessKey();
  const [username, setUsername] = useState('');
  const [folderName, setFolderName] = useState('');
  const [subEmail, setSubEmail] = useState('');
  const [subLabel, setSubLabel] = useState('');
  const [notice, setNotice] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [keyVisible, setKeyVisible] = useState(false);
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [privacy, setPrivacy] = useState({ read: true, blocked: true, alerts: true });
  const requestedPanel = new URLSearchParams(location.split('?')[1] ?? '').get('panel');

  useEffect(() => {
    if (user.data?.username && !username) setUsername(user.data.username);
  }, [user.data?.username, username]);

  const show = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3200);
  };

  const revealKey = async () => {
    const result = await accessKeyQuery.refetch();
    if (result.data?.accessKey) {
      setAccessKey(result.data.accessKey);
      setKeyVisible(true);
    } else {
      show('Rotate your access key once to enable secure recovery for this legacy account.');
    }
  };

  const rotateKey = () => {
    rotateAccessKey.mutate(undefined, {
      onSuccess: (data) => {
        setAccessKey(data.accessKey);
        setKeyVisible(true);
        show('Access key refreshed. Save the new key now.');
      },
      onError: () => show('The access key could not be refreshed. Try again.'),
    });
  };

  const exportKey = async () => {
    if (exportPassphrase.length < 8) {
      show('Use at least 8 characters for the file passphrase.');
      return;
    }
    const currentKey = accessKey || (await accessKeyQuery.refetch()).data?.accessKey;
    if (!currentKey) {
      show('Reveal or refresh the access key before exporting it.');
      return;
    }
    const contents = await createCredentialFile(user.data?.username ?? 'fpeds-user', currentKey, exportPassphrase);
    downloadCredentialFile(`${user.data?.username ?? 'fpeds-user'}.fpeds-key`, contents);
    setExportPassphrase('');
    show('Encrypted key file downloaded.');
  };

  const saveName = () => {
    if (!username.trim()) return;
    updateProfile.mutate(
      { data: { username: username.trim() } },
      {
        onSuccess: () => {
          client.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
          show('Profile updated.');
        },
      },
    );
  };

  const addFolder = () => {
    if (!folderName.trim()) return;
    createFolder.mutate(
      { data: { name: folderName.trim() } },
      {
        onSuccess: () => {
          setFolderName('');
          client.invalidateQueries({ queryKey: getListFoldersQueryKey() });
          show('Folder created.');
        },
      },
    );
  };

  const addSub = () => {
    if (!subEmail.includes('@') || !subLabel.trim()) return;
    createSubscription.mutate(
      { data: { email: subEmail.trim(), label: subLabel.trim() } },
      {
        onSuccess: () => {
          setSubEmail('');
          setSubLabel('');
          client.invalidateQueries({ queryKey: getListSubscriptionsQueryKey() });
          show('Subscription added.');
        },
      },
    );
  };

  return (
    <MailShell>
      <div className="mx-auto w-full max-w-[1180px] p-4 sm:p-6 md:p-8">
        <header className="mb-7 flex flex-col justify-between gap-5 sm:mb-9 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.22em] text-primary">Control room</p>
            <h1 className="mt-2 font-display text-4xl tracking-[-.05em] sm:text-6xl">Settings<span className="text-primary">.</span></h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Tune your mailbox, protect your access, and keep the room yours.</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/[.06] px-3 py-2 text-xs text-primary">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> Private session active
          </div>
        </header>

        {notice && <div className="fixed right-4 top-20 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-2xl border border-primary/30 bg-[#18100f]/95 px-4 py-3 text-sm text-primary shadow-2xl backdrop-blur-xl animate-enter" data-testid="status-settings-success"><Check className="h-4 w-4 shrink-0" />{notice}</div>}

        <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <SettingsCard icon={UserRound} eyebrow="Identity" title="Your mailbox" description="Keep your display name and receiving address recognizable.">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground" htmlFor="profile-name">Display name</label>
                <div className="mt-3 flex gap-2">
                  <Input id="profile-name" value={username} onChange={(event) => setUsername(event.target.value)} placeholder={user.data?.username ?? 'Your name'} className="min-w-0 bg-white/[.04]" data-testid="input-profile-name" />
                  <Button onClick={saveName} disabled={updateProfile.isPending} data-testid="button-save-profile">{updateProfile.isPending ? 'Saving…' : 'Save'}</Button>
                </div>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Receiving address</p>
                <p className="mt-3 break-all font-mono text-sm text-foreground/85">{user.data?.email ?? '—'}</p>
                <p className="mt-2 text-xs text-muted-foreground">Address changes remaining: <span className="text-primary">{user.data?.emailChangesRemaining ?? 0}</span></p>
              </div>
            </div>
          </SettingsCard>

          <SettingsCard icon={KeyRound} eyebrow="Credential vault" title="Access key" description="Reveal, refresh, or save an encrypted backup. Your key is never placed in a URL or session export.">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all font-mono text-xs tracking-[.16em] text-foreground/80">{keyVisible && accessKey ? accessKey : '••••••••••••••••••••••••••••••••••••••••••••••••••••••'}</code>
                <button type="button" onClick={() => (keyVisible ? setKeyVisible(false) : revealKey())} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:bg-white/[.06] hover:text-foreground" aria-label={keyVisible ? 'Hide access key' : 'Reveal access key'} data-testid="button-toggle-access-key">{keyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                <button type="button" onClick={() => { if (accessKey) navigator.clipboard.writeText(accessKey).then(() => show('Access key copied.')); }} disabled={!accessKey} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:bg-white/[.06] hover:text-foreground disabled:opacity-30" aria-label="Copy access key" data-testid="button-copy-access-key-settings"><Copy className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button variant="outline" onClick={rotateKey} disabled={rotateAccessKey.isPending} className="w-full border-white/10 bg-white/[.025]" data-testid="button-refresh-access-key"><RefreshCw className={`h-4 w-4 ${rotateAccessKey.isPending ? 'animate-spin' : ''}`} /> {rotateAccessKey.isPending ? 'Refreshing…' : 'Refresh key'}</Button>
              <Button variant="outline" onClick={revealKey} disabled={accessKeyQuery.isFetching} className="w-full border-white/10 bg-white/[.025]" data-testid="button-reveal-access-key">{accessKeyQuery.isFetching ? 'Opening…' : 'Reveal key'}</Button>
            </div>
            <div className="mt-4 flex gap-2">
              <Input value={exportPassphrase} onChange={(event) => setExportPassphrase(event.target.value)} type="password" placeholder="File passphrase (8+ characters)" className="min-w-0 bg-white/[.04]" data-testid="input-key-export-passphrase" />
              <Button onClick={exportKey} className="shrink-0" data-testid="button-export-access-key"><Download className="h-4 w-4" /> <span className="hidden sm:inline">Save file</span></Button>
            </div>
          </SettingsCard>

          <SettingsCard icon={Shield} eyebrow="Privacy" title="Quiet by default" description="These controls stay local to your workspace and do not change delivery APIs.">
            <div className="divide-y divide-white/[.07]">
              {[
                ['read', 'Read receipts', 'Show senders when you open their message.'],
                ['blocked', 'Block suspicious mail', 'Keep high spam-score messages out of your inbox.'],
                ['alerts', 'Quiet notifications', 'Only notify for messages that need a response.'],
              ].map(([key, title, desc]) => (
                <div key={key} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{desc}</p></div>
                  <Switch checked={privacy[key as keyof typeof privacy]} onCheckedChange={(checked) => setPrivacy({ ...privacy, [key]: checked })} data-testid={`switch-${key}`} />
                </div>
              ))}
            </div>
          </SettingsCard>

          <SettingsCard icon={Mail} eyebrow="Subscriptions" title="Useful senders" description="Keep a small list of addresses that are allowed to deliver attention to you.">
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input value={subEmail} onChange={(event) => setSubEmail(event.target.value)} placeholder="sender@domain.com" data-testid="input-subscription-email" />
              <Input value={subLabel} onChange={(event) => setSubLabel(event.target.value)} placeholder="Label, e.g. essays" data-testid="input-subscription-label" />
              <Button onClick={addSub} disabled={createSubscription.isPending} data-testid="button-add-subscription"><Plus className="h-4 w-4" /> Add</Button>
            </div>
            <div className="mt-5 space-y-2">
              {(subs.data ?? []).length === 0 ? <p className="rounded-xl bg-white/[.025] px-4 py-5 text-center text-xs text-muted-foreground">No subscriptions yet.</p> : (subs.data ?? []).map((sub) => <div key={sub.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[.035] px-4 py-3"><div className="min-w-0"><p className="text-sm">{sub.label}</p><p className="truncate font-mono text-[10px] text-muted-foreground">{sub.email}</p></div><span className={`font-mono text-[9px] uppercase tracking-[.14em] ${sub.active ? 'text-primary' : 'text-muted-foreground'}`}>{sub.active ? 'Active' : 'Paused'}</span></div>)}
            </div>
          </SettingsCard>

          <SettingsCard icon={FolderPlus} eyebrow="Organization" title="Mailbox folders" description="Give recurring messages a place to land.">
            <div className="flex gap-2">
              <Input value={folderName} onChange={(event) => setFolderName(event.target.value)} maxLength={40} placeholder="New folder name" data-testid="input-folder-name" />
              <Button onClick={addFolder} disabled={createFolder.isPending} data-testid="button-create-folder"><Plus className="h-4 w-4" /> Create</Button>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">{(folders.data ?? []).map((folder) => <div key={folder.id} className="flex items-center justify-between rounded-xl border border-white/[.07] px-4 py-3 text-sm"><span>{folder.name}</span><span className="font-mono text-[10px] text-muted-foreground">{folder.count}</span></div>)}</div>
          </SettingsCard>

          <SettingsCard icon={Bell} eyebrow="Activity" title="Notifications" description="Recent events from your private workspace." className={requestedPanel === 'notifications' ? 'ring-1 ring-primary/40' : ''}>
            {(notifications.data ?? []).length === 0 ? <p className="rounded-xl bg-white/[.025] px-4 py-6 text-center text-xs text-muted-foreground">No new notifications.</p> : <div className="divide-y divide-white/[.07]">{(notifications.data ?? []).map((note) => <button key={note.id} onClick={() => markNotification.mutate({ id: note.id }, { onSuccess: () => client.invalidateQueries({ queryKey: getListNotificationsQueryKey() }) })} className="flex w-full gap-3 py-4 text-left first:pt-0 last:pb-0" data-testid={`button-notification-${note.id}`}><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${note.isRead ? 'bg-muted' : 'bg-primary'}`} /><span className="min-w-0"><p className="text-sm font-medium">{note.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{note.message}</p><p className="mt-2 font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground">{fmt(note.createdAt)} · {note.isRead ? 'Read' : 'Mark read'}</p></span></button>)}</div>}
          </SettingsCard>
        </div>
        <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5 text-primary" /> Sessions persist for 30 days of inactivity. Access-key values are never written to application logs.</div>
      </div>
    </MailShell>
  );
}