import { NextResponse } from "next/server";
import { requireProvider } from "@/lib/server/auth";
import { revokePassSchema } from "@/lib/validation/pass";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = revokePassSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a revocation note before confirming." }, { status: 400 });
  const { id } = await params;
  const { supabase } = await requireProvider();
  const { data, error } = await supabase.rpc("revoke_skin_pass", { p_pass_id: id, p_reason: parsed.data.note });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
