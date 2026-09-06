import { type ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import AuthPage from '@/pages/auth';
import ComposePage from '@/pages/compose';
import InboxPage from '@/pages/inbox';
import NotFound from '@/pages/not-found';
import SettingsPage from '@/pages/settings';
import { Route, Switch, useLocation, useRoute, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, retry: 1 } } });

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  return <RoutedErrorBoundary><Switch>
    <Route path="/" component={AuthPage} />
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

function CustomFolderRoute() {
  const [, params] = useRoute('/folder/:name');
  return <InboxPage folder={decodeURIComponent(params?.name ?? '')} />;
}

function PageMetadata() {
  const [location] = useLocation();
  useEffect(() => {
    const page = location.split("?")[0];
    const pageInfo = page === "/inbox"
      ? ["Inbox — FPEDS Mail", "Private inbox for focused, distraction-free email."]
      : page === "/starred"
        ? ["Starred messages — FPEDS Mail", "Your saved messages in the private FPEDS mailbox."]
        : page === "/sent"
          ? ["Sent mail — FPEDS Mail", "Review messages sent from your private FPEDS address."]
          : page === "/drafts"
            ? ["Drafts — FPEDS Mail", "Continue working on private email drafts."]
            : page === "/spam"
              ? ["Spam review — FPEDS Mail", "Review suspicious mail before it reaches your private inbox."]
              : page.startsWith("/folder/")
                ? [`${decodeURIComponent(page.split("/")[2] ?? "Folder")} — FPEDS Mail`, "A private mailbox folder for organized email."]
                : page === "/compose"
                  ? ["Compose email — FPEDS Mail", "Write and send private email without the noise."]
                  : page === "/settings"
                    ? ["Mailbox settings — FPEDS Mail", "Manage your private mailbox, folders, and notifications."]
                    : ["FPEDS Mail — Private email", "A private email workspace with focused inboxes, access-key accounts, and no behavioral tracking."];
    const [title, description] = pageInfo;
    document.title = title;
    const canonical = `${window.location.origin}${page || "/"}`;
    const setMeta = (selector: string, content: string) => {
      document.querySelector(selector)?.setAttribute("content", content);
    };
    setMeta('meta[name="description"]', description);
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[property="og:url"]', canonical);
    setMeta('meta[name="twitter:title"]', title);
    setMeta('meta[name="twitter:description"]', description);
    document.querySelector('link[rel="canonical"]')?.setAttribute("href", canonical);
  }, [location]);
  return null;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><PageMetadata /><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;