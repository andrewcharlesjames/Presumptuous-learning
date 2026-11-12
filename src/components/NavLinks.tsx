"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  const active = items.reduce<string | null>((best, it) =>
    (path === it.href || path.startsWith(it.href + "/")) && (!best || it.href.length > best.length) ? it.href : best, null);
  return (
    <nav className="nav" aria-label="Main">
      {items.map(it => (
        <Link key={it.href} href={it.href} aria-current={active === it.href ? "page" : undefined}>{it.label}</Link>
      ))}
    </nav>
  );
}
