"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/layout/Navbar";
import LikenessRow from "@/components/twin/LikenessRow";
import { useTwin } from "@/lib/useTwin";
import {
  Undertone,
  type TwinParams,
  type Section as SectionId,
  type StyleRegister,
  type Climate,
  type AgeRange,
} from "@/lib/solana";
import { Loader2, Trash2, Save, Sparkles, RotateCw, Lock, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

// Three.js is heavy and client-only; defer load + skip SSR.
const TwinModel3D = dynamic(() => import("@/components/twin/TwinModel3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] items-center justify-center">
      <Loader2 className="animate-spin text-muted-foreground" size={20} />
    </div>
  ),
});

const DEFAULT_PARAMS: TwinParams = {
  heightCm: 175,
  weightKg: 70,
  chestCm: 95,
  waistCm: 80,
  hipCm: 95,
  inseamCm: 80,
  shoulderCm: 45,
  undertone: Undertone.Neutral,
  skinTone: 5,
  stylePrefs: "minimalist, oversized, neutrals",
  favColors: "black, cream, olive",
  section: "both",
  styleRegister: "neutral",
  climate: "four-season",
  ageRange: "decline",
  brandsLove: "",
  brandsAvoid: "",
  hardFilters: [],
};

const SECTION_ANCHORS = [
  { id: "body", label: "Body" },
  { id: "skin", label: "Skin" },
  { id: "section", label: "Section" },
  { id: "register", label: "Register" },
  { id: "context", label: "Context" },
  { id: "style", label: "Style" },
];

export default function TwinPage() {
  const { twin, source, loading, connected, submit, destroy } = useTwin();
  const [params, setParams] = useState<TwinParams>(DEFAULT_PARAMS);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [privacy, setPrivacy] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("body");

  useEffect(() => {
    if (twin) {
      setParams((p) => ({
        ...p,
        heightCm: twin.heightCm,
        weightKg: twin.weightKg,
        chestCm: twin.chestCm,
        waistCm: twin.waistCm,
        hipCm: twin.hipCm,
        inseamCm: twin.inseamCm,
        shoulderCm: twin.shoulderCm,
        undertone: twin.undertone,
        skinTone: twin.skinTone,
        stylePrefs: twin.stylePrefs,
        favColors: twin.favColors,
      }));
    }
  }, [twin]);

  // Scroll-spy: update active anchor as user scrolls through sections
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveSection(e.target.id);
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    SECTION_ANCHORS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  // Completion progress — counts non-default-ish fields
  const progress = useMemo(() => {
    let filled = 0;
    let total = 0;
    const checks: Array<[boolean]> = [
      [params.stylePrefs.length > 5],
      [params.favColors.length > 3],
      [(params.brandsLove ?? "").length > 0],
      [(params.brandsAvoid ?? "").length > 0],
      [(params.hardFilters ?? []).length > 0],
      [params.ageRange !== "decline"],
      [params.section !== "both"],
      [params.styleRegister !== "neutral"],
    ];
    for (const [ok] of checks) {
      total += 1;
      if (ok) filled += 1;
    }
    return { filled, total, pct: Math.round((filled / total) * 100) };
  }, [params]);

  async function onSave() {
    setSaving(true);
    setStatus(null);
    try {
      const sig = await submit(params, privacy);
      setStatus(
        privacy
          ? `Saved encrypted on-chain. Tx: ${sig.slice(0, 12)}…`
          : `Saved on-chain. Tx: ${sig.slice(0, 12)}…`
      );
    } catch (err) {
      setStatus(`Failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!confirm("Delete your on-chain twin? This is reversible — you can recreate it.")) return;
    setSaving(true);
    try {
      await destroy();
      setStatus("Twin deleted on-chain.");
      setParams(DEFAULT_PARAMS);
    } catch (err) {
      setStatus(`Failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 pt-24 pb-24 sm:pb-12">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {twin ? "Editing existing twin" : "Onboarding new twin"}
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Your digital twin
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              The agent's likeness of you. Drives every fit decision, color
              choice, and section search.
              {twin ? " Changes update your Twin PDA on Solana." : " Stored as a Twin PDA on Solana under your wallet."}
            </p>
          </div>
          {/* Sticky-ish save button at top-right for desktop quick access */}
          <div className="hidden items-center gap-3 sm:flex">
            {progress.total > 0 && (
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {progress.filled}/{progress.total} optional fields
                </span>
                <div className="mt-1 h-1 w-32 overflow-hidden rounded-full bg-muted/40">
                  <div
                    className="h-full bg-foreground transition-all duration-300"
                    style={{ width: `${progress.pct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {!connected && (
          <div className="mb-6 rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
            Connect your Phantom wallet (top right) to read or write your twin.
          </div>
        )}

        {connected && loading && (
          <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            <span>Reading twin from chain…</span>
          </div>
        )}

        {/* Two-column layout: 3D viewer (sticky) + form (scrollable).
            Breakpoint dropped to md (768px) so split-screen / tablet users
            get the side-by-side view instead of a stacked tower. */}
        <div className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-8">
          {/* === LEFT: 3D viewer column === */}
          <aside className="md:sticky md:top-20 md:self-start">
            <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-b from-muted/20 via-background to-muted/30 shadow-sm">
              {privacy && (
                <div className="pointer-events-none absolute inset-0 rounded-3xl ring-2 ring-emerald-500/30" />
              )}

              {/* Adaptive viewer sizing:
                  · narrow phones — 3:4 portrait, capped at 50vh so the figure
                    never eats more than half the screen
                  · md and up — 4:5 portrait, capped at 75vh so the figure
                    fits without forcing scroll on standard laptop heights */}
              <div className="aspect-[3/4] max-h-[50vh] w-full md:aspect-[4/5] md:max-h-[75vh]">
                <TwinModel3D
                  twin={{
                    heightCm: params.heightCm,
                    weightKg: params.weightKg,
                    chestCm: params.chestCm,
                    waistCm: params.waistCm,
                    hipCm: params.hipCm,
                    inseamCm: params.inseamCm,
                    shoulderCm: params.shoulderCm,
                    undertone: params.undertone,
                    skinTone: params.skinTone,
                  }}
                />
              </div>

              {/* Top-left badge: privacy state */}
              <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider backdrop-blur">
                {privacy ? (
                  <>
                    <Lock size={10} className="text-emerald-500" />
                    Encrypted
                  </>
                ) : (
                  <>
                    <Eye size={10} className="text-muted-foreground" />
                    Public
                  </>
                )}
              </div>

              {/* Top-right hint: drag-to-rotate */}
              <div className="pointer-events-none absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground backdrop-blur">
                <RotateCw size={10} /> Drag to rotate
              </div>

              {/* Bottom strip: live measurement summary */}
              <div className="absolute inset-x-0 bottom-0 border-t border-border/40 bg-background/85 px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground backdrop-blur">
                <div className="flex items-center justify-between">
                  <span>{params.heightCm}cm · {params.weightKg}kg</span>
                  <span>
                    {params.chestCm}/{params.waistCm}/{params.hipCm}
                  </span>
                  <span>Tone {params.skinTone}/10</span>
                </div>
              </div>
            </div>

            {/* Tiny footnote under the viewer */}
            <p className="mt-3 px-1 text-[11px] leading-relaxed text-muted-foreground">
              Stylized 3D figure — no facial features, no photos. Body
              proportions are computed from your measurements. Skin uses the
              Monk Skin Tone Scale tinted by undertone.
            </p>
          </aside>

          {/* === RIGHT: form column === */}
          <div>
            {/* Section anchor pills — sticky at top of column */}
            <nav className="sticky top-16 z-10 -mx-4 mb-6 flex gap-1.5 overflow-x-auto bg-background/85 px-4 py-2 backdrop-blur lg:top-20">
              {SECTION_ANCHORS.map(({ id, label }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document
                      .getElementById(id)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs transition-colors",
                    activeSection === id
                      ? "bg-foreground text-background"
                      : "border border-border text-muted-foreground hover:bg-muted/40"
                  )}
                >
                  {label}
                </a>
              ))}
            </nav>

            <div className="space-y-5">
              {/* PRIVACY MODE — promoted to the top, where it actually informs the user before they fill anything in */}
              <div
                className={cn(
                  "rounded-2xl border p-5 transition-colors",
                  privacy
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-border/60 bg-background"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Lock
                        size={14}
                        className={privacy ? "text-emerald-500" : "text-muted-foreground"}
                      />
                      <h2 className="text-sm font-semibold">Private mode</h2>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Encrypts your body data client-side before it touches the
                      chain. Only your wallet can decrypt — the on-chain PDA
                      becomes opaque to anyone else reading it.
                      {source !== "none" && (
                        <span className="ml-1 rounded bg-muted/60 px-1 py-0.5 font-mono text-[9px] uppercase">
                          {source}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => setPrivacy((p) => !p)}
                    aria-pressed={privacy}
                    className={cn(
                      "shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                      privacy
                        ? "bg-emerald-500 text-white"
                        : "border border-border text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    {privacy ? "On" : "Off"}
                  </button>
                </div>
                {privacy && source !== "encrypted" && (
                  <p className="mt-3 rounded-md bg-emerald-500/10 px-3 py-2 text-[11px] leading-relaxed text-emerald-700 dark:text-emerald-400">
                    Saving will require an extra wallet signature to derive your
                    encryption key. The encrypted twin lives at a separate PDA
                    (<code>twin_v2</code>) — your existing plaintext twin (if any)
                    is unaffected.
                  </p>
                )}
              </div>

              <FormSection
                id="body"
                title="Body"
                hint="Centimeters and kilograms. Drives bone proportions in the figure on the left."
              >
                <Grid>
                  <NumberField label="Height" value={params.heightCm} onChange={(v) => setParams({ ...params, heightCm: v })} suffix="cm" min={100} max={250} />
                  <NumberField label="Weight" value={params.weightKg} onChange={(v) => setParams({ ...params, weightKg: v })} suffix="kg" min={30} max={250} />
                  <NumberField label="Chest" value={params.chestCm} onChange={(v) => setParams({ ...params, chestCm: v })} suffix="cm" min={50} max={200} />
                  <NumberField label="Waist" value={params.waistCm} onChange={(v) => setParams({ ...params, waistCm: v })} suffix="cm" min={40} max={200} />
                  <NumberField label="Hip" value={params.hipCm} onChange={(v) => setParams({ ...params, hipCm: v })} suffix="cm" min={40} max={200} />
                  <NumberField label="Inseam" value={params.inseamCm} onChange={(v) => setParams({ ...params, inseamCm: v })} suffix="cm" min={40} max={150} />
                  <NumberField label="Shoulder" value={params.shoulderCm} onChange={(v) => setParams({ ...params, shoulderCm: v })} suffix="cm" min={20} max={80} />
                </Grid>
              </FormSection>

              <FormSection
                id="skin"
                title="Skin"
                hint="Undertone and Monk Skin Tone Scale (1 lightest → 10 darkest)."
              >
                <div className="mb-5 flex flex-wrap gap-2">
                  {[
                    { v: Undertone.Cool, label: "Cool" },
                    { v: Undertone.Warm, label: "Warm" },
                    { v: Undertone.Neutral, label: "Neutral" },
                  ].map(({ v, label }) => (
                    <Pill
                      key={label}
                      active={params.undertone === v}
                      onClick={() => setParams({ ...params, undertone: v })}
                    >
                      {label}
                    </Pill>
                  ))}
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Skin tone
                    </label>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {params.skinTone}/10
                    </span>
                  </div>
                  {/* Tone scale visual + range */}
                  <div className="mb-2 flex h-3 w-full overflow-hidden rounded-full">
                    {[
                      "#F6E0CB", "#E5C8A8", "#D9AC83", "#C99366", "#B07C53",
                      "#946845", "#7A5538", "#5F412A", "#42301F", "#2A1E14",
                    ].map((c, i) => (
                      <div
                        key={c}
                        className={cn(
                          "flex-1 transition-all",
                          i + 1 === params.skinTone && "ring-2 ring-foreground ring-offset-1 ring-offset-background"
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={params.skinTone}
                    onChange={(e) => setParams({ ...params, skinTone: Number(e.target.value) })}
                    className="w-full accent-foreground"
                  />
                </div>
              </FormSection>

              <FormSection
                id="section"
                title="Where you shop"
                hint="Drives which retailer sections the agent searches. Decoupled from gender identity."
              >
                <div className="flex flex-wrap gap-2">
                  {(["mens", "womens", "both", "androgynous"] as SectionId[]).map((s) => (
                    <Pill
                      key={s}
                      active={(params.section ?? "both") === s}
                      onClick={() => setParams({ ...params, section: s })}
                    >
                      {s === "mens" ? "Men's" : s === "womens" ? "Women's" : s === "both" ? "Both" : "Androgynous"}
                    </Pill>
                  ))}
                </div>
              </FormSection>

              <FormSection
                id="register"
                title="Style register"
                hint="How the agent's commentary reads. Orthogonal to where you shop."
              >
                <div className="flex flex-wrap gap-2">
                  {(["masculine", "neutral", "feminine"] as StyleRegister[]).map((r) => (
                    <Pill
                      key={r}
                      active={(params.styleRegister ?? "neutral") === r}
                      onClick={() => setParams({ ...params, styleRegister: r })}
                    >
                      {r === "masculine" ? "Masc" : r === "neutral" ? "Neutral" : "Femme"}
                    </Pill>
                  ))}
                </div>
              </FormSection>

              <FormSection
                id="context"
                title="Context"
                hint="Climate and age range — informs seasonal categories and cut maturity."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-muted-foreground">
                      Climate
                    </label>
                    <select
                      value={params.climate ?? "four-season"}
                      onChange={(e) => setParams({ ...params, climate: e.target.value as Climate })}
                      className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-foreground/40"
                    >
                      <option value="tropical">Tropical</option>
                      <option value="temperate">Temperate</option>
                      <option value="cold">Cold</option>
                      <option value="four-season">Four-season</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-muted-foreground">
                      Age range
                    </label>
                    <select
                      value={params.ageRange ?? "decline"}
                      onChange={(e) => setParams({ ...params, ageRange: e.target.value as AgeRange })}
                      className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-foreground/40"
                    >
                      <option value="16-24">16–24</option>
                      <option value="25-34">25–34</option>
                      <option value="35-44">35–44</option>
                      <option value="45-54">45–54</option>
                      <option value="55+">55+</option>
                      <option value="decline">Prefer not to say</option>
                    </select>
                  </div>
                </div>
              </FormSection>

              <FormSection
                id="style"
                title="Style"
                hint="How the agent should describe fits to you — and what to never recommend."
              >
                <TextField
                  label="Style preferences"
                  value={params.stylePrefs}
                  onChange={(v) => setParams({ ...params, stylePrefs: v })}
                  placeholder="minimalist, oversized, neutrals"
                  maxLength={256}
                />
                <TextField
                  label="Favorite colors"
                  value={params.favColors}
                  onChange={(v) => setParams({ ...params, favColors: v })}
                  placeholder="black, cream, olive"
                  maxLength={128}
                />
                <TextField
                  label="Brands you love (optional)"
                  value={params.brandsLove ?? ""}
                  onChange={(v) => setParams({ ...params, brandsLove: v })}
                  placeholder="Toteme, Lemaire, COS"
                  maxLength={256}
                />
                <TextField
                  label="Brands you avoid (optional)"
                  value={params.brandsAvoid ?? ""}
                  onChange={(v) => setParams({ ...params, brandsAvoid: v })}
                  placeholder="fast fashion, Shein"
                  maxLength={256}
                />
                <div className="mt-1">
                  <label className="mb-2 block text-[10px] uppercase tracking-wider text-muted-foreground">
                    Hard filters (optional)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "vegan", label: "Vegan" },
                      { id: "no-fur", label: "No fur" },
                      { id: "no-leather", label: "No leather" },
                      { id: "no-fast-fashion", label: "No fast fashion" },
                      { id: "sustainable-only", label: "Sustainable only" },
                    ].map((f) => {
                      const on = (params.hardFilters ?? []).includes(f.id);
                      return (
                        <Pill
                          key={f.id}
                          active={on}
                          size="sm"
                          onClick={() => {
                            const cur = params.hardFilters ?? [];
                            setParams({
                              ...params,
                              hardFilters: on ? cur.filter((x) => x !== f.id) : [...cur, f.id],
                            });
                          }}
                        >
                          {f.label}
                        </Pill>
                      );
                    })}
                  </div>
                </div>
              </FormSection>

              {/* Likeness matches — celebs whose body is closest to your twin */}
              <LikenessRow
                twin={{
                  heightCm: params.heightCm,
                  chestCm: params.chestCm,
                  waistCm: params.waistCm,
                  hipCm: params.hipCm,
                  section: params.section,
                  styleRegister: params.styleRegister,
                }}
              />

              {status && (
                <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm">
                  <Sparkles size={14} className="mr-2 inline-block text-muted-foreground" />
                  {status}
                </div>
              )}

              {/* Sticky save bar — visible while scrolling, removes the awkward "where's the save button" hunt */}
              <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
                <button
                  onClick={onSave}
                  disabled={!connected || saving}
                  className="flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {twin ? "Update twin" : "Create twin"}
                  {privacy && " · encrypted"}
                </button>
                {twin && (
                  <button
                    onClick={onDelete}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-40"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                )}
                <div className="ml-auto hidden text-[11px] text-muted-foreground sm:block">
                  {connected
                    ? privacy
                      ? "Two signatures: one for the encryption key, one for the tx."
                      : "Saves to chain in one signature."
                    : "Connect wallet to save"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

// === Reusable form pieces ===

function FormSection({
  id,
  title,
  hint,
  children,
}: {
  id: string;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-32 rounded-2xl border border-border/60 bg-background p-5 transition-shadow hover:shadow-sm"
    >
      <div className="mb-4">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>
      </div>
      {children}
    </section>
  );
}

function Pill({
  active,
  onClick,
  children,
  size = "md",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  size?: "sm" | "md";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full transition-all",
        size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm",
        active
          ? "bg-foreground text-background shadow-sm"
          : "border border-border text-muted-foreground hover:border-foreground/30 hover:bg-muted/30 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>;
}

function NumberField({
  label,
  value,
  onChange,
  suffix,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix: string;
  min: number;
  max: number;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-transparent px-3 py-2 transition-colors focus-within:border-foreground/40">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          className="flex-1 bg-transparent text-sm tabular-nums outline-none"
        />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {suffix}
        </span>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div className="mb-3">
      <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-foreground/40"
      />
    </div>
  );
}
