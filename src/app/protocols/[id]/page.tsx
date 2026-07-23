import { notFound } from "next/navigation";
import { ProviderWorkspace } from "@/components/ui/provider-workspace";
import { ProtocolStudioEditor } from "@/components/provider/protocol-studio-editor";
import type { ProtocolDraft, ProtocolDraftItem, ProtocolTemplateStatus } from "@/lib/domain/protocol-studio";
import { requireProvider } from "@/lib/server/auth";
import { getDemoProtocol } from "@/lib/server/demo-protocol-store";

export const dynamic = "force-dynamic";

type TemplateRow = {
  id: string;
  protocol_name: string;
  treatment_label: string;
  internal_description: string;
  status: ProtocolTemplateStatus;
  recovery_duration_days: number;
  protocol_timezone: string;
  provider_guidance: string;
  routine_restored_message: string;
  current_published_version: number;
  has_unpublished_changes: boolean;
};

type ItemRow = {
  id: string;
  item_key: string;
  canonical_name: string;
  kind: "product" | "activity";
  category: string;
  inventory_group: "routine" | "activity";
  client_explanation: string;
  provider_note: string;
  baseline_available: boolean;
  return_day: number | null;
  aliases: string[];
  ordinal: number;
  enabled: boolean;
};

type VersionRow = {
  id: string;
  version: number;
  snapshot: unknown;
  change_summary: string;
  item_count: number;
  published_at: string;
};

export default async function ProtocolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireProvider();

  if (process.env.REENTRY_DEMO_MODE === "1") {
    const template = getDemoProtocol(id);
    if (!template) notFound();
    return (
      <ProviderWorkspace>
        <ProtocolStudioEditor
          initialDraft={structuredClone(template.draft)}
          templateId={template.id}
          initialStatus={template.status}
          initialVersion={template.currentPublishedVersion}
          initialHasUnpublishedChanges={template.hasUnpublishedChanges}
          initialVersions={template.versions.slice().reverse().map((version) => ({
            id: version.id,
            version: version.version,
            snapshot: version.snapshot,
            changeSummary: version.changeSummary,
            itemCount: version.itemCount,
            publishedAt: version.publishedAt,
            passCount: version.passCount
          }))}
        />
      </ProviderWorkspace>
    );
  }

  const [{ data: templateData }, { data: itemData }, { data: versionData }] = await Promise.all([
    supabase.from("protocol_templates").select("id,protocol_name,treatment_label,internal_description,status,recovery_duration_days,protocol_timezone,provider_guidance,routine_restored_message,current_published_version,has_unpublished_changes").eq("id", id).single(),
    supabase.from("protocol_draft_items").select("id,item_key,canonical_name,kind,category,inventory_group,client_explanation,provider_note,baseline_available,return_day,aliases,ordinal,enabled").eq("template_id", id).order("ordinal"),
    supabase.from("protocol_template_versions").select("id,version,snapshot,change_summary,item_count,published_at").eq("template_id", id).order("version", { ascending: false })
  ]);

  if (!templateData) notFound();
  const template = templateData as TemplateRow;
  const items = (itemData ?? []) as ItemRow[];
  const versions = (versionData ?? []) as VersionRow[];
  const versionIds = versions.map((version) => version.id);
  const { data: passRows } = versionIds.length
    ? await supabase.from("skin_passes").select("template_version_id").in("template_version_id", versionIds)
    : { data: [] as { template_version_id: string | null }[] };
  const passCounts = new Map<string, number>();
  for (const pass of passRows ?? []) {
    if (pass.template_version_id) passCounts.set(pass.template_version_id, (passCounts.get(pass.template_version_id) ?? 0) + 1);
  }

  const draft: ProtocolDraft = {
    id: template.id,
    protocolName: template.protocol_name,
    treatmentLabel: template.treatment_label,
    internalDescription: template.internal_description,
    recoveryDurationDays: template.recovery_duration_days,
    protocolTimeZone: template.protocol_timezone,
    providerGuidance: template.provider_guidance,
    routineRestoredMessage: template.routine_restored_message,
    items: items.map((item): ProtocolDraftItem => ({
      id: item.id,
      itemKey: item.item_key,
      canonicalName: item.canonical_name,
      kind: item.kind,
      category: item.category,
      inventoryGroup: item.inventory_group,
      clientExplanation: item.client_explanation,
      providerNote: item.provider_note,
      baselineAvailable: item.baseline_available,
      returnDay: item.return_day,
      aliases: item.aliases ?? [],
      ordinal: item.ordinal,
      enabled: item.enabled
    }))
  };

  return (
    <ProviderWorkspace>
      <ProtocolStudioEditor
        initialDraft={draft}
        templateId={template.id}
        initialStatus={template.status}
        initialVersion={template.current_published_version}
        initialHasUnpublishedChanges={template.has_unpublished_changes}
        initialVersions={versions.map((version) => ({
          id: version.id,
          version: version.version,
          snapshot: version.snapshot,
          changeSummary: version.change_summary,
          itemCount: version.item_count,
          publishedAt: version.published_at,
          passCount: passCounts.get(version.id) ?? 0
        }))}
      />
    </ProviderWorkspace>
  );
}
