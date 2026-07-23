import { NextResponse } from "next/server";
import { requireProvider } from "@/lib/server/auth";
import { listDemoProtocols, saveDemoProtocol } from "@/lib/server/demo-protocol-store";
import { saveProtocolSchema } from "@/lib/validation/protocol";

export async function GET() {
  if (process.env.REENTRY_DEMO_MODE === "1") return NextResponse.json({ protocols: listDemoProtocols() });
  const { supabase } = await requireProvider();
  const { data, error } = await supabase
    .from("protocol_templates")
    .select("id,protocol_name,treatment_label,status,current_published_version,has_unpublished_changes,updated_at,archived_at")
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ protocols: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const parsed = saveProtocolSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Review the protocol identity, timezone, duration, and item fields.", issues: parsed.error.issues }, { status: 400 });
  }
  if (process.env.REENTRY_DEMO_MODE === "1") {
    const template = saveDemoProtocol(null, parsed.data);
    return NextResponse.json({ id: template.id, status: template.status, currentPublishedVersion: template.currentPublishedVersion }, { status: 201 });
  }
  const { supabase } = await requireProvider();
  const { data, error } = await supabase.rpc("save_protocol_draft", { p_template_id: null, p_payload: parsed.data });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
