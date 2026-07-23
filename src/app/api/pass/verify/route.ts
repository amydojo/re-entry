import { NextResponse } from "next/server";
import { lookupPass } from "@/lib/server/pass-access";
import { verifyPassSchema } from "@/lib/validation/pass";

export async function POST(request: Request) {
  const parsed = verifyPassSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid pass request" }, { status: 400 });
  const source = await lookupPass(parsed.data.publicId, parsed.data.token);
  return NextResponse.json(source, { headers: { "Cache-Control": "private, no-store" } });
}
