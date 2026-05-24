"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeIndicator } from "@/components/ThemeIndicator";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/journal", label: "Journal" },
  { href: "/investments", label: "Investments" },
  { href: "/property", label: "Property" },
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
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-primary">
          Caishen
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
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
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
