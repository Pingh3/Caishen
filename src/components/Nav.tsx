"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PrivacyToggle } from "@/components/PrivacyToggle";
import { ThemeIndicator } from "@/components/ThemeIndicator";
import { APP_NAME } from "@/lib/app";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/journal", label: "Journal" },
  { href: "/philosophy", label: "Philosophy" },
  { href: "/investments", label: "Investments" },
  { href: "/property", label: "Property" },
  { href: "/vehicle", label: "Vehicle" },
  { href: "/insurance", label: "Insurance" },
  { href: "/loans", label: "Loans" },
  { href: "/update", label: "Update" },
  { href: "/accounts", label: "Accounts" },
];

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium uppercase tracking-widest text-muted">
            Singapore · SGD
          </p>
          <ThemeIndicator />
          <PrivacyToggle />
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-primary">
          {APP_NAME}
        </h1>
      </div>
      <nav className="flex flex-wrap gap-1 rounded-xl border border-surface-border bg-surface-raised p-1">
        {links.map(({ href, label }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-2.5 py-1 text-sm transition ${
                active
                  ? "bg-accent/15 text-accent"
                  : "text-secondary hover:text-primary"
              }`}
            >
              {label}
            </Link>
          );
        })}
        <Link
          href="/settings"
          aria-label="Settings"
          title="Settings"
          className={`inline-flex items-center justify-center rounded-lg p-1.5 transition ${
            pathname.startsWith("/settings")
              ? "bg-accent/15 text-accent"
              : "text-secondary hover:text-primary"
          }`}
        >
          <SettingsIcon className="h-4 w-4" />
        </Link>
      </nav>
    </header>
  );
}
