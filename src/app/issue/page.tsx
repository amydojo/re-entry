import { PhoneShell } from "@/components/ui/phone-shell";
import { IssueWizard } from "@/components/provider/issue-wizard";
import { requireProvider } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
export default async function IssuePage() { await requireProvider(); return <PhoneShell><IssueWizard /></PhoneShell>; }
