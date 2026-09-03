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
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, retry: 1 } } });

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  return <RoutedErrorBoundary><Switch><Route path="/" component={AuthPage} /><Route path="/inbox" component={InboxPage} /><Route path="/compose" component={ComposePage} /><Route path="/settings" component={SettingsPage} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}

function PageMetadata() {
  const [location] = useLocation();
  useEffect(() => {
    const page = location.split("?")[0];
    const title = page === "/inbox" ? "Inbox — FPEDS Mail" : page === "/compose" ? "Compose — FPEDS Mail" : page === "/settings" ? "Settings — FPEDS Mail" : "FPEDS Mail — Private email, without the noise";
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