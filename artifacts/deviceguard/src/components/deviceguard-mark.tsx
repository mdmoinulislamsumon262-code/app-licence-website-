import { ShieldCheck } from 'lucide-react';

export function DeviceGuardMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center ${compact ? 'gap-2' : 'gap-3'}`}>
      <div className={`${compact ? 'h-8 w-8' : 'h-10 w-10'} flex items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-sm`}>
        <ShieldCheck className={compact ? 'h-4 w-4' : 'h-5 w-5'} strokeWidth={2.4} />
      </div>
      <div>
        <p className={`${compact ? 'text-sm' : 'text-base'} font-bold tracking-[-0.03em]`}>DeviceGuard</p>
        {!compact && <p className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/55">Access Manager</p>}
      </div>
    </div>
  );
}