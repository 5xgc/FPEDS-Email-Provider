import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, ChevronRight, Clock3, MailOpen, RefreshCw, Search, ShieldAlert, Star, X } from 'lucide-react';
import { getGetMessageQueryKey, getGetMailboxSummaryQueryKey, getListMessagesQueryKey, useGetMessage, useGetMailboxSummary, useListMessages, useUpdateMessage } from '@workspace/api-client-react';
import type { Message } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorBlock, LoadingBlock, MailShell } from '@/components/mail-shell';

const formatDate = (date: string) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(date));
const initials = (name: string) => name.split(/[ @]/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();

function MessageRow({ message, select }: { message: Message; select: (id: string) => void }) {
  const queryClient = useQueryClient();
  const update = useUpdateMessage();
  const toggleStar = (event: React.MouseEvent) => { event.stopPropagation(); update.mutate({ id: message.id, data: { isStarred: !message.isStarred } }, { onSuccess: data => queryClient.setQueryData(getListMessagesQueryKey({ folder: message.folder }), (old: Message[] | undefined) => old?.map(item => item.id === data.id ? data : item)) }); };
  return <button onClick={() => select(message.id)} className={`group grid w-full grid-cols-[auto_1fr_auto] gap-3 border-b border-white/[.07] px-5 py-4 text-left transition-colors hover:bg-white/[.045] sm:grid-cols-[auto_190px_1fr_auto] ${!message.isRead ? 'bg-white/[.025]' : ''}`} data-testid={`row-message-${message.id}`}>
    <span className={`mt-1 grid h-8 w-8 place-items-center rounded-full text-[10px] font-bold ${!message.isRead ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'}`}>{initials(message.from)}</span><span className="min-w-0"><span className={`block truncate text-sm ${!message.isRead ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>{message.from}</span><span className="mt-1 block truncate text-xs text-muted-foreground sm:hidden">{message.subject}</span></span><span className="hidden min-w-0 sm:block"><span className={`block truncate text-sm ${!message.isRead ? 'font-semibold' : 'text-muted-foreground'}`}>{message.subject}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{message.preview}</span></span><span className="flex items-center gap-3 text-right"><span className="hidden font-mono text-[10px] text-muted-foreground lg:block">{formatDate(message.receivedAt)}</span><span onClick={toggleStar} role="button" tabIndex={0} className="opacity-0 transition-opacity group-hover:opacity-100" data-testid={`button-star-${message.id}`}><Star className={`h-4 w-4 ${message.isStarred ? 'fill-primary text-primary' : 'text-muted-foreground'}`} /></span><ChevronRight className="h-4 w-4 text-muted-foreground/40" /></span>
  </button>;
}

export default function InboxPage() {
  const [location, setLocation] = useLocation();
  const params = useMemo(() => new URLSearchParams(location.split('?')[1] ?? ''), [location]);
  const selectedId = params.get('message');
  const folder = params.get('folder') || 'inbox';
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const messagesQuery = useListMessages({ folder, q: search || undefined });
  const summaryQuery = useGetMailboxSummary();
  const messageQuery = useGetMessage(selectedId ?? '', { query: { enabled: !!selectedId, queryKey: getGetMessageQueryKey(selectedId ?? '') } });
  const update = useUpdateMessage();
  const messages = messagesQuery.data ?? [];
  const label = folder === 'inbox' ? 'Inbox' : folder[0].toUpperCase() + folder.slice(1);
  const select = (id: string) => setLocation(`/inbox?folder=${encodeURIComponent(folder)}&message=${encodeURIComponent(id)}`);
  const closeMessage = () => setLocation(`/inbox?folder=${encodeURIComponent(folder)}`);
  const markRead = (id: string) => update.mutate({ id, data: { isRead: true } }, { onSuccess: data => { queryClient.setQueryData(getGetMessageQueryKey(id), data); queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey({ folder }) }); queryClient.invalidateQueries({ queryKey: getGetMailboxSummaryQueryKey() }); } });
  if (messagesQuery.isLoading) return <MailShell><LoadingBlock label="Gathering your messages" /></MailShell>;
  return <MailShell><div className="mx-auto max-w-[1180px] p-5 sm:p-8">
    <div className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">Your quiet space</p><h1 className="mt-2 font-display text-4xl tracking-[-.04em]">{label}<span className="text-primary">.</span></h1><p className="mt-2 text-sm text-muted-foreground">{summaryQuery.data?.unread ?? 0} unread messages deserve your attention.</p></div><div className="flex items-center gap-3"><div className="relative flex-1 md:w-64"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search mailbox" className="h-10 rounded-xl bg-white/[.04] pl-9" data-testid="input-search-messages" /></div><Button variant="outline" size="icon" onClick={() => messagesQuery.refetch()} data-testid="button-refresh-messages"><RefreshCw className={`h-4 w-4 ${messagesQuery.isFetching ? 'animate-spin' : ''}`} /></Button></div></div>
    <div className="glass overflow-hidden rounded-2xl"><div className="flex items-center justify-between border-b hairline px-5 py-3"><span className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">{messages.length} conversations</span><span className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> secured session</span></div>
      {messagesQuery.isError ? <ErrorBlock retry={() => messagesQuery.refetch()} /> : messages.length === 0 ? <div className="px-6 py-24 text-center"><MailOpen className="mx-auto h-9 w-9 text-primary/50" /><h2 className="mt-4 font-display text-2xl">Nothing asking for you.</h2><p className="mt-2 text-sm text-muted-foreground">This space is clear. When something arrives, it will wait here.</p></div> : messages.map(message => <MessageRow key={message.id} message={message} select={id => { select(id); if (!message.isRead) markRead(id); }} />)}
    </div>
  </div>
  {selectedId && <div className="fixed inset-0 z-40 flex justify-end bg-black/55 backdrop-blur-sm"><article className="h-full w-full max-w-[720px] overflow-y-auto border-l hairline bg-[#0d0d0d] p-6 shadow-[-20px_0_80px_hsl(0_0%_0%/.4)] sm:p-10 animate-enter">{messageQuery.isLoading ? <LoadingBlock label="Opening message" /> : messageQuery.isError || !messageQuery.data ? <ErrorBlock retry={() => messageQuery.refetch()} /> : <><div className="mb-10 flex items-center justify-between"><button onClick={closeMessage} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" data-testid="button-close-message"><ArrowLeft className="h-4 w-4" /> All messages</button><div className="flex gap-2"><Button variant="outline" size="icon" onClick={() => update.mutate({ id: selectedId, data: { isStarred: !messageQuery.data?.isStarred } }, { onSuccess: data => queryClient.setQueryData(getGetMessageQueryKey(selectedId), data) })} data-testid="button-message-star"><Star className={`h-4 w-4 ${messageQuery.data.isStarred ? 'fill-primary text-primary' : ''}`} /></Button><Button variant="outline" size="icon" onClick={closeMessage} data-testid="button-message-dismiss"><X className="h-4 w-4" /></Button></div></div><div className="mb-8"><div className="mb-4 flex items-center gap-2"><span className="rounded-full bg-primary/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[.16em] text-primary">{messageQuery.data.folder}</span>{messageQuery.data.spamScore > .5 && <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[9px] text-primary"><ShieldAlert className="h-3 w-3" /> review carefully</span>}</div><h2 className="font-display text-4xl leading-tight tracking-[-.03em]">{messageQuery.data.subject}</h2><div className="mt-7 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">{initials(messageQuery.data.from)}</span><div><p className="text-sm font-semibold">{messageQuery.data.from}</p><p className="font-mono text-[10px] text-muted-foreground">to {messageQuery.data.to} · {formatDate(messageQuery.data.receivedAt)}</p></div></div></div><div className="border-t border-white/10 pt-8 whitespace-pre-wrap text-[15px] leading-8 text-foreground/75">{messageQuery.data.body}</div><div className="mt-12 flex items-center gap-2 border-t border-white/10 pt-5 text-xs text-muted-foreground"><Check className="h-4 w-4 text-primary" /> This message was delivered to your private mailbox.</div></>}</article></div>}
  </MailShell>;
}