import { useState } from 'react';
import { ExternalLink, ShieldAlert } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<]+)/gi;

function splitTrailingPunctuation(value: string) {
  const match = value.match(/[.,!?;:]+$/);
  if (!match) return { link: value, trailing: '' };
  return { link: value.slice(0, -match[0].length), trailing: match[0] };
}

function hrefFor(value: string) {
  return value.toLowerCase().startsWith('www.') ? `https://${value}` : value;
}

export function SafeLinkifiedText({
  body,
  messageId,
}: {
  body: string;
  messageId: string;
}) {
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const parts = body.split(URL_PATTERN);

  const openLink = () => {
    if (!pendingUrl) return;
    const opened = window.open(pendingUrl, '_blank', 'noopener,noreferrer');
    if (opened) opened.opener = null;
    setPendingUrl(null);
  };

  return (
    <>
      <div
        className="whitespace-pre-wrap break-words text-[15px] leading-8 text-foreground/80"
        data-testid={`message-body-${messageId}`}
      >
        {parts.map((part, index) => {
          if (index % 2 === 0) return <span key={`${messageId}-text-${index}`}>{part}</span>;
          const { link, trailing } = splitTrailingPunctuation(part);
          const href = hrefFor(link);
          return (
            <span key={`${messageId}-link-${index}`}>
              <a
                href={href}
                onClick={(event) => {
                  event.preventDefault();
                  setPendingUrl(href);
                }}
                className="break-all rounded-sm text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:bg-primary/10 hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                rel="noopener noreferrer"
                data-testid={`message-link-${messageId}-${index}`}
              >
                {link}
              </a>
              {trailing}
            </span>
          );
        })}
      </div>
      <AlertDialog open={Boolean(pendingUrl)} onOpenChange={(open) => !open && setPendingUrl(null)}>
        <AlertDialogContent className="glass border-white/15 sm:rounded-2xl">
          <AlertDialogHeader>
            <div className="mb-2 grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Leave your private mailbox?</AlertDialogTitle>
            <AlertDialogDescription>
              This link opens an external website. Check the address before continuing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-28 overflow-auto rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs leading-5 text-foreground/70">
            {pendingUrl}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid={`button-cancel-external-link-${messageId}`}>Stay here</AlertDialogCancel>
            <AlertDialogAction onClick={openLink} data-testid={`button-open-external-link-${messageId}`}>
              <ExternalLink className="h-4 w-4" />
              Open link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}