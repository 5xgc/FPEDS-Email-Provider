import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGetCurrentUser } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import AuthPage from '@/pages/auth';
import ClaimPage from '@/pages/claim';
import CheckoutPage from '@/pages/checkout';
import ComposePage from '@/pages/compose';
import InboxPage from '@/pages/inbox';
import NotFound from '@/pages/not-found';
import SettingsPage from '@/pages/settings';
import AdminPage from '@/pages/admin';
import CheckPage from '@/pages/check';
import { Route, Switch, useLocation, useRoute, Router as WouterRouter } from 'wouter';
import { syncDocumentPreferences } from '@/lib/preferences';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, retry: 1 } } });

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  return <RoutedErrorBoundary><Switch>
    <Route path="/" component={SignupRedirect} />
    <Route path="/auth" component={AuthPage} />
    <Route path="/checkout" component={CheckoutPage} />
    <Route path="/claim" component={ClaimPage} />
    <Route path="/inbox">{() => <InboxPage folder="inbox" />}</Route>
    <Route path="/starred">{() => <InboxPage folder="starred" />}</Route>
    <Route path="/sent">{() => <InboxPage folder="sent" />}</Route>
    <Route path="/drafts">{() => <InboxPage folder="drafts" />}</Route>
    <Route path="/spam">{() => <InboxPage folder="spam" />}</Route>
    <Route path="/folder/:name">{() => <CustomFolderRoute />}</Route>
    <Route path="/compose" component={ComposePage} />
    <Route path="/settings" component={SettingsPage} />
    <Route path="/check" component={CheckPage} />
    <Route path="/admin" component={AdminPage} />
    <Route component={NotFound} />
  </Switch></RoutedErrorBoundary>;
}

function SignupRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation('/auth?mode=signup');
  }, [setLocation]);
  return null;
}

function CustomFolderRoute() {
  const [, params] = useRoute('/folder/:name');
  return <InboxPage folder={decodeURIComponent(params?.name ?? '')} />;
}

type PublicSiteStatus = {
  lockdown: boolean;
  lockdownMessage: string;
  announcement: { message: string; updatedAt: string } | null;
};

function SiteAccessGate({ children }: { children: ReactNode }) {
  const currentUser = useGetCurrentUser();
  const [location, setLocation] = useLocation();
  const [status, setStatus] = useState<PublicSiteStatus | null>(null);
  const [statusError, setStatusError] = useState(false);
  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/site/status', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('Site status unavailable');
      setStatus(await response.json() as PublicSiteStatus);
      setStatusError(false);
    } catch {
      setStatusError(true);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    const timer = window.setInterval(() => void refreshStatus(), 10_000);
    return () => window.clearInterval(timer);
  }, [refreshStatus]);

  if (!status && !statusError) {
    return <main className="grid min-h-[100dvh] place-items-center bg-black text-white"><p className="font-mono text-xs uppercase tracking-[.2em] text-white/50">Checking site availability…</p></main>;
  }
  if (statusError && !status) {
    return <main className="grid min-h-[100dvh] place-items-center bg-black px-6 text-white"><p role="alert" className="max-w-md text-center text-sm text-white/65">The service status could not be reached. Refresh this page before using the mailbox.</p></main>;
  }
  const role = String((currentUser.data as unknown as { role?: string } | undefined)?.role ?? '');
  if (status?.lockdown && currentUser.isLoading && !currentUser.data) {
    return <main className="grid min-h-[100dvh] place-items-center bg-black text-white"><p className="font-mono text-xs uppercase tracking-[.2em] text-white/50">Checking account access…</p></main>;
  }
  if (status?.lockdown && role !== 'admin') {
    const signedIn = Boolean(currentUser.data);
    if (!signedIn && location.split('?')[0] === '/auth') return <>{children}</>;
    return <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-black px-5 py-12 text-center text-white">
      <p className="font-mono text-[10px] uppercase tracking-[.28em] text-white/50">MoralTown service notice</p>
      <h1 className="mt-6 max-w-5xl text-balance text-4xl font-black leading-[1.04] tracking-[-.04em] sm:text-6xl md:text-8xl">
        {status.lockdownMessage || 'WEBSITE SHUT DOWN BY ADMIN | WILL BE BACK SOON'}
      </h1>
      <p className="mt-6 text-sm text-white/55">Mailbox access is temporarily unavailable.</p>
      {!signedIn && <button
        type="button"
        onClick={() => setLocation('/auth')}
        className="mt-7 rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        Admin sign in
      </button>}
      {signedIn && <button
        type="button"
        onClick={async () => {
          await fetch('/api/auth/signout', { method: 'POST', credentials: 'same-origin' });
          window.location.replace('/auth');
        }}
        className="mt-7 rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        Sign out
      </button>}
      <button
        type="button"
        onClick={() => window.location.replace('about:blank')}
        className="mt-3 rounded-xl border border-white/25 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        Close this page
      </button>
    </main>;
  }
  return <>{children}</>;
}

function PageMetadata() {
  const [location] = useLocation();
  useEffect(() => {
    const page = location.split("?")[0];
    const pageInfo = page === "/inbox"
      ? ["Inbox — MoralTown", "Your MoralTown inbox, in a focused email workspace."]
      : page === "/starred"
        ? ["Starred messages — MoralTown", "Your saved messages in the MoralTown mailbox."]
        : page === "/sent"
          ? ["Sent mail — MoralTown", "Review messages sent from your MoralTown address."]
          : page === "/drafts"
            ? ["Drafts — MoralTown", "Continue working on your MoralTown email drafts."]
            : page === "/spam"
              ? ["Spam review — MoralTown", "Review suspicious messages in your MoralTown mailbox."]
              : page.startsWith("/folder/")
                ? [`${decodeURIComponent(page.split("/")[2] ?? "Folder")} — MoralTown`, "A mailbox folder in your MoralTown workspace."]
                : page === "/compose"
                  ? ["Compose email — MoralTown", "Write and send email from your MoralTown workspace."]
                  : page === "/settings"
                    ? ["Mailbox settings — MoralTown", "Manage your MoralTown mailbox, folders, and notifications."]
                    : page === "/auth"
                      ? ["Sign in or create an account — MoralTown", "Use your MoralTown access key or create a mailbox."]
                      : page === "/checkout"
                        ? ["Lifetime access — MoralTown", "Choose a crypto payment method for one-time MoralTown lifetime access."]
                        : page === "/claim"
                          ? ["Create your MoralTown account", "Claim your verified MoralTown payment and create one account."]
                        : ["MoralTown — A calmer email workspace", "A quieter place to read and write email, with a focused mailbox and clear privacy boundaries."];
    const [title, description] = pageInfo;
    document.title = title;
    const canonical = `${window.location.origin}${page || "/"}`;
    const setMeta = (selector: string, content: string) => {
      document.querySelector(selector)?.setAttribute("content", content);
    };
    setMeta('meta[name="description"]', description);
    setMeta('meta[name="robots"]', "noindex, nofollow, noarchive");
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[property="og:url"]', canonical);
    setMeta('meta[name="twitter:title"]', title);
    setMeta('meta[name="twitter:description"]', description);
    let canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonical;
  }, [location]);
  return null;
}

function App() {
  useEffect(() => {
    const sync = () => syncDocumentPreferences();
    sync();
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><PageMetadata /><SiteAccessGate><Router /></SiteAccessGate></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;