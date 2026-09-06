import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  MailOpen,
  RefreshCw,
  Search,
  ShieldAlert,
  Star,
  X,
} from 'lucide-react';
import {
  getGetMessageQueryKey,
  getGetMailboxSummaryQueryKey,
  getListMessagesQueryKey,
  useGetMessage,
  useGetMailboxSummary,
  useListMessages,
  useUpdateMessage,
} from '@workspace/api-client-react';
import type { Message } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorBlock, LoadingBlock, MailShell } from '@/components/mail-shell';
import { SafeLinkifiedText } from '@/components/safe-linkified-text';

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date));

const initials = (name: string) =>
  name
    .split(/[ @]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

function MessageRow({ message, select }: { message: Message; select: (id: string) => void }) {
  const queryClient = useQueryClient();
  const update = useUpdateMessage();

  const toggleStar = (event: React.MouseEvent) => {
    event.stopPropagation();
    update.mutate(
      { id: message.id, data: { isStarred: !message.isStarred } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(
            getListMessagesQueryKey({ folder: message.folder }),
            (old: Message[] | undefined) => old?.map((item) => (item.id === data.id ? data : item)),
          );
          queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey() });
        },
      },
    );
  };

  return (
    <article
      onClick={() => select(message.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          select(message.id);
        }
      }}
      className={`group grid w-full cursor-pointer grid-cols-[auto_1fr_auto] gap-3 border-b border-white/[.07] px-4 py-4 text-left transition-all duration-300 hover:bg-white/[.055] hover:shadow-[inset_3px_0_0_hsl(0_72%_55%/.65)] focus-visible:bg-white/[.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:grid-cols-[auto_190px_1fr_auto] sm:px-5 ${
        !message.isRead ? 'bg-white/[.025]' : ''
      }`}
      data-testid={`row-message-${message.id}`}
      role="button"
      tabIndex={0}
    >
      <span
        className={`mt-1 grid h-8 w-8 place-items-center rounded-full text-[10px] font-bold ${
          !message.isRead ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'
        }`}
      >
        {initials(message.from)}
      </span>
      <span className="min-w-0">
        <span className={`block truncate text-sm ${!message.isRead ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
          {message.from}
        </span>
        <span className="mt-1 block truncate text-xs text-muted-foreground sm:hidden">{message.subject}</span>
      </span>
      <span className="hidden min-w-0 sm:block">
        <span className={`block truncate text-sm ${!message.isRead ? 'font-semibold' : 'text-muted-foreground'}`}>
          {message.subject}
        </span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">{message.preview}</span>
      </span>
      <span className="flex items-center gap-2 text-right sm:gap-3">
        <span className="hidden font-mono text-[10px] text-muted-foreground lg:block">{formatDate(message.receivedAt)}</span>
        <button
          type="button"
          onClick={toggleStar}
          aria-label={message.isStarred ? 'Unstar message' : 'Star message'}
          aria-pressed={message.isStarred}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground opacity-70 transition-all hover:bg-primary/10 hover:text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:opacity-0 sm:group-hover:opacity-100"
          data-testid={`button-star-${message.id}`}
        >
          <Star className={`h-4 w-4 ${message.isStarred ? 'fill-primary text-primary' : ''}`} />
        </button>
        <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
      </span>
    </article>
  );
}

export default function InboxPage({ folder }: { folder: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const messagesQuery = useListMessages(
    { folder, q: search || undefined },
    {
      query: {
        queryKey: getListMessagesQueryKey({ folder, q: search || undefined }),
        refetchInterval: 5000,
        refetchIntervalInBackground: true,
        refetchOnWindowFocus: true,
      },
    },
  );
  const summaryQuery = useGetMailboxSummary({
    query: {
      queryKey: getGetMailboxSummaryQueryKey(),
      refetchInterval: 5000,
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: true,
    },
  });
  const messageQuery = useGetMessage(selectedId ?? '', {
    query: {
      enabled: Boolean(selectedId),
      queryKey: getGetMessageQueryKey(selectedId ?? ''),
    },
  });
  const update = useUpdateMessage();
  const messages = messagesQuery.data ?? [];
  const label = folder === 'inbox' ? 'Inbox' : folder[0].toUpperCase() + folder.slice(1);

  const select = (id: string) => setSelectedId(id);
  const closeMessage = () => setSelectedId(null);
  const markRead = (id: string) =>
    update.mutate(
      { id, data: { isRead: true } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetMessageQueryKey(id), data);
          queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey({ folder }) });
          queryClient.invalidateQueries({ queryKey: getGetMailboxSummaryQueryKey() });
        },
      },
    );
  const toggleDetailStar = () => {
    if (!selectedId || !messageQuery.data) return;
    update.mutate(
      { id: selectedId, data: { isStarred: !messageQuery.data.isStarred } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetMessageQueryKey(selectedId), data);
          queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey() });
        },
      },
    );
  };

  if (messagesQuery.isLoading) {
    return (
      <MailShell>
        <LoadingBlock label="Gathering your messages" />
      </MailShell>
    );
  }

  return (
    <MailShell>
      <div className="mx-auto max-w-[1180px] p-4 sm:p-6 md:p-8">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:mb-7 sm:gap-5 md:flex-row md:items-end">
          <div className="animate-enter">
            <p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">Your quiet space</p>
            <h1 className="mt-2 font-display text-3xl tracking-[-.04em] sm:text-4xl">
              {label}
              <span className="text-primary">.</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {summaryQuery.data?.unread ?? 0} unread messages deserve your attention.
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative min-w-0 flex-1 md:w-64">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search mailbox"
                className="h-10 rounded-xl border-white/10 bg-white/[.04] pl-9 transition-colors focus:border-primary/50"
                data-testid="input-search-messages"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => messagesQuery.refetch()}
              className="shrink-0 border-white/15 bg-white/[.03]"
              aria-label="Refresh messages"
              data-testid="button-refresh-messages"
            >
              <RefreshCw className={`h-4 w-4 ${messagesQuery.isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        <div className="glass overflow-hidden rounded-2xl animate-enter animate-enter-1">
          <div className="flex items-center justify-between border-b hairline px-4 py-3 sm:px-5">
            <span className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">
              {messages.length} conversations
            </span>
            <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> secured session
            </span>
          </div>
          {messagesQuery.isError ? (
            <ErrorBlock retry={() => messagesQuery.refetch()} />
          ) : messages.length === 0 ? (
            <div className="px-6 py-24 text-center">
              <MailOpen className="mx-auto h-9 w-9 text-primary/50" />
              <h2 className="mt-4 font-display text-2xl">Nothing asking for you.</h2>
              <p className="mt-2 text-sm text-muted-foreground">This space is clear. When something arrives, it will wait here.</p>
            </div>
          ) : (
            messages.map((message) => (
              <MessageRow
                key={message.id}
                message={message}
                select={(id) => {
                  select(id);
                  if (!message.isRead) markRead(id);
                }}
              />
            ))
          )}
        </div>
      </div>
      {selectedId && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-md"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeMessage();
          }}
        >
          <article className="h-full w-full max-w-[760px] overflow-y-auto border-l border-white/10 bg-[#0d0d0d]/95 shadow-[-20px_0_80px_hsl(0_0%_0%/.45)] animate-enter">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-[#0d0d0d]/90 px-4 py-3 backdrop-blur-xl sm:px-8">
              <button
                onClick={closeMessage}
                className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/[.05] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                data-testid="button-close-message"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span className="truncate">All messages</span>
              </button>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleDetailStar}
                  className="border-white/15 bg-white/[.04] text-muted-foreground hover:border-primary/50 hover:text-primary"
                  aria-label={messageQuery.data?.isStarred ? 'Unstar message' : 'Star message'}
                  aria-pressed={messageQuery.data?.isStarred}
                  data-testid="button-message-star"
                >
                  <Star className={`h-4 w-4 ${messageQuery.data?.isStarred ? 'fill-primary text-primary' : ''}`} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={closeMessage}
                  className="border-white/15 bg-white/[.04] text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  aria-label="Close message"
                  data-testid="button-message-dismiss"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {messageQuery.isLoading ? (
              <LoadingBlock label="Opening message" />
            ) : messageQuery.isError || !messageQuery.data ? (
              <ErrorBlock retry={() => messageQuery.refetch()} />
            ) : (
              <div className="px-5 pb-10 pt-7 sm:px-10 sm:pb-12 sm:pt-9">
                <div className="mb-8">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[.16em] text-primary">
                      {messageQuery.data.folder}
                    </span>
                    {messageQuery.data.spamScore > 0.5 && (
                      <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[9px] text-primary">
                        <ShieldAlert className="h-3 w-3" /> review carefully
                      </span>
                    )}
                  </div>
                  <h2 className="break-words font-display text-3xl leading-tight tracking-[-.03em] sm:text-4xl">
                    {messageQuery.data.subject}
                  </h2>
                  <div className="mt-6 flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                      {initials(messageQuery.data.from)}
                    </span>
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold">{messageQuery.data.from}</p>
                      <p className="break-words font-mono text-[10px] text-muted-foreground">
                        to {messageQuery.data.to} · {formatDate(messageQuery.data.receivedAt)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="border-t border-white/10 pt-6 sm:pt-8">
                  <SafeLinkifiedText body={messageQuery.data.body} messageId={messageQuery.data.id} />
                </div>
                <div className="mt-10 flex items-start gap-2 border-t border-white/10 pt-5 text-xs text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  This message was delivered to your private mailbox.
                </div>
              </div>
            )}
          </article>
        </div>
      )}
    </MailShell>
  );
}