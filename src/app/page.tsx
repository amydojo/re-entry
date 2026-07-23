import { PhoneShell } from "@/components/ui/phone-shell";
import { Action } from "@/components/ui/action";
import { DEMO_PUBLIC_ID, DEMO_TOKEN } from "@/lib/domain/demo";

export default function HomePage() {
  return (
    <PhoneShell>
      <div className="brand-row"><span className="brand">RE:ENTRY</span><span className="meta">SYSTEM 01</span></div>
      <p className="section-label">Provider-authored live aftercare</p>
      <h1 className="page-title">Time is part of the protocol.</h1>
      <p className="support">A permanent digital Skin Pass stages the return of products and activities without diagnosing, guessing, or inventing guidance.</p>
      <div className="stack" style={{ marginTop: 36 }}>
        <Action href="/login">Provider sign in</Action>
        <Action href={`/client/${DEMO_PUBLIC_ID}/${DEMO_TOKEN}`} variant="secondary">Open demo Skin Pass</Action>
      </div>
      <div className="disclosure" style={{ marginTop: 40 }}>
        <h3>Clinical boundary</h3>
        <p>RE:ENTRY only displays provider-authored protocol data. Pain, reactions, worsening symptoms, and unexpected recovery always route back to the provider.</p>
      </div>
    </PhoneShell>
  );
}
