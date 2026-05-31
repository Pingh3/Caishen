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
  { href: "/settings", label: "Settings" },
];

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
      </nav>
    </header>
  );
}
