import Link from "next/link";
import { PhoneShell } from "@/components/ui/phone-shell";
import { Action } from "@/components/ui/action";
import { requireProvider } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
type PassRow = { id: string; public_id: string; client_name: string; treatment_name: string; treatment_date: string; status: string; protocol_version: number };
const demoPass: PassRow = { id: "22222222-2222-4222-8222-222222222222", public_id: "SP-0042", client_name: "Jordan Lee", treatment_name: "Microneedling", treatment_date: "2026-07-20", status: "issued", protocol_version: 1 };

export default async function DeskPage() {
  const { supabase, providerId } = await requireProvider();
  let studioName = "Amy Skin Studio";
  let passes: PassRow[] = [];
  if (process.env.REENTRY_DEMO_MODE === "1") passes = [demoPass];
  else {
    const [{ data: profile }, { data, error }] = await Promise.all([
      supabase.from("provider_profiles").select("display_name,studio_name").eq("id", providerId).single(),
      supabase.from("skin_passes").select("id,public_id,client_name,treatment_name,treatment_date,status,protocol_version").order("created_at", { ascending: false })
    ]);
    if (error) throw new Error("Unable to load provider passes");
    studioName = profile?.studio_name ?? "Skin Pass desk";
    passes = (data ?? []) as PassRow[];
  }
  return <PhoneShell>
    <div className="brand-row"><span className="brand">RE:ENTRY</span><span className="meta">PROVIDER MODE</span></div>
    <p className="section-label">{studioName}</p><h1 className="page-title small">Skin Pass desk</h1><p className="support">Issue, inspect, update, and revoke provider-authored passes.</p>
    <div className="stack" style={{ marginTop: 24 }}><Action href="/issue">Issue a new Skin Pass</Action><Action href="/protocols" variant="secondary">Open Protocol Studio</Action></div>
    <p className="section-label">Active and recent</p>
    <div className="stack">{passes.map((pass) => <Link className="choice" href={`/desk/pass/${pass.id}`} key={pass.id}><div><strong>{pass.client_name}</strong><span>{pass.treatment_name} · {pass.treatment_date}</span></div><span className="choice-status">{pass.status} · V{pass.protocol_version}</span></Link>)}{!passes.length && <div className="disclosure"><h3>No passes yet</h3><p>Publish a protocol edition, then issue a pass with its permanent ID and immutable snapshot.</p></div>}</div>
    <form action="/auth/signout" method="post" style={{ marginTop: 36 }}><button className="action secondary" type="submit">Sign out <span className="action-arrow">→</span></button></form>
  </PhoneShell>;
}
