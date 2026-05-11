"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  ChevronDown,
  Sun,
  Moon,
  Monitor,
  Receipt,
  Wallet as WalletIcon,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { useTheme } from "@/lib/useTheme";
import { useWalletDisplay } from "@/lib/useWalletDisplay";
import { cn } from "@/lib/utils";

/**
 * Wallet menu — replaces the bare WalletMultiButton in the navbar.
 *
 * Disconnected: renders the native WalletMultiButton (its built-in modal
 * handles the connect flow well, no need to rebuild it).
 *
 * Connected: renders a custom button with the wallet pubkey truncated +
 * a chevron, opening a dropdown with: twin / wallet / purchases / theme
 * cycle / disconnect. This declutters the navbar and gives /me/purchases
 * a discoverable home.
 */
export default function WalletMenu() {
  const wallet = useWallet();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Hooks must run in the same order every render — call useWalletDisplay
  // BEFORE the early return for disconnected state. Pass null when wallet is
  // not connected; the hook handles that gracefully.
  const pubkey = wallet.publicKey?.toBase58() ?? null;
  const display = useWalletDisplay(pubkey);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!wallet.connected || !wallet.publicKey || !pubkey) {
    return (
      <WalletMultiButton
        style={{
          height: 36,
          fontSize: 13,
          padding: "0 14px",
          borderRadius: 8,
        }}
      />
    );
  }

  const short = `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-3 text-xs font-semibold text-background transition-opacity hover:opacity-90"
        title={pubkey}
      >
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-background/20 text-[9px]">
          ●
        </span>
        <span className={cn(display.isSns ? "font-medium" : "font-mono")}>
          {display.display}
        </span>
        <ChevronDown size={12} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-60 overflow-hidden rounded-xl border border-border/70 bg-background shadow-xl">
          {/* Header */}
          <div className="border-b border-border/40 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Connected
              {display.isSns && (
                <span className="ml-1 rounded bg-emerald-500/15 px-1 py-0.5 text-[8px] font-mono text-emerald-700 dark:text-emerald-400">
                  .sol
                </span>
              )}
            </p>
            <p
              className={cn(
                "text-[11px] text-foreground",
                display.isSns ? "font-medium" : "font-mono"
              )}
            >
              {display.display}
            </p>
            {display.isSns && (
              <p className="font-mono text-[9px] text-muted-foreground">
                {short}
              </p>
            )}
          </div>

          {/* Links */}
          <div className="py-1">
            <MenuLink
              href="/twin"
              icon={<UserIcon size={12} />}
              label="Your twin"
              onClick={() => setOpen(false)}
            />
            <MenuLink
              href="/agent/wallet"
              icon={<WalletIcon size={12} />}
              label="Spending policy"
              onClick={() => setOpen(false)}
            />
            <MenuLink
              href="/me/purchases"
              icon={<Receipt size={12} />}
              label="Your purchases"
              onClick={() => setOpen(false)}
            />
          </div>

          {/* Theme cycle */}
          <ThemeRow />

          {/* Disconnect */}
          <button
            onClick={() => {
              setOpen(false);
              wallet.disconnect();
            }}
            className="flex w-full items-center gap-2 border-t border-border/40 px-3 py-2 text-left text-[12px] text-rose-600 transition-colors hover:bg-rose-500/10 dark:text-rose-400"
          >
            <LogOut size={12} />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon,
  label,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 text-[12px] text-foreground transition-colors hover:bg-muted/40"
    >
      <span className="text-muted-foreground">{icon}</span>
      {label}
    </Link>
  );
}

function ThemeRow() {
  const { theme, cycle } = useTheme();
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  return (
    <button
      onClick={cycle}
      className="flex w-full items-center justify-between gap-2 border-t border-border/40 px-3 py-2 text-[12px] text-foreground transition-colors hover:bg-muted/40"
    >
      <span className="flex items-center gap-2">
        <Icon size={12} className="text-muted-foreground" />
        Theme
      </span>
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {theme}
      </span>
    </button>
  );
}
