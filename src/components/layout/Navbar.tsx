"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Bot, User, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/ui/Mark";
import WalletMenu from "./WalletMenu";

// Slimmed primary nav to the four demo-critical surfaces.
// /c (Creators) and /architecture remain reachable via in-page links and
// direct URL — the nav stays focused on the demo arc.
const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/trending", icon: TrendingUp, label: "Trending" },
  { href: "/agent", icon: Bot, label: "Agent" },
  { href: "/twin", icon: User, label: "Twin" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <>
      {/* Top bar — sits below the LiveTicker (~28px) so they stack visually */}
      <header className="fixed top-7 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" aria-label="Shopier home">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 sm:flex">
              {navItems.map(({ href, icon: Icon, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    pathname === href
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
            <WalletMenu />
          </div>
        </div>
      </header>

      {/* Bottom bar — mobile only */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/80 backdrop-blur-xl sm:hidden">
        <div className="flex h-14 items-center justify-around">
          {navItems.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 text-xs transition-colors",
                pathname === href
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              <Icon size={22} />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
