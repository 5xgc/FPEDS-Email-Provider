import { type ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><PageMetadata /><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;