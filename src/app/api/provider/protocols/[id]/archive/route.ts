import { NextResponse } from "next/server";
import { requireProvider } from "@/lib/server/auth";
import { archiveDemoProtocol } from "@/lib/server/demo-protocol-store";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (process.env.REENTRY_DEMO_MODE === "1") {
    try {
      const template = archiveDemoProtocol(id);
      return NextResponse.json({ id: template.id, protocolName: template.draft.protocolName, archived: true });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update protocol lifecycle" }, { status: 400 });
    }
  }

  const { supabase } = await requireProvider();
  const { data, error } = await supabase.rpc("archive_protocol_template", { p_template_id: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
