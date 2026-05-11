import { cn } from "@/lib/utils";

/**
 * Skeleton shimmer — replaces all loaders + "loading…" text site-wide.
 *
 * Rationale: shimmer placeholders in the EXACT shape of the eventual content
 * read as "this is loading the thing you want" rather than "something is
 * happening." Every loading state in the app should use this primitive
 * with appropriate dimensions.
 */
export function Skeleton({
  className,
}: {
  className?: string;
}) {
  return <div className={cn("skeleton rounded-lg", className)} />;
}

/** Convenience preset — single-line text placeholder. */
export function SkeletonText({
  className,
}: {
  className?: string;
}) {
  return <Skeleton className={cn("h-3 w-full", className)} />;
}

/** Convenience preset — circular avatar / dot. */
export function SkeletonCircle({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("skeleton rounded-full", className)}
      style={{ width: size, height: size }}
    />
  );
}
