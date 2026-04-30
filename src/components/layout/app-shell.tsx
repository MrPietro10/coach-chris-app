import { MobileNav, SidebarNav } from "@/components/layout/sidebar-nav";
import { ChrisAssistant } from "@/components/layout/chris-assistant";
import { ExportUsageLogsButton } from "@/components/layout/export-usage-logs-button";

export function AppShell({
  children,
  isAdmin = false,
}: {
  children: React.ReactNode;
  isAdmin?: boolean;
}) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-zinc-200/60 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold tracking-tight text-zinc-900">Coach Chris</p>
            {isAdmin && (
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Admin
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ExportUsageLogsButton />
            <MobileNav showAdminLink={isAdmin} />
            <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-zinc-600">
              <span className="size-6 rounded-full bg-zinc-200" />
              <span className="hidden font-medium sm:inline">Pietro S.</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl gap-8 px-5 py-8">
        <SidebarNav showAdminLink={isAdmin} />
        <main className="flex min-w-0 flex-1 flex-col gap-6">{children}</main>
      </div>

      <ChrisAssistant />
    </div>
  );
}
