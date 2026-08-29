import { ArrowLeft, ShieldQuestion } from 'lucide-react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const [, setLocation] = useLocation();
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-5">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-primary"><ShieldQuestion className="h-8 w-8" /></div>
        <p className="font-mono-ui text-[10px] uppercase tracking-[0.2em] text-primary">Signal not found</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.05em]">This route is outside the perimeter.</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">The page you requested does not exist in this console.</p>
        <Button data-testid="button-return-console" className="mt-7" onClick={() => setLocation('/')}><ArrowLeft className="h-4 w-4" />Return to console</Button>
      </div>
    </div>
  );
}
