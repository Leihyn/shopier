"use client";

import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import { Loader2, BadgeCheck } from "lucide-react";
import { reverseLookupWallet } from "@/lib/sns";

export default function BecomeCreatorPage() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const router = useRouter();

  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [cutPct, setCutPct] = useState(5);
  const [dotsol, setDotsol] = useState("");
  const [reverseLookup, setReverseLookup] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reverse-lookup the wallet's primary .sol on connect — auto-suggest it.
  useEffect(() => {
    let cancelled = false;
    if (!wallet.publicKey) {
      setReverseLookup(null);
      return;
    }
    (async () => {
      try {
        const name = await reverseLookupWallet(connection, wallet.publicKey!);
        if (!cancelled && name) {
          setReverseLookup(name);
          // Pre-fill handle if empty + auto-fill .sol field
          if (!handle) setHandle(name.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32));
          if (!dotsol) setDotsol(name);
        }
      } catch {
        // ignore — SNS resolution failures shouldn't block registration
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.publicKey, connection]);

  async function onSubmit() {
    if (!wallet.publicKey) {
      setError("Connect Phantom first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle,
          bio,
          pubkey: wallet.publicKey.toBase58(),
          cutBps: Math.round(cutPct * 100),
          payoutAddress: wallet.publicKey.toBase58(),
          dotsolName: dotsol.trim() || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      router.push(`/c/${data.creator.handle}/dashboard`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 pt-24 pb-24 sm:pb-12">
        <h1 className="font-display mb-2 text-3xl font-bold tracking-tight">Become a creator</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Pin your /c/[handle] in your IG bio or TikTok link. When users land
          via that URL and buy through Shopier, you earn a commission on every
          purchase.
        </p>

        <div className="space-y-4 rounded-xl border border-border/60 bg-background p-5">
          <Field label="Handle (a-z 0-9 - _, ≤32 chars)">
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32))}
              placeholder="leihyn"
              className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/30"
            />
          </Field>
          <Field label="Bio (≤500 chars)">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 500))}
              placeholder="Minimalist menswear. Tokyo-leaning. Neutrals only."
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/30"
            />
          </Field>
          <Field label={`Commission cut: ${cutPct.toFixed(1)}% (max 50%)`}>
            <input
              type="range"
              min={0.5}
              max={20}
              step={0.5}
              value={cutPct}
              onChange={(e) => setCutPct(Number(e.target.value))}
              className="w-full"
            />
          </Field>

          <Field label="Verified .sol identity (optional)">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-transparent px-3 py-2 focus-within:border-foreground/30">
              <input
                value={dotsol}
                onChange={(e) => setDotsol(e.target.value.trim())}
                placeholder={reverseLookup ?? "your-handle"}
                className="flex-1 bg-transparent text-sm outline-none"
              />
              <span className="text-xs text-muted-foreground">.sol</span>
            </div>
            {reverseLookup && (
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                <BadgeCheck size={11} />
                We found <code className="font-mono">{reverseLookup}.sol</code> on
                your wallet — using it adds a verified-identity badge to your profile.
              </p>
            )}
            {!reverseLookup && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                If you own a .sol domain, enter the label (without .sol). Server
                verifies ownership before saving. Leave blank to skip.
              </p>
            )}
          </Field>

          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}

          <button
            onClick={onSubmit}
            disabled={saving || !wallet.publicKey}
            className="flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {wallet.publicKey ? "Create profile" : "Connect Phantom to continue"}
          </button>
        </div>
      </main>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
