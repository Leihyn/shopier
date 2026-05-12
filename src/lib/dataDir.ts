import path from "path";

/**
 * Resolve the writable directory for sqlite databases.
 *
 * Local dev: `<cwd>/.data` (gitignored, persists across runs).
 * Vercel serverless: `/tmp/.shopier-data` (process.cwd() is read-only at
 * `/var/task`; /tmp is writable per invocation, ephemeral across cold starts).
 *
 * On Vercel, schemas are created on first open via CREATE TABLE IF NOT EXISTS
 * in each db module — so the routes work, but data resets when the function
 * spins down.
 */
export function dataDir(): string {
  if (process.env.VERCEL) {
    return path.join("/tmp", ".shopier-data");
  }
  return path.join(process.cwd(), ".data");
}
