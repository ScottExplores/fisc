"use client";

import { Building2, Calculator, HandHeart, Landmark, Menu, Moon, Search, Spline, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Flow", short: "Flow", icon: Spline },
  { href: "/revenue", label: "Who pays", short: "Pays", icon: Landmark },
  { href: "/spending", label: "Spending", short: "Spend", icon: Building2 },
  { href: "/nonprofits", label: "Nonprofits", short: "NGOs", icon: HandHeart },
  { href: "/recipients", label: "Recipients", short: "Search", icon: Search },
  { href: "/you", label: "Your taxes", short: "You", icon: Calculator },
] as const;

function active(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteChrome({ years }: { years: number[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fy = searchParams.get("fy") ?? String(years[0] ?? 2026);
  const hrefFor = (path: string) => `${path}?fy=${fy}`;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 md:px-6">
          <Link href={hrefFor("/")} className="flex items-baseline gap-2">
            <span className="font-heading text-2xl tracking-tight">Fisc</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">Federal dollars</span>
          </Link>
          <nav className="ml-auto hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={hrefFor(item.href)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                  active(pathname, item.href) && "bg-secondary text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={hrefFor("/about")}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground",
                active(pathname, "/about") && "bg-secondary text-foreground",
              )}
            >
              About
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <YearSelect years={years} fy={fy} />
            <ThemeToggle />
            <MobileMenu years={years} fy={fy} pathname={pathname} />
          </div>
        </div>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 backdrop-blur-md lg:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5 px-1 pt-1 pb-[max(0.4rem,env(safe-area-inset-bottom))]">
          {NAV.filter((item) => ["/", "/spending", "/nonprofits", "/recipients", "/you"].includes(item.href)).map((item) => {
            const Icon = item.icon;
            const on = active(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={hrefFor(item.href)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] text-muted-foreground",
                    on && "text-primary",
                  )}
                >
                  <Icon className="size-4" />
                  {item.short}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

function YearSelect({ years, fy }: { years: number[]; fy: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  return (
    <Select
      value={fy}
      onValueChange={(value) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("fy", value);
        router.push(`${pathname}?${params.toString()}`);
      }}
    >
      <SelectTrigger aria-label="Fiscal year" size="sm">
        <SelectValue placeholder="Year" />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectGroup>
          {years.map((year) => (
            <SelectItem key={year} value={String(year)}>
              FY {year}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}

function MobileMenu({
  pathname,
  fy,
}: {
  years: number[];
  fy: string;
  pathname: string;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle className="font-heading text-2xl">Fisc</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4">
          {[...NAV, { href: "/about", label: "About the data", short: "About", icon: Landmark }].map((item) => (
            <Link
              key={item.href}
              href={`${item.href}?fy=${fy}`}
              className={cn(
                "rounded-lg px-3 py-3 text-base",
                active(pathname, item.href) ? "bg-secondary" : "hover:bg-muted",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/80">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground md:px-6">
        <p className="font-heading text-lg text-foreground">Fisc</p>
        <p className="max-w-2xl leading-relaxed">
          An open-source view of U.S. federal receipts and outlays. Figures stay attached to the agency that published them. Nothing here is tax, legal, or investment advice.
        </p>
        <p>
          <Link href="/about" className="underline underline-offset-4 hover:text-foreground">
            Sources and methods
          </Link>
          <span> · MIT license</span>
        </p>
      </div>
    </footer>
  );
}
