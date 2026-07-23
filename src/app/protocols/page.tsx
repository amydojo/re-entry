import Link from "next/link";
import { Action } from "@/components/ui/action";
import { ProviderWorkspace } from "@/components/ui/provider-workspace";
import { requireProvider } from "@/lib/server/auth";
import { listDemoProtocols } from "@/lib/server/demo-protocol-store";

export const dynamic = "force-dynamic";

type ProtocolRow = {
  id: string;
  protocol_name: string;
  treatment_label: string;
  status: "draft" | "published" | "archived";
  current_published_version: number;
  has_unpublished_changes: boolean;
  updated_at: string;
  archived_at: string | null;
  pass_count: number;
};

export default async function ProtocolLibraryPage() {
  const { supabase } = await requireProvider();
  let protocols: ProtocolRow[] = [];

  if (process.env.REENTRY_DEMO_MODE === "1") {
    protocols = listDemoProtocols() as ProtocolRow[];
  } else {
    const { data, error } = await supabase
      .from("protocol_templates")
      .select("id,protocol_name,treatment_label,status,current_published_version,has_unpublished_changes,updated_at,archived_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error("Unable to load Protocol Studio");

    const templateIds = (data ?? []).map((row) => row.id);
    const { data: versions } = templateIds.length
      ? await supabase.from("protocol_template_versions").select("id,template_id").in("template_id", templateIds)
      : { data: [] as { id: string; template_id: string }[] };
    const versionIds = (versions ?? []).map((version) => version.id);
    const { data: passes } = versionIds.length
      ? await supabase.from("skin_passes").select("template_version_id").in("template_version_id", versionIds)
      : { data: [] as { template_version_id: string | null }[] };
    const templateForVersion = new Map((versions ?? []).map((version) => [version.id, version.template_id]));
    const counts = new Map<string, number>();
    for (const pass of passes ?? []) {
      const templateId = pass.template_version_id ? templateForVersion.get(pass.template_version_id) : null;
      if (templateId) counts.set(templateId, (counts.get(templateId) ?? 0) + 1);
    }
    protocols = (data ?? []).map((row) => ({ ...row, pass_count: counts.get(row.id) ?? 0 })) as ProtocolRow[];
  }

  return (
    <ProviderWorkspace>
      <div className="provider-page-head">
        <div>
          <p className="section-label">Provider-authored time machines</p>
          <h1 className="workspace-title">Protocol library</h1>
          <p className="workspace-support">Create the rules once. Every issued Skin Pass receives a fixed published edition.</p>
        </div>
        <div className="provider-head-action"><Action href="/protocols/new">Create protocol</Action></div>
      </div>

      {!protocols.length ? (
        <section className="protocol-empty">
          <p className="meta">EMPTY LIBRARY</p>
          <h2>No protocol editions yet.</h2>
          <p>Build the first treatment timeline, preview the client output, then fix version 1.</p>
          <Action href="/protocols/new">Create the first protocol</Action>
        </section>
      ) : (
        <section className="protocol-library" aria-label="Protocol templates">
          {protocols.map((protocol) => (
            <article className="protocol-record" key={protocol.id}>
              <div className="protocol-record-signal" aria-hidden="true" />
              <div className="protocol-record-main">
                <p className="meta">{protocol.status.toUpperCase()} · {protocol.current_published_version ? `EDITION ${String(protocol.current_published_version).padStart(2, "0")}` : "UNPUBLISHED"}</p>
                <h2><Link href={`/protocols/${protocol.id}`}>{protocol.protocol_name || "Untitled protocol"}</Link></h2>
                <p>{protocol.treatment_label || "Client label not set"}</p>
              </div>
              <dl className="protocol-record-meta">
                <div><dt>Passes</dt><dd>{protocol.pass_count}</dd></div>
                <div><dt>Updated</dt><dd>{new Date(protocol.updated_at).toLocaleDateString()}</dd></div>
                <div><dt>Working state</dt><dd>{protocol.has_unpublished_changes ? "Draft changes" : protocol.status}</dd></div>
              </dl>
              <div className="protocol-record-actions">
                <Link href={`/protocols/${protocol.id}`}>{protocol.status === "draft" ? "Open draft" : "Open instrument"} →</Link>
                {protocol.status === "published" && <Link href={`/issue?template=${protocol.id}`}>Issue pass →</Link>}
              </div>
            </article>
          ))}
        </section>
      )}
    </ProviderWorkspace>
  );
}
