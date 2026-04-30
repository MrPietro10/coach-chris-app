"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/profile", label: "Profile" },
  { href: "/resume", label: "Resume" },
  { href: "/analyze", label: "Analyze" },
  { href: "/batch", label: "Jobs" },
  { href: "/results", label: "Results" },
  { href: "/optimize", label: "Optimize" },
];

function NavLinks({
  onNavigate,
  showAdminLink = false,
}: {
  onNavigate?: () => void;
  showAdminLink?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {navItems.map((item) => {
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

export function SidebarNav({ showAdminLink = false }: { showAdminLink?: boolean }) {
  return (
    <aside className="hidden w-44 shrink-0 lg:sticky lg:top-20 lg:block">
      <NavLinks showAdminLink={showAdminLink} />
    </aside>
  );
}

export function MobileNav({ showAdminLink = false }: { showAdminLink?: boolean }) {
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
          <NavLinks showAdminLink={showAdminLink} onNavigate={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
