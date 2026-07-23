import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { makeDemoSnapshot, DEMO_PUBLIC_ID, DEMO_TOKEN } from "@/lib/domain/demo";
import type { PassSnapshotSource } from "@/lib/domain/types";

function ipFingerprint(value: string): string {
  return value.slice(0, 128) || "unknown";
}

export async function lookupPass(publicId: string, token: string): Promise<PassSnapshotSource> {
  if (process.env.REENTRY_DEMO_MODE === "1" && publicId === DEMO_PUBLIC_ID && token === DEMO_TOKEN) {
    return makeDemoSnapshot();
  }

  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lookup_skin_pass", {
    p_public_id: publicId,
    p_token: token,
    p_ip_fingerprint: ipFingerprint(ip)
  });

  if (error) {
    console.error("lookup_skin_pass failed", { code: error.code, message: error.message });
    return {
      access: "invalid",
      serverNow: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString()
    };
  }

  return data as PassSnapshotSource;
}
