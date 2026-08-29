import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Fingerprint,
  Globe2,
  HardDrive,
  Info,
  Laptop,
  LogOut,
  MapPin,
  Menu,
  MoreHorizontal,
  Package,
  Phone,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import {
  DeviceStatus,
  getGetAdminStatsQueryKey,
  getListAdminDevicesQueryKey,
  getListAdminLogsQueryKey,
  useApproveAdminDevice,
  useDeleteAdminDevice,
  useGetAdminStats,
  useListAdminDevices,
  useListAdminLogs,
  useRejectAdminDevice,
  type ActivityLog,
  type Device,
  type ListAdminDevicesStatus,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { DeviceGuardMark } from '@/components/deviceguard-mark';

type FilterStatus = 'ALL' | ListAdminDevicesStatus;

const statusMeta: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  PENDING: { label: 'Pending review', className: 'bg-amber-100 text-amber-900 border-amber-200', icon: Clock3 },
  APPROVED: { label: 'Approved', className: 'bg-emerald-100 text-emerald-900 border-emerald-200', icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', className: 'bg-rose-100 text-rose-900 border-rose-200', icon: XCircle },
  BANNED: { label: 'Blocked', className: 'bg-slate-200 text-slate-700 border-slate-300', icon: ShieldAlert },
  EXPIRED: { label: 'Expired', className: 'bg-violet-100 text-violet-900 border-violet-200', icon: AlertTriangle },
};

const permissionMeta: Record<string, { label: string; icon: typeof Globe2 }> = {
  internet: { label: 'Internet', icon: Globe2 },
  device_info: { label: 'Device info', icon: Fingerprint },
  notifications: { label: 'Notifications', icon: Bell },
  camera: { label: 'Camera', icon: Camera },
  location: { label: 'Location', icon: MapPin },
  storage: { label: 'Storage', icon: HardDrive },
  contacts: { label: 'Contacts', icon: Info },
  phone: { label: 'Phone', icon: Phone },
};

function PermissionChip({ permission, muted = false }: { permission: string; muted?: boolean }) {
  const meta = permissionMeta[permission] ?? { label: permission.replaceAll('_', ' '), icon: Shield };
  const Icon = meta.icon;
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${muted ? 'border-border bg-background text-muted-foreground' : 'border-primary/15 bg-primary/8 text-primary'}`}><Icon className="h-3 w-3" />{meta.label}</span>;
}

function formatDate(value?: string | null, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', withTime ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function relativeDate(value: string) {
  const date = new Date(value);
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 2) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

function StatusPill({ status }: { status: string }) {
  const meta = statusMeta[status] ?? statusMeta.PENDING;
  const Icon = meta.icon;
  return <span data-testid={`status-device-${status.toLowerCase()}`} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[-0.01em] ${meta.className}`}><Icon className="h-3.5 w-3.5" />{meta.label}</span>;
}

function SkeletonRows() {
  return <div className="divide-y divide-border/70">{[1, 2, 3, 4].map((row) => <div key={row} className="grid grid-cols-[1.6fr_1fr_1fr_1.1fr_116px] gap-4 px-5 py-5 max-md:flex max-md:flex-col"><div className="skeleton h-5 w-44 rounded" /><div className="skeleton h-4 w-28 rounded" /><div className="skeleton h-4 w-24 rounded" /><div className="skeleton h-4 w-32 rounded" /><div className="skeleton h-8 w-24 rounded" /></div>)}</div>;
}

function EmptyDevices({ hasFilter, onClear }: { hasFilter: boolean; onClear: () => void }) {
  return <div data-testid="empty-devices" className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary"><Search className="h-6 w-6" /></div>
    <h3 className="font-display text-lg font-semibold">{hasFilter ? 'No devices match that view' : 'No devices registered yet'}</h3>
    <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{hasFilter ? 'Try a different device name, identifier, or status filter.' : 'New device handshakes will appear here for review.'}</p>
    {hasFilter && <Button data-testid="button-clear-device-filter" variant="outline" size="sm" className="mt-5" onClick={onClear}>Clear filters</Button>}
  </div>;
}

function DeviceActions({ device, onApprove, onReject, onDelete }: { device: Device; onApprove: (device: Device) => void; onReject: (device: Device) => void; onDelete: (device: Device) => void }) {
  const [open, setOpen] = useState(false);
  return <div className="relative flex justify-end">
    <Button data-testid={`button-device-actions-${device.id}`} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setOpen((value) => !value)} aria-label="Open device actions"><MoreHorizontal className="h-4 w-4" /></Button>
    {open && <><button data-testid={`button-close-actions-${device.id}`} aria-label="Close actions" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} /><div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-xl">
      {device.status === DeviceStatus.PENDING && <button data-testid={`button-approve-device-${device.id}`} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-primary hover:bg-secondary" onClick={() => { setOpen(false); onApprove(device); }}><Check className="h-4 w-4" />Approve access</button>}
      {device.status !== DeviceStatus.REJECTED && device.status !== DeviceStatus.BANNED && <button data-testid={`button-reject-device-${device.id}`} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50" onClick={() => { setOpen(false); onReject(device); }}><XCircle className="h-4 w-4" />Block device</button>}
      <button data-testid={`button-delete-device-${device.id}`} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary" onClick={() => { setOpen(false); onDelete(device); }}><Trash2 className="h-4 w-4" />Delete record</button>
    </div></>}
  </div>;
}

function ActivityFeed({ logs, isLoading, isError, onRetry }: { logs: ActivityLog[]; isLoading: boolean; isError: boolean; onRetry: () => void }) {
  const actionCopy = (action: string) => {
    const normalized = action.toLowerCase();
    if (normalized.includes('approv')) return { text: 'Access approved', color: 'bg-emerald-600', icon: Check };
    if (normalized.includes('reject') || normalized.includes('block')) return { text: 'Device blocked', color: 'bg-rose-600', icon: X };
    if (normalized.includes('delet')) return { text: 'Record deleted', color: 'bg-slate-500', icon: Trash2 };
    return { text: action.replaceAll('_', ' '), color: 'bg-amber-500', icon: Activity };
  };
  return <section className="rounded-2xl border border-border bg-card panel-shadow">
    <div className="flex items-center justify-between border-b border-border/70 px-5 py-4"><div><p className="font-display font-semibold">Recent activity</p><p className="mt-0.5 text-xs text-muted-foreground">A live trail of access decisions</p></div><Activity className="h-4 w-4 text-muted-foreground" /></div>
    {isLoading ? <div className="space-y-4 p-5">{[1, 2, 3].map((item) => <div key={item} className="flex gap-3"><div className="skeleton h-8 w-8 rounded-full" /><div className="flex-1 space-y-2"><div className="skeleton h-3 w-32 rounded" /><div className="skeleton h-3 w-24 rounded" /></div></div>)}</div> : isError ? <div data-testid="error-activity" className="p-5 text-sm text-muted-foreground"><p>Activity could not be loaded.</p><button data-testid="button-retry-activity" className="mt-2 font-semibold text-primary" onClick={onRetry}>Try again</button></div> : logs.length === 0 ? <div data-testid="empty-activity" className="p-8 text-center text-sm text-muted-foreground">No access decisions have been recorded.</div> : <div className="divide-y divide-border/60">{logs.slice(0, 7).map((log) => { const action = actionCopy(log.action); const Icon = action.icon; return <div data-testid={`activity-log-${log.id}`} key={log.id} className="flex items-start gap-3 px-5 py-4"><div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${action.color}`}><Icon className="h-3.5 w-3.5" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold capitalize">{action.text}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{log.device_name || log.device_id || 'Unknown device'} <span className="mx-1 text-border">·</span> {log.ip_address || 'No IP'}</p></div><time className="shrink-0 pt-0.5 font-mono-ui text-[10px] text-muted-foreground">{relativeDate(log.created_at)}</time></div>; })}</div>}
  </section>;
}

export function DeviceGuardConsole({ username, onLogout }: { username: string; onLogout: () => void }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<FilterStatus>('ALL');
  const [mobileNav, setMobileNav] = useState(false);
  const [approveDevice, setApproveDevice] = useState<Device | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'reject' | 'delete'; device: Device } | null>(null);
  const [duration, setDuration] = useState('30');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const params = useMemo(() => ({ search: search.trim() || undefined, status: status === 'ALL' ? undefined : status }), [search, status]);
  const statsQuery = useGetAdminStats({ query: { queryKey: getGetAdminStatsQueryKey(), refetchInterval: 30000 } });
  const devicesQuery = useListAdminDevices(params);
  const logsQuery = useListAdminLogs({ query: { queryKey: getListAdminLogsQueryKey(), refetchInterval: 30000 } });
  const approveMutation = useApproveAdminDevice();
  const rejectMutation = useRejectAdminDevice();
  const deleteMutation = useDeleteAdminDevice();
  const stats = statsQuery.data?.data;
  const devices = devicesQuery.data?.data?.devices ?? [];
  const logs = logsQuery.data?.data?.logs ?? [];
  const isMutating = approveMutation.isPending || rejectMutation.isPending || deleteMutation.isPending;

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAdminDevicesQueryKey(params) });
    queryClient.invalidateQueries({ queryKey: getListAdminLogsQueryKey() });
  };
  const showError = (error: unknown) => setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'The action could not be completed.' });
  const runApprove = () => {
    if (!approveDevice) return;
    approveMutation.mutate({ id: approveDevice.id, data: { duration_days: Number(duration), granted_permissions: selectedPermissions } }, { onSuccess: (result) => { setNotice({ kind: 'success', text: result.message || 'Device access approved.' }); setApproveDevice(null); refresh(); }, onError: showError });
  };
  const runConfirm = () => {
    if (!confirmAction) return;
    const { type, device } = confirmAction;
    const mutation = type === 'reject' ? rejectMutation : deleteMutation;
    mutation.mutate({ id: device.id }, { onSuccess: (result) => { setNotice({ kind: 'success', text: result.message || (type === 'reject' ? 'Device blocked.' : 'Device record deleted.') }); setConfirmAction(null); refresh(); }, onError: showError });
  };
  const resetFilters = () => { setSearch(''); setStatus('ALL'); };

  return <div className="min-h-[100dvh] bg-background text-foreground">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 md:translate-x-0 ${mobileNav ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-[82px] items-center border-b border-sidebar-border px-6"><DeviceGuardMark /></div>
      <div className="flex-1 px-3 py-6">
        <p className="px-3 pb-3 font-mono-ui text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/40">Workspace</p>
        <button data-testid="button-nav-devices" className="flex w-full items-center gap-3 rounded-xl bg-sidebar-accent px-3 py-2.5 text-sm font-semibold text-sidebar-accent-foreground"><Laptop className="h-4 w-4 text-accent" />License control</button>
        <div className="mt-8 rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-4"><div className="mb-3 flex items-center gap-2 text-xs font-semibold"><span className="h-2 w-2 rounded-full bg-emerald-400" />API connection healthy</div><p className="text-xs leading-5 text-sidebar-foreground/55">Decisions are enforced on the next device handshake.</p></div>
      </div>
      <div className="border-t border-sidebar-border p-4"><div className="mb-3 flex items-center gap-3 px-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-accent font-display text-sm font-bold">{username.slice(0, 1).toUpperCase()}</div><div className="min-w-0"><p data-testid="text-sidebar-username" className="truncate text-sm font-semibold">{username}</p><p className="text-[11px] text-sidebar-foreground/50">Administrator</p></div></div><button data-testid="button-logout-sidebar" onClick={onLogout} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"><LogOut className="h-3.5 w-3.5" />Sign out</button></div>
    </aside>
    {mobileNav && <button data-testid="button-close-mobile-nav" aria-label="Close navigation" className="fixed inset-0 z-30 bg-slate-900/35 md:hidden" onClick={() => setMobileNav(false)} />}
    <main className="min-h-[100dvh] md:pl-[248px]">
      <header className="sticky top-0 z-20 flex h-[82px] items-center justify-between border-b border-border/80 bg-background/90 px-5 backdrop-blur-md md:px-10"><div className="flex items-center gap-3"><button data-testid="button-open-mobile-nav" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary md:hidden" onClick={() => setMobileNav(true)}><Menu className="h-5 w-5" /></button><div><p className="font-mono-ui text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Operations / Live</p><h1 className="font-display text-xl font-semibold tracking-[-0.03em] md:text-2xl">License control</h1></div></div><div className="flex items-center gap-2"><span className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Live monitoring</span><button data-testid="button-logout-header" onClick={onLogout} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"><LogOut className="h-4 w-4" /></button><Button data-testid="button-refresh-dashboard" variant="outline" size="sm" className="hidden gap-2 sm:flex" onClick={refresh}><RefreshCw className={`h-3.5 w-3.5 ${statsQuery.isFetching || devicesQuery.isFetching ? 'animate-spin' : ''}`} />Refresh</Button></div></header>
      <div className="mx-auto max-w-[1480px] px-5 py-7 md:px-10 md:py-9">
        {notice && <div data-testid={`status-notice-${notice.kind}`} className={`mb-5 flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${notice.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}><div className="flex items-center gap-2">{notice.kind === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{notice.text}</div><button data-testid="button-dismiss-notice" onClick={() => setNotice(null)}><X className="h-4 w-4" /></button></div>}
        <section className="stagger-in grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total devices" value={stats?.total} icon={<Laptop />} accent="navy" loading={statsQuery.isLoading} />
          <StatCard label="Pending review" value={stats?.pending} icon={<Clock3 />} accent="amber" loading={statsQuery.isLoading} />
          <StatCard label="Approved access" value={stats?.approved} icon={<ShieldCheck />} accent="green" loading={statsQuery.isLoading} />
          <StatCard label="Rejected / blocked" value={stats?.rejected} icon={<ShieldAlert />} accent="rose" loading={statsQuery.isLoading} />
        </section>
        {statsQuery.isError && <div data-testid="error-stats" className="mt-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"><span>Summary is temporarily unavailable.</span><button data-testid="button-retry-stats" className="font-semibold" onClick={() => statsQuery.refetch()}>Retry</button></div>}
        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="stagger-in stagger-1 min-w-0 rounded-2xl border border-border bg-card panel-shadow">
            <div className="flex flex-col gap-4 border-b border-border/70 px-5 py-5 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="font-display text-lg font-semibold">Registered devices</h2><p className="mt-1 text-xs text-muted-foreground">Review who can reach your application.</p></div><div className="flex flex-col gap-2 sm:flex-row"><label className="relative flex min-w-0 items-center sm:w-64"><Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" /><input data-testid="input-device-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or identifier" className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" /></label><label className="relative"><select data-testid="select-device-status" value={status} onChange={(event) => setStatus(event.target.value as FilterStatus)} className="h-9 w-full appearance-none rounded-lg border border-input bg-background py-0 pl-3 pr-9 text-sm outline-none focus:border-primary sm:w-40"><option value="ALL">All statuses</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="BANNED">Blocked</option><option value="EXPIRED">Expired</option></select><ChevronDown className="pointer-events-none absolute right-3 top-3 h-3.5 w-3.5 text-muted-foreground" /></label></div></div>
             <div className="hidden grid-cols-[1.6fr_1fr_1fr_1.1fr_116px] gap-4 border-b border-border/60 bg-secondary/35 px-5 py-3 font-mono-ui text-[10px] uppercase tracking-[0.12em] text-muted-foreground md:grid"><span>App / device</span><span>Status</span><span>Last active</span><span>Access until</span><span /></div>
             {devicesQuery.isLoading ? <SkeletonRows /> : devicesQuery.isError ? <div data-testid="error-devices" className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center"><div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><AlertTriangle className="h-5 w-5" /></div><h3 className="font-display font-semibold">Could not load devices</h3><p className="mt-1 text-sm text-muted-foreground">Check the connection and try again.</p><button data-testid="button-retry-devices" className="mt-4 font-semibold text-primary" onClick={() => devicesQuery.refetch()}>Retry request</button></div> : devices.length === 0 ? <EmptyDevices hasFilter={Boolean(search || status !== 'ALL')} onClear={resetFilters} /> : <div className="divide-y divide-border/70">{devices.map((device) => <DeviceRow key={device.id} device={device} onApprove={(item) => { setApproveDevice(item); setDuration('30'); setSelectedPermissions(item.requested_permissions ?? []); }} onReject={(item) => setConfirmAction({ type: 'reject', device: item })} onDelete={(item) => setConfirmAction({ type: 'delete', device: item })} />)}</div>}
            {devices.length > 0 && <div className="border-t border-border/60 px-5 py-3 text-xs text-muted-foreground">{devices.length} device{devices.length === 1 ? '' : 's'} in this view</div>}
          </section>
          <div className="stagger-in stagger-2"><ActivityFeed logs={logs} isLoading={logsQuery.isLoading} isError={logsQuery.isError} onRetry={() => logsQuery.refetch()} /></div>
        </div>
      </div>
    </main>
    {approveDevice && <Modal title="Approve device access" eyebrow="Create a scoped license" onClose={() => setApproveDevice(null)}><div className="space-y-5"><div className="rounded-xl border border-border bg-secondary/50 p-4"><div className="flex items-center gap-3"><DeviceAvatar device={approveDevice} /><div className="min-w-0"><p className="truncate font-semibold">{approveDevice.device_name || 'Unnamed device'}</p><p className="truncate font-mono-ui text-xs text-muted-foreground">{approveDevice.app_name || approveDevice.app_id} · {approveDevice.device_id}</p></div></div></div><label className="block"><span className="text-sm font-semibold">Access duration</span><span className="mt-1 block text-xs text-muted-foreground">Use 0 for an unlimited license. The app must validate this license before use.</span><div className="relative mt-3"><input data-testid="input-approval-duration" type="number" min="0" max="3650" value={duration} onChange={(event) => setDuration(event.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3 pr-16 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" /><span className="absolute right-3 top-3 text-sm text-muted-foreground">days</span></div></label><div><div className="mb-2 flex items-center justify-between"><div><p className="text-sm font-semibold">Permissions to grant</p><p className="text-xs text-muted-foreground">Only checked permissions are included in the license.</p></div><span className="font-mono-ui text-[10px] text-primary">{selectedPermissions.length}/{approveDevice.requested_permissions?.length ?? 0}</span></div>{(approveDevice.requested_permissions ?? []).length === 0 ? <div className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">This app did not request any additional permissions.</div> : <div className="grid gap-2 sm:grid-cols-2">{(approveDevice.requested_permissions ?? []).map((permission) => { const checked = selectedPermissions.includes(permission); return <label key={permission} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition ${checked ? 'border-primary/30 bg-primary/5 text-primary' : 'border-border bg-background text-muted-foreground hover:border-primary/20'}`}><input data-testid={`checkbox-permission-${permission}`} type="checkbox" checked={checked} onChange={() => setSelectedPermissions((current) => checked ? current.filter((item) => item !== permission) : [...current, permission])} className="accent-[hsl(var(--primary))]" /><PermissionChip permission={permission} muted={!checked} /></label>; })}</div>}</div><div className="flex justify-end gap-2"><Button data-testid="button-cancel-approval" variant="outline" onClick={() => setApproveDevice(null)}>Cancel</Button><Button data-testid="button-confirm-approval" onClick={runApprove} disabled={isMutating || Number(duration) < 0}>{approveMutation.isPending ? 'Creating license…' : 'Approve & issue license'}</Button></div></div></Modal>}
    {confirmAction && <Modal title={confirmAction.type === 'delete' ? 'Delete device record?' : 'Block this device?'} eyebrow={confirmAction.type === 'delete' ? 'This cannot be undone' : 'Stop future access'} onClose={() => setConfirmAction(null)}><div><div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${confirmAction.type === 'delete' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'}`}>{confirmAction.type === 'delete' ? <Trash2 className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}</div><p className="text-sm leading-6 text-muted-foreground">{confirmAction.type === 'delete' ? 'The registration and its access history will be removed from this console.' : 'The app will deny this device the next time it attempts a handshake.'}</p><p className="mt-4 rounded-lg bg-secondary px-3 py-2 font-mono-ui text-xs text-secondary-foreground">{confirmAction.device.device_id}</p><div className="mt-6 flex justify-end gap-2"><Button data-testid="button-cancel-confirmation" variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button><Button data-testid="button-confirm-device-action" variant={confirmAction.type === 'delete' ? 'destructive' : 'default'} onClick={runConfirm} disabled={isMutating}>{isMutating ? 'Working…' : confirmAction.type === 'delete' ? 'Delete record' : 'Block device'}</Button></div></div></Modal>}
  </div>;
}

function StatCard({ label, value, icon, accent, loading }: { label: string; value?: number; icon: ReactNode; accent: 'navy' | 'amber' | 'green' | 'rose'; loading: boolean }) {
  const colors = { navy: 'bg-slate-100 text-slate-700', amber: 'bg-amber-100 text-amber-700', green: 'bg-emerald-100 text-emerald-700', rose: 'bg-rose-100 text-rose-700' };
  return <div data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`} className="rounded-2xl border border-border bg-card p-5 panel-shadow"><div className="flex items-start justify-between"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p><div className={`flex h-8 w-8 items-center justify-center rounded-lg ${colors[accent]}`}>{icon}</div></div>{loading ? <div className="skeleton mt-5 h-9 w-16 rounded" /> : <p data-testid={`value-${label.toLowerCase().replaceAll(' ', '-')}`} className="mt-4 font-display text-3xl font-semibold tracking-[-0.05em]">{value ?? '—'}</p>}<div className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground"><ArrowUpRight className="h-3 w-3 text-primary" />Current workspace total</div></div>;
}

function DeviceAvatar({ device }: { device: Device }) {
  return <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Smartphone className="h-4 w-4" /></div>;
}

function DeviceRow({ device, onApprove, onReject, onDelete }: { device: Device; onApprove: (device: Device) => void; onReject: (device: Device) => void; onDelete: (device: Device) => void }) {
  const requested = device.requested_permissions ?? [];
  const granted = new Set(device.granted_permissions ?? []);
  return <div data-testid={`row-device-${device.id}`} className="grid gap-3 px-5 py-4 transition-colors hover:bg-secondary/30 md:grid-cols-[1.6fr_1fr_1fr_1.1fr_116px] md:items-center md:gap-4"><div className="flex min-w-0 items-start gap-3"><DeviceAvatar device={device} /><div className="min-w-0"><div className="flex items-center gap-2"><p data-testid={`text-device-name-${device.id}`} className="truncate text-sm font-semibold">{device.device_name || 'Unnamed Android device'}</p>{device.status === 'APPROVED' && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700"><ShieldCheck className="h-3 w-3" />Licensed</span>}</div><div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground"><span className="truncate font-mono-ui">{device.device_id}</span><button data-testid={`button-copy-device-id-${device.id}`} className="shrink-0 text-muted-foreground hover:text-primary" onClick={() => navigator.clipboard?.writeText(device.device_id)} aria-label="Copy device ID"><Copy className="h-3 w-3" /></button></div><p className="mt-1 flex items-center gap-1 truncate text-[11px] text-muted-foreground"><Package className="h-3 w-3 shrink-0" />{device.app_name || device.app_id}{device.package_name ? ` · ${device.package_name}` : ''}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{device.manufacturer || ''} {device.model || ''} {device.android_version ? `· Android ${device.android_version}` : ''} {device.app_version ? `· v${device.app_version}` : ''}</p>{requested.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{requested.slice(0, 3).map((permission) => <PermissionChip key={permission} permission={permission} muted={!granted.has(permission)} />)}{requested.length > 3 && <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold text-muted-foreground">+{requested.length - 3}</span>}</div>}</div></div><div><span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground md:hidden">Status</span><StatusPill status={device.status} /></div><div><span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground md:hidden">Last active</span><p className="text-sm">{formatDate(device.last_active_at, true)}</p><p className="font-mono-ui text-[10px] text-muted-foreground">{device.ip_address || 'IP unavailable'}</p></div><div><span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground md:hidden">Access until</span><p className="text-sm">{device.status === 'APPROVED' ? formatDate(device.expires_at) : '—'}</p><p className="text-[10px] text-muted-foreground">{granted.size} permission{granted.size === 1 ? '' : 's'} granted</p></div><DeviceActions device={device} onApprove={onApprove} onReject={onReject} onDelete={onDelete} /></div>;
}

function Modal({ title, eyebrow, children, onClose }: { title: string; eyebrow: string; children: ReactNode; onClose: () => void }) {
  return <div data-testid="modal-overlay" className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-t-2xl border border-border bg-card p-6 shadow-2xl sm:rounded-2xl"><div className="mb-6 flex items-start justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-primary">{eyebrow}</p><h2 className="mt-1 font-display text-xl font-semibold">{title}</h2></div><button data-testid="button-close-modal" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" onClick={onClose} aria-label="Close dialog"><X className="h-4 w-4" /></button></div>{children}</div></div>;
}