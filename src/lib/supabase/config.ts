const FALLBACK_URL = "https://bgfirarkmwagtujkdnes.supabase.co";
const FALLBACK_KEY = "sb_publishable_6YGqP_mHL0Y5YFm9HwzUkA_l06mhAFH";

export function getSupabaseConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? FALLBACK_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? FALLBACK_KEY
  };
}
