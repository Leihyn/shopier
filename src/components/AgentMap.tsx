import { Bot, Wallet, Building2, Users } from "lucide-react";

/**
 * The four-agent architecture diagram. Sits at the top of the homepage
 * to anchor the agent-first framing. Each quadrant names one agent,
 * its identity (or absence), its policy boundary, and a representative action.
 */
export default function AgentMap() {
  const cells = [
    {
      icon: <Bot size={16} />,
      title: "Styling agent",
      identity: "no wallet · compute only",
      bound: "API rate limits",
      example:
        "Vision decompose · twin-aware fit commentary · live retailer matching",
    },
    {
      icon: <Wallet size={16} />,
      title: "Twin agent (your agent)",
      identity: "your wallet + your digital twin · Phantom-signed",
      bound: "spending_policy PDA on Solana",
      example:
        "Decisions tuned to your measurements, palette, and taste · pays USDC under the policy · auto-approves below threshold · hard-blocks above max-per-tx",
    },
    {
      icon: <Building2 size={16} />,
      title: "Operator agent",
      identity: "Shopier treasury keypair",
      bound: "hardcoded route caps + signature verification",
      example:
        "Activations · pay rent for new users · paymaster for onboarding bundles",
    },
    {
      icon: <Users size={16} />,
      title: "Creator agent",
      identity: "creator's wallet",
      bound: "ed25519-signed look attestations · on-chain cut",
      example:
        "Curate looks · earn 70% net affiliate · run subscription tier · attest provenance",
    },
  ];

  return (
    <div className="rounded-2xl border border-border/60 bg-muted/10 p-4 sm:p-5">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Your agent + the supporting cast
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cells.map((c, i) => {
          const isStar = i === 1; // Twin agent — visually elevated
          return (
            <div
              key={c.title}
              className={
                isStar
                  ? "rounded-xl border-2 border-amber-500/50 bg-amber-500/5 p-4 shadow-sm sm:col-span-2"
                  : "rounded-xl border border-border/60 bg-background p-4"
              }
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                {c.icon}
                <span>{c.title}</span>
                {isStar && (
                  <span className="ml-auto rounded-full bg-amber-500/20 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    primary
                  </span>
                )}
              </div>
              <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                {c.identity}
              </p>
              <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Policy:</span>{" "}
                {c.bound}
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Acts:</span>{" "}
                {c.example}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Each agent&apos;s authority is enforced by a different Solana program.
      </p>
    </div>
  );
}
