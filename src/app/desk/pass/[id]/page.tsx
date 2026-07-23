import { notFound } from "next/navigation";
import { PhoneShell } from "@/components/ui/phone-shell";
import { PassManager } from "@/components/provider/pass-manager";
import { requireProvider } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
const demoPass = { id: "22222222-2222-4222-8222-222222222222", public_id: "SP-0042", client_name: "Jordan Lee", client_mobile: "+16265550143", treatment_name: "Microneedling", treatment_date: "2026-07-20", status: "issued", protocol_version: 1, revoked_at: null };
const demoEvents = [
  { id: "55555555-5555-4555-8555-555555555551", ordinal: 1, return_at: "2026-07-23T07:00:00Z", completed_at: null, item_label: "Makeup" },
  { id: "55555555-5555-4555-8555-555555555552", ordinal: 2, return_at: "2026-07-25T07:00:00Z", completed_at: null, item_label: "Exfoliating acids" },
  { id: "55555555-5555-4555-8555-555555555553", ordinal: 3, return_at: "2026-07-27T07:00:00Z", completed_at: null, item_label: "Retinoid" }
];

export default async function ManagePassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireProvider();
  if (process.env.REENTRY_DEMO_MODE === "1") return <PhoneShell><PassManager pass={demoPass} events={demoEvents} serverNow="2026-07-22T19:00:00Z" versions={[{ version: 1, created_at: "2026-07-20T18:00:00Z", reason: "Issued", changed_item_label: null, previous_return_at: null, new_return_at: null }]} audits={[{ id: "audit-1", action: "pass_issued", actor_kind: "provider", metadata: {}, created_at: "2026-07-20T18:00:00Z" }]} /></PhoneShell>;
  const { data: pass } = await supabase.from("skin_passes").select("id,public_id,client_name,client_mobile,treatment_name,treatment_date,status,protocol_version,revoked_at").eq("id", id).single();
  if (!pass) notFound();
  const [{ data: eventRows }, { data: versions }, { data: audits }] = await Promise.all([
    supabase.from("return_events").select("id,ordinal,return_at,completed_at,skin_pass_items(item_label)").eq("pass_id", id).order("ordinal"),
    supabase.from("protocol_versions").select("version,created_at,reason,changed_item_label,previous_return_at,new_return_at").eq("pass_id", id).order("version", { ascending: false }),
    supabase.from("pass_audit_events").select("id,action,actor_kind,metadata,created_at").eq("pass_id", id).order("created_at", { ascending: false })
  ]);
  const events = (eventRows ?? []).map((row: Record<string, unknown>) => ({ id: String(row.id), ordinal: Number(row.ordinal), return_at: String(row.return_at), completed_at: row.completed_at ? String(row.completed_at) : null, item_label: String((row.skin_pass_items as { item_label?: string } | null)?.item_label ?? "Return event") }));
  return <PhoneShell><PassManager pass={pass} events={events} serverNow={new Date().toISOString()} versions={versions ?? []} audits={audits ?? []} /></PhoneShell>;
}
