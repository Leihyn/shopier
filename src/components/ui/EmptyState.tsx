import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Single empty-state primitive — replaces 5 different "no data" voices
 * across the app with one consistent, friendly tone.
 *
 * Usage:
 *   <EmptyState
 *     icon={Receipt}
 *     title="No purchases yet"
 *     body="Drop a screenshot or watch a celebrity to see your first buy here."
 *     cta={{ label: "Browse trending", href: "/trending" }}
 *   />
 */
export default function EmptyState({
  icon: Icon,
  title,
  body,
  cta,
  className,
  size = "md",
}: {
  icon?: LucideIcon;
  title: string;
  body?: string;
  cta?: { label: string; href: string };
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizing =
    size === "sm"
      ? "p-4 text-center"
      : size === "lg"
      ? "p-10 text-center"
      : "p-6 text-center";

  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-border/40 bg-muted/10",
        sizing,
        className
      )}
    >
      {Icon && (
        <Icon
          size={size === "sm" ? 18 : size === "lg" ? 28 : 22}
          className="mx-auto mb-2 text-muted-foreground"
        />
      )}
      <p
        className={cn(
          "font-semibold",
          size === "sm" ? "text-xs" : "text-sm"
        )}
      >
        {title}
      </p>
      {body && (
        <p
          className={cn(
            "mx-auto mt-1.5 max-w-md leading-relaxed text-muted-foreground",
            size === "sm" ? "text-[11px]" : "text-xs"
          )}
        >
          {body}
        </p>
      )}
      {cta && (
        <Link
          href={cta.href}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
        >
          {cta.label} →
        </Link>
      )}
    </div>
  );
}
