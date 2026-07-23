import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireProvider() {
  const supabase = await createClient();
  if (process.env.REENTRY_DEMO_MODE === "1") return { supabase, providerId: "demo-provider" };
  const { data, error } = await supabase.auth.getClaims();
  const subject = data?.claims?.sub;
  if (error || typeof subject !== "string") redirect("/login");
  return { supabase, providerId: subject };
}
