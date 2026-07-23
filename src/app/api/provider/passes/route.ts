import { NextResponse } from "next/server";
import { requireProvider } from "@/lib/server/auth";
import { issuePassSchema } from "@/lib/validation/pass";

export async function POST(request: Request) {
  const parsed = issuePassSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Review the client, treatment date, and all return days." }, { status: 400 });
  if (process.env.REENTRY_DEMO_MODE === "1") return NextResponse.json({ id: "22222222-2222-4222-8222-222222222222", publicId: "SP-0042", token: "demo-secure-token", protocolVersion: 1 }, { status: 201 });
  const { supabase } = await requireProvider();
  const values = Object.fromEntries(parsed.data.items.map((item) => [item.key, item.returnDay]));
  const { data, error } = await supabase.rpc("issue_skin_pass", {
    p_client_name: parsed.data.clientName,
    p_client_mobile: parsed.data.mobile || null,
    p_treatment_date: parsed.data.treatmentDate,
    p_makeup_day: values.makeup,
    p_acids_day: values["exfoliating-acids"],
    p_retinoid_day: values.retinoid,
    p_exercise_day: values["intense-exercise"]
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
