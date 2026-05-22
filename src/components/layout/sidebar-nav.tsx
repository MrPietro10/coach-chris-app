"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CoachChrisIntro } from "@/components/onboarding/coach-chris-intro";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/profile", label: "Profile" },
  { href: "/resume", label: "Resume" },
  { href: "/analyze", label: "Add job" },
  { href: "/batch", label: "Saved jobs" },
  { href: "/compare", label: "Compare jobs" },
  { href: "/results", label: "Fit results" },
  { href: "/optimize", label: "Optimize" },
];

function getActiveOnboardingStep(pathname: string): 1 | 2 | 3 | undefined {
  if (pathname.startsWith("/resume")) return 1;
  if (pathname.startsWith("/analyze")) return 2;
  if (pathname.startsWith("/results")) return 3;
  return undefined;
}

function NavLinks({
  onNavigate,
  showAdminLink = false,
  showProfileLink = false,
  showOptimizeLink = false,
}: {
  onNavigate?: () => void;
  showAdminLink?: boolean;
  showProfileLink?: boolean;
  showOptimizeLink?: boolean;
}) {
  const pathname = usePathname();
  const visibleNavItems = navItems.filter((item) => {
    if (item.href === "/profile" && !showProfileLink) return false;
    if (item.href === "/optimize" && !showOptimizeLink) return false;
    return true;
  });

  return (
    <nav className="flex flex-col gap-0.5">
      {visibleNavItems.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
              active
                ? "bg-zinc-900 font-medium text-white"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
      {showAdminLink && (
        <Link
          href="/admin"
          onClick={onNavigate}
          className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
            pathname === "/admin"
              ? "bg-zinc-900 font-medium text-white"
              : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          }`}
        >
          Admin
        </Link>
      )}
    </nav>
  );
}

export function SidebarNav({
  showAdminLink = false,
  showProfileLink = false,
  showOptimizeLink = false,
}: {
  showAdminLink?: boolean;
  showProfileLink?: boolean;
  showOptimizeLink?: boolean;
}) {
  const pathname = usePathname();
  const activeStep = getActiveOnboardingStep(pathname);

  return (
    <aside className="hidden w-44 shrink-0 lg:sticky lg:top-20 lg:block">
      <CoachChrisIntro variant="sidebar" activeStep={activeStep} />
      <NavLinks
        showAdminLink={showAdminLink}
        showProfileLink={showProfileLink}
        showOptimizeLink={showOptimizeLink}
      />
    </aside>
  );
}

export function MobileNav({
  showAdminLink = false,
  showProfileLink = false,
  showOptimizeLink = false,
}: {
  showAdminLink?: boolean;
  showProfileLink?: boolean;
  showOptimizeLink?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-lg px-2.5 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
      >
        {open ? "Close" : "Menu"}
      </button>
      {open && (
        <div className="absolute right-4 top-14 z-50 w-44 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
          <NavLinks
            showAdminLink={showAdminLink}
            showProfileLink={showProfileLink}
            showOptimizeLink={showOptimizeLink}
            onNavigate={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
