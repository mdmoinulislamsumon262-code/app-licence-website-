import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { LoginPage } from '@/pages/login';
import { DeviceGuardConsole } from '@/components/deviceguard-console';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import {
  Route,
  Switch,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Home() {
  const [session, setSession] = useState<{ token: string; username: string } | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem('deviceguard_token');
    const username = window.localStorage.getItem('deviceguard_username');
    if (token) setSession({ token, username: username || 'Administrator' });
  }, []);

  const handleLogin = (token: string, username: string) => {
    window.localStorage.setItem('deviceguard_token', token);
    window.localStorage.setItem('deviceguard_username', username);
    setSession({ token, username });
  };

  const handleLogout = () => {
    window.localStorage.removeItem('deviceguard_token');
    window.localStorage.removeItem('deviceguard_username');
    setSession(null);
  };

  return session ? <DeviceGuardConsole username={session.username} onLogout={handleLogout} /> : <LoginPage onLogin={handleLogin} />;
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary resetKey="/">{children}</ErrorBoundary>;
}

function App() {
  useEffect(() => {
    setAuthTokenGetter(() => window.localStorage.getItem('deviceguard_token'));
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
