import { cn } from "@/lib/utils";

/**
 * Shopier brand mark.
 *
 * A pill-shaped wordmark with an `S` monogram badge — the badge is the
 * compact form (used in tight spots like avatars, favicons), the wordmark
 * is the full lockup for the navbar and hero surfaces.
 *
 * The S is built from two stacked semicircles cut at the waist — meant to
 * read as both a stylized fashion silhouette (head + body) and an "S".
 * Filled with the page's foreground color so it inverts cleanly in light
 * and dark themes.
 */

export function Monogram({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-label="Shopier"
    >
      {/* Background pill */}
      <rect
        x="0"
        y="0"
        width="24"
        height="24"
        rx="7"
        className="fill-foreground"
      />
      {/* Stylized S — two crescents, fashion-illustration vibe.
          Top crescent opens right, bottom opens left — reads as "S" with
          a body-shape implication (head/torso + hip silhouette). */}
      <path
        d="M 7 7
           C 7 5.5, 9 5, 12 5
           C 15 5, 17 6, 17 8
           C 17 10, 15 11, 12 11"
        stroke="currentColor"
        className="text-background"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 17 17
           C 17 18.5, 15 19, 12 19
           C 9 19, 7 18, 7 16
           C 7 14, 9 13, 12 13"
        stroke="currentColor"
        className="text-background"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function Wordmark({
  className,
}: {
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-display text-lg font-bold tracking-tight",
        className
      )}
    >
      <Monogram size={20} />
      Shopier
    </span>
  );
}
