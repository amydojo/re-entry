import { redirect } from "next/navigation";
import { PhoneShell } from "@/components/ui/phone-shell";
import { LoginForm } from "./login-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) redirect("/desk");
  return <PhoneShell><div className="brand-row"><span className="brand">RE:ENTRY</span><span className="meta">PROVIDER MODE</span></div><p className="section-label">Secure provider access</p><h1 className="page-title">Author the rules. Let time run them.</h1><p className="support">Provider authentication protects issuance, updates, audit history, and revocation.</p><div style={{ marginTop: 40 }}><LoginForm demoMode={process.env.REENTRY_DEMO_MODE === "1"} /></div></PhoneShell>;
}
