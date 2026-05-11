import { redirect } from "next/navigation";

// Legacy URL — subscription setup is now part of the creator dashboard.
// /c/[handle]/dashboard hosts an "Enable subscriptions" CTA.
export default function LegacyBecomeStylist() {
  redirect("/c/become");
}
