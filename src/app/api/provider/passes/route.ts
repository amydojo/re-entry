import { NextResponse } from "next/server";
import { requireProvider } from "@/lib/server/auth";
import { issueDemoProtocolPass } from "@/lib/server/demo-protocol-store";
import { issueFromTemplateSchema } from "@/lib/validation/protocol";

export async function POST(request: Request) {
  const parsed = issueFromTemplateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Review the client, treatment date, and published protocol version." }, { status: 400 });

  if (process.env.REENTRY_DEMO_MODE === "1") {
    try {
      const pass = issueDemoProtocolPass(
        parsed.data.templateVersionId,
        parsed.data.clientName,
        parsed.data.mobile ?? "",
        parsed.data.treatmentDate
      );
      return NextResponse.json({
        id: pass.id,
        publicId: pass.publicId,
        token: pass.token,
        protocolVersion: 1,
        templateVersion: pass.templateVersion,
        treatmentName: pass.snapshot.treatmentLabel
      }, { status: 201 });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Skin Pass could not be issued." }, { status: 400 });
    }
  }

  const { supabase } = await requireProvider();
  const { data, error } = await supabase.rpc("issue_skin_pass_from_template", {
    p_template_version_id: parsed.data.templateVersionId,
    p_client_name: parsed.data.clientName,
    p_client_mobile: parsed.data.mobile || null,
    p_treatment_date: parsed.data.treatmentDate
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
