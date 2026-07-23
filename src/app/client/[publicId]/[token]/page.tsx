import { PhoneShell } from "@/components/ui/phone-shell";
import { ClientExperience } from "@/components/pass/client-experience";
import { lookupPass } from "@/lib/server/pass-access";

export const dynamic = "force-dynamic";

export default async function ClientPassPage({ params }: { params: Promise<{ publicId: string; token: string }> }) {
  const { publicId, token } = await params;
  const source = await lookupPass(publicId, token);
  return <PhoneShell><ClientExperience initialSource={source} publicId={publicId} token={token} /></PhoneShell>;
}
