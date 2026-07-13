"use client";

import { useEffect } from "react";
import { MobileNav, SidebarNav } from "@/components/layout/sidebar-nav";
import { ChrisAssistant } from "@/components/layout/chris-assistant";
import { ActiveJobIndicator } from "@/components/jobs/active-job-indicator";
import { ActiveResumeIndicator } from "@/components/resume/active-resume-indicator";
import { ExportUsageLogsButton } from "@/components/layout/export-usage-logs-button";
import { StorageFailureNotice } from "@/components/layout/storage-failure-notice";
import { runAlphaStorageMigration } from "@/lib/alpha-storage-hygiene";
import {
  ADMIN_ALPHA_STORAGE_NAMESPACE,
  clearActiveAlphaStorageNamespace,
  setActiveAlphaStorageNamespace,
} from "@/lib/alpha-session-store";

export function AppShell({
  children,
  isAdmin = false,
  adminDisplayName = "Pietro S.",
}: {
  children: React.ReactNode;
  isAdmin?: boolean;
  adminDisplayName?: string;
}) {
  const userLabel = isAdmin ? adminDisplayName : "Alpha user";

  useEffect(() => {
    if (!isAdmin) return;
    setActiveAlphaStorageNamespace(ADMIN_ALPHA_STORAGE_NAMESPACE);
    runAlphaStorageMigration();
  }, [isAdmin]);

  function handleSwitchUser() {
    clearActiveAlphaStorageNamespace();
    window.location.reload();
  }

  return (
    <div className="min-h-screen">
      <StorageFailureNotice />
      <header className="sticky top-0 z-40 border-b border-zinc-200/60 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight text-zinc-900">Coach Chris</p>
              <p className="hidden text-[11px] text-zinc-500 md:block">
                Resume vs. job fit for candidates
              </p>
            </div>
            {isAdmin && (
              <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Admin
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
            <ActiveJobIndicator />
            <ActiveResumeIndicator />
            <ExportUsageLogsButton />
            <MobileNav
              showAdminLink={isAdmin}
              showProfileLink={isAdmin}
              showOptimizeLink={isAdmin}
            />
            {!isAdmin && (
              <button
                type="button"
                onClick={handleSwitchUser}
                className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
              >
                Switch user
              </button>
            )}
            <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-zinc-600">
              <span className="size-6 rounded-full bg-zinc-200" />
              <span className="hidden font-medium sm:inline">{userLabel}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl gap-8 px-5 py-8">
        <SidebarNav
          showAdminLink={isAdmin}
          showProfileLink={isAdmin}
          showOptimizeLink={isAdmin}
        />
        <main className="flex min-w-0 flex-1 flex-col gap-6">{children}</main>
      </div>

      <ChrisAssistant />
    </div>
  );
}
