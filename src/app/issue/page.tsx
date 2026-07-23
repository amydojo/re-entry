import { PhoneShell } from "@/components/ui/phone-shell";
import { IssueWizard, type IssuableProtocolVersion } from "@/components/provider/issue-wizard";
import { requireProvider } from "@/lib/server/auth";
import { listDemoPublishedVersions } from "@/lib/server/demo-protocol-store";

export const dynamic = "force-dynamic";

export default async function IssuePage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const { template } = await searchParams;
  const { supabase } = await requireProvider();
  let protocols: IssuableProtocolVersion[] = [];

  if (process.env.REENTRY_DEMO_MODE === "1") {
    const currentByTemplate = new Map<string, ReturnType<typeof listDemoPublishedVersions>[number]>();
    for (const version of listDemoPublishedVersions()) {
      const current = currentByTemplate.get(version.template_id);
      if (!current || version.version > current.version) currentByTemplate.set(version.template_id, version);
    }
    protocols = [...currentByTemplate.values()].map((version) => ({
      id: version.id,
      templateId: version.template_id,
      protocolName: version.protocol_name,
      treatmentLabel: version.treatment_label,
      version: version.version,
      recoveryDurationDays: version.recovery_duration_days,
      snapshot: version.snapshot
    }));
  } else {
    const { data: templates, error } = await supabase
      .from("protocol_templates")
      .select("id,protocol_name,treatment_label,current_published_version")
      .eq("status", "published")
      .is("archived_at", null)
      .order("protocol_name");
    if (error) throw new Error("Unable to load published protocols");
    const templateIds = (templates ?? []).map((row) => row.id);
    const { data: versions } = templateIds.length
      ? await supabase.from("protocol_template_versions").select("id,template_id,version,snapshot").in("template_id", templateIds)
      : { data: [] as { id: string; template_id: string; version: number; snapshot: Record<string, unknown> }[] };
    const templateMap = new Map((templates ?? []).map((row) => [row.id, row]));
    protocols = (versions ?? [])
      .filter((version) => templateMap.get(version.template_id)?.current_published_version === version.version)
      .map((version) => {
        const parent = templateMap.get(version.template_id)!;
        const snapshot = version.snapshot as { recoveryDurationDays?: number };
        return {
          id: version.id,
          templateId: version.template_id,
          protocolName: parent.protocol_name,
          treatmentLabel: parent.treatment_label,
          version: version.version,
          recoveryDurationDays: snapshot.recoveryDurationDays ?? 7,
          snapshot: version.snapshot
        };
      });
  }

  return <PhoneShell><IssueWizard protocols={protocols} initialTemplateId={template ?? null} /></PhoneShell>;
}
