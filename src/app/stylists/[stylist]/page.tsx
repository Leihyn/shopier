import { redirect } from "next/navigation";

interface Params {
  params: Promise<{ stylist: string }>;
}

// Legacy /stylists/[pubkey] → /c/[handle]
// We don't reverse-resolve the handle from pubkey here; just bounce to the creators index.
export default async function LegacyStylistPage({ params }: Params) {
  await params;
  redirect("/c");
}
