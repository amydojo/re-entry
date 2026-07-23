import { NextResponse } from "next/server";
import { requireProvider } from "@/lib/server/auth";
import { getDemoProtocol, saveDemoProtocol } from "@/lib/server/demo-protocol-store";
import { saveProtocolSchema } from "@/lib/validation/protocol";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (process.env.REENTRY_DEMO_MODE === "1") {
    const template = getDemoProtocol(id);
    if (!template) return NextResponse.json({ error: "Protocol not found" }, { status: 404 });
    return NextResponse.json({ template });
  }
  const { supabase } = await requireProvider();
  const [{ data: template, error }, { data: items }, { data: versions }] = await Promise.all([
    supabase.from("protocol_templates").select("*").eq("id", id).single(),
    supabase.from("protocol_draft_items").select("*").eq("template_id", id).order("ordinal"),
    supabase.from("protocol_template_versions").select("id,version,snapshot,change_summary,item_count,published_at").eq("template_id", id).order("version", { ascending: false })
  ]);
  if (error || !template) return NextResponse.json({ error: "Protocol not found" }, { status: 404 });
  return NextResponse.json({ template, items: items ?? [], versions: versions ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = saveProtocolSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Review the protocol identity, timezone, duration, and item fields.", issues: parsed.error.issues }, { status: 400 });
  }
  if (process.env.REENTRY_DEMO_MODE === "1") {
    try {
      const template = saveDemoProtocol(id, parsed.data);
      return NextResponse.json({ id: template.id, status: template.status, currentPublishedVersion: template.currentPublishedVersion });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save protocol" }, { status: 400 });
    }
  }
  const { supabase } = await requireProvider();
  const { data, error } = await supabase.rpc("save_protocol_draft", { p_template_id: id, p_payload: parsed.data });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
