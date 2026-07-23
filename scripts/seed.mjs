import { createClient } from "@supabase/supabase-js";

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "DEMO_PROVIDER_EMAIL",
  "DEMO_PROVIDER_PASSWORD"
];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const email = process.env.DEMO_PROVIDER_EMAIL;
const password = process.env.DEMO_PROVIDER_PASSWORD;

const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const provider = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });

const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listed.error) throw listed.error;
let user = listed.data.users.find((candidate) => candidate.email === email);
if (!user) {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Demo Provider", studio_name: "RE:ENTRY Demo Studio" }
  });
  if (created.error) throw created.error;
  user = created.data.user;
} else {
  const updated = await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  if (updated.error) throw updated.error;
}

const signedIn = await provider.auth.signInWithPassword({ email, password });
if (signedIn.error) throw signedIn.error;

const existing = await provider.from("skin_passes").select("id,public_id").eq("client_name", "Jordan Lee").limit(1).maybeSingle();
if (existing.error) throw existing.error;
if (existing.data) {
  console.log(JSON.stringify({ providerId: user.id, existingPass: existing.data }, null, 2));
  process.exit(0);
}

const issued = await provider.rpc("issue_skin_pass", {
  p_client_name: "Jordan Lee",
  p_client_mobile: null,
  p_treatment_date: "2026-07-20",
  p_makeup_day: 3,
  p_acids_day: 5,
  p_retinoid_day: 7,
  p_exercise_day: 0
});
if (issued.error) throw issued.error;
console.log(JSON.stringify({ providerId: user.id, issuedPass: issued.data }, null, 2));
