import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck, Wifi } from 'lucide-react';
import { useAdminLogin } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { DeviceGuardMark } from '@/components/deviceguard-mark';

export function LoginPage({ onLogin }: { onLogin: (token: string, username: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const login = useAdminLogin();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('Enter your administrator username and password.');
      return;
    }
    login.mutate({ data: { username: username.trim(), password } }, {
      onSuccess: (result) => {
        if (!result.success || !result.data?.token) {
          setError('Those credentials were not accepted.');
          return;
        }
        onLogin(result.data.token, result.data.username);
      },
      onError: (requestError) => setError(requestError instanceof Error ? requestError.message : 'Sign in failed. Try again.'),
    });
  };

  return <div className="min-h-[100dvh] bg-[#e9e6dc] text-foreground">
    <div className="grid min-h-[100dvh] lg:grid-cols-[minmax(400px,0.92fr)_1.08fr]">
      <section className="relative hidden overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 top-24 h-96 w-96 rounded-full border border-accent/15" /><div className="absolute -right-20 top-36 h-72 w-72 rounded-full border border-accent/10" /><div className="absolute bottom-12 left-[-90px] h-64 w-64 rounded-full border border-sidebar-border" />
        <DeviceGuardMark />
        <div className="relative max-w-md pb-12"><div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent"><ShieldCheck className="h-8 w-8" /></div><h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-[-0.06em]">Access is a<br /><span className="text-accent">decision.</span></h1><p className="mt-6 max-w-sm text-base leading-7 text-sidebar-foreground/60">A quiet control room for the devices that matter. Review requests, make the call, keep your perimeter clear.</p><div className="mt-10 flex items-center gap-4 border-t border-sidebar-border pt-5 text-xs text-sidebar-foreground/50"><div className="flex items-center gap-2"><Wifi className="h-3.5 w-3.5 text-emerald-400" />API online</div><span className="h-1 w-1 rounded-full bg-sidebar-border" /><span className="font-mono-ui">SECURE CONSOLE</span></div></div>
        <p className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/35">Android access management · 01</p>
      </section>
      <section className="flex min-h-[100dvh] items-center justify-center px-5 py-12 sm:px-10"><div className="w-full max-w-[420px]"><div className="mb-12 lg:hidden"><DeviceGuardMark compact /></div><div className="mb-10"><div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"><KeyRound className="h-5 w-5" /></div><p className="font-mono-ui text-[10px] uppercase tracking-[0.2em] text-primary">Administrator sign in</p><h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Welcome back.</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Sign in to review device access for your application.</p></div><form onSubmit={submit} className="space-y-5"><label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-foreground/70">Username</span><div className="relative"><LockKeyhole className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><input data-testid="input-login-username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="admin" className="h-11 w-full rounded-lg border border-input bg-card pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" /></div></label><label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-foreground/70">Password</span><div className="relative"><input data-testid="input-login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Enter password" className="h-11 w-full rounded-lg border border-input bg-card px-3 pr-11 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" /><button data-testid="button-toggle-password" type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>{error && <div data-testid="error-login" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm leading-5 text-rose-900"><span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-600" />{error}</div>}<Button data-testid="button-submit-login" type="submit" className="mt-2 h-11 w-full" disabled={login.isPending}>{login.isPending ? 'Checking credentials…' : <><span>Enter console</span><ArrowRight className="h-4 w-4" /></>}</Button></form><div className="mt-12 flex items-center gap-3 border-t border-border pt-5 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" /><span>Protected administrator session</span><span className="ml-auto font-mono-ui text-[10px]">TLS / AUTH</span></div></div></section>
    </div>
  </div>;
}