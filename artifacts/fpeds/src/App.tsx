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
    const title = page === "/inbox" ? "Inbox — FPEDS Mail" : page === "/starred" ? "Starred — FPEDS Mail" : page === "/sent" ? "Sent — FPEDS Mail" : page === "/drafts" ? "Drafts — FPEDS Mail" : page === "/spam" ? "Spam — FPEDS Mail" : page.startsWith("/folder/") ? `${decodeURIComponent(page.split("/")[2] ?? "Folder")} — FPEDS Mail` : page === "/compose" ? "Compose — FPEDS Mail" : page === "/settings" ? "Settings — FPEDS Mail" : "FPEDS Mail — Private email, without the noise";
    document.title = title;
    const description = document.querySelector('meta[name="description"]');
    description?.setAttribute("content", "FPEDS is a security-first private email provider for fpeds.jo3.org. No tracking, no behavioral profiling, and encrypted mailbox storage.");
  }, [location]);
  return null;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><PageMetadata /><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;