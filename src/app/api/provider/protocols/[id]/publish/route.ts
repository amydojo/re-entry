import { NextResponse } from "next/server";
import { requireProvider } from "@/lib/server/auth";
import { getDemoProtocol, publishDemoProtocol } from "@/lib/server/demo-protocol-store";
import { validateProtocolForPublish } from "@/lib/domain/protocol-studio";
import { publishProtocolSchema } from "@/lib/validation/protocol";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = publishProtocolSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Review the publication summary." }, { status: 400 });

  if (process.env.REENTRY_DEMO_MODE === "1") {
    const template = getDemoProtocol(id);
    if (!template) return NextResponse.json({ error: "Protocol not found" }, { status: 404 });
    const validation = validateProtocolForPublish(template.draft);
    if (!validation.success) return NextResponse.json({ error: "Resolve protocol validation before publishing.", issues: validation.error.issues }, { status: 400 });
    try {
      const version = publishDemoProtocol(id, parsed.data.changeSummary ?? "");
      return NextResponse.json({ id: version.id, templateId: id, version: version.version, snapshot: version.snapshot }, { status: 201 });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to publish protocol" }, { status: 400 });
    }
  }

  const { supabase } = await requireProvider();
  const { data, error } = await supabase.rpc("publish_protocol_template", {
    p_template_id: id,
    p_change_summary: parsed.data.changeSummary ?? ""
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
