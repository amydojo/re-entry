import { NextResponse } from "next/server";
import { requireProvider } from "@/lib/server/auth";
import { updateEventSchema } from "@/lib/validation/pass";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  const parsed = updateEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A future date and update reason are required." }, { status: 400 });
  const { id, eventId } = await params;
  const { supabase } = await requireProvider();
  const { data, error } = await supabase.rpc("publish_protocol_update", { p_pass_id: id, p_event_id: eventId, p_new_return_at: parsed.data.returnAt, p_reason: parsed.data.reason });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
