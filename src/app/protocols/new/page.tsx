import { ProviderWorkspace } from "@/components/ui/provider-workspace";
import { ProtocolStudioEditor } from "@/components/provider/protocol-studio-editor";
import { cloneLightChemicalPeelDraft } from "@/lib/domain/protocol-presets";
import { requireProvider } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function NewProtocolPage() {
  await requireProvider();
  return (
    <ProviderWorkspace>
      <ProtocolStudioEditor
        initialDraft={cloneLightChemicalPeelDraft()}
        templateId={null}
        initialStatus="draft"
        initialVersion={0}
        initialHasUnpublishedChanges={false}
        initialVersions={[]}
      />
    </ProviderWorkspace>
  );
}
