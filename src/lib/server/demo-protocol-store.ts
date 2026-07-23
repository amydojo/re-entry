import type { PassSnapshotSource } from "@/lib/domain/types";
import type { ProtocolDraft } from "@/lib/domain/protocol-studio";
import { protocolSnapshotFromDraft } from "@/lib/domain/protocol-studio";

export type DemoProtocolVersion = {
  id: string;
  version: number;
  snapshot: ReturnType<typeof protocolSnapshotFromDraft>;
  changeSummary: string;
  itemCount: number;
  publishedAt: string;
  passCount: number;
};

export type DemoProtocolTemplate = {
  id: string;
  status: "draft" | "published" | "archived";
  currentPublishedVersion: number;
  hasUnpublishedChanges: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  draft: ProtocolDraft;
  versions: DemoProtocolVersion[];
};

type DemoIssuedPass = {
  id: string;
  publicId: string;
  token: string;
  clientName: string;
  mobile: string;
  treatmentDate: string;
  templateVersionId: string;
  templateVersion: number;
  snapshot: DemoProtocolVersion["snapshot"];
  issuedAt: string;
  revoked: boolean;
};

type DemoStore = {
  templates: DemoProtocolTemplate[];
  passes: DemoIssuedPass[];
  sequence: number;
};

declare global {
  var __reentryProtocolDemoStore: DemoStore | undefined;
}

const microneedlingDraft: ProtocolDraft = {
  id: "33333333-3333-4333-8333-333333333331",
  protocolName: "Microneedling",
  treatmentLabel: "Microneedling",
  internalDescription: "Migrated first-slice protocol.",
  recoveryDurationDays: 7,
  protocolTimeZone: "America/Los_Angeles",
  providerGuidance: "Use only the products and activities named in this Skin Pass. Contact the provider for symptoms or anything unexpected.",
  routineRestoredMessage: "Your full provider-authored routine is restored.",
  items: [
    item("gentle-cleanser", "Gentle cleanser", true, null, ["cleanser", "face wash"], 0, "Use the gentle cleanser selected by your provider."),
    item("barrier-moisturizer", "Barrier moisturizer", true, null, ["moisturizer", "barrier cream"], 1, "Keep the routine simple and barrier-focused."),
    item("mineral-spf", "Mineral SPF", true, null, ["sunscreen", "spf"], 2, "Use the provider-selected mineral sunscreen."),
    item("intense-exercise", "Intense exercise", true, 0, ["workout", "gym"], 3, "Follow the activity timing in this pass.", "activity", "activity"),
    item("makeup", "Makeup", false, 3, ["foundation", "concealer"], 4, "Wait until the scheduled return day."),
    item("exfoliating-acids", "Exfoliating acids", false, 5, ["aha", "bha", "glycolic acid"], 5, "Wait until the scheduled return day."),
    item("retinoid", "Retinoid", false, 7, ["retinol", "tretinoin"], 6, "Wait until the scheduled return day.")
  ]
};

function item(
  itemKey: string,
  canonicalName: string,
  baselineAvailable: boolean,
  returnDay: number | null,
  aliases: string[],
  ordinal: number,
  clientExplanation: string,
  kind: "product" | "activity" = "product",
  inventoryGroup: "routine" | "activity" = "routine"
) {
  return {
    itemKey,
    canonicalName,
    kind,
    category: kind === "activity" ? "activity" : "skincare",
    inventoryGroup,
    clientExplanation,
    providerNote: "",
    baselineAvailable,
    returnDay,
    aliases,
    ordinal,
    enabled: true
  } satisfies ProtocolDraft["items"][number];
}

function initialStore(): DemoStore {
  const now = "2026-07-23T18:00:00.000Z";
  const snapshot = protocolSnapshotFromDraft(microneedlingDraft);
  return {
    sequence: 1,
    templates: [{
      id: microneedlingDraft.id!,
      status: "published",
      currentPublishedVersion: 1,
      hasUnpublishedChanges: false,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      draft: structuredClone(microneedlingDraft),
      versions: [{
        id: "44444444-4444-4444-8444-444444444441",
        version: 1,
        snapshot,
        changeSummary: "Migrated Microneedling protocol",
        itemCount: snapshot.items.length,
        publishedAt: now,
        passCount: 1
      }]
    }],
    passes: []
  };
}

function store(): DemoStore {
  if (!globalThis.__reentryProtocolDemoStore) globalThis.__reentryProtocolDemoStore = initialStore();
  return globalThis.__reentryProtocolDemoStore;
}

export function resetDemoProtocolStore() {
  globalThis.__reentryProtocolDemoStore = initialStore();
}

export function listDemoProtocols() {
  return store().templates.map((template) => ({
    id: template.id,
    protocol_name: template.draft.protocolName,
    treatment_label: template.draft.treatmentLabel,
    status: template.status,
    current_published_version: template.currentPublishedVersion,
    has_unpublished_changes: template.hasUnpublishedChanges,
    updated_at: template.updatedAt,
    archived_at: template.archivedAt,
    pass_count: template.versions.reduce((sum, version) => sum + version.passCount, 0)
  }));
}

export function getDemoProtocol(id: string): DemoProtocolTemplate | null {
  return store().templates.find((template) => template.id === id) ?? null;
}

export function saveDemoProtocol(id: string | null, draft: ProtocolDraft) {
  const current = store();
  const now = new Date().toISOString();
  if (!id) {
    const template: DemoProtocolTemplate = {
      id: crypto.randomUUID(),
      status: "draft",
      currentPublishedVersion: 0,
      hasUnpublishedChanges: false,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      draft: structuredClone(draft),
      versions: []
    };
    template.draft.id = template.id;
    current.templates.push(template);
    return template;
  }
  const template = getDemoProtocol(id);
  if (!template) throw new Error("Protocol not found");
  if (template.status === "archived") throw new Error("Archived protocols cannot be edited");
  template.draft = structuredClone({ ...draft, id });
  template.updatedAt = now;
  template.hasUnpublishedChanges = template.currentPublishedVersion > 0;
  return template;
}

export function publishDemoProtocol(id: string, changeSummary: string) {
  const template = getDemoProtocol(id);
  if (!template) throw new Error("Protocol not found");
  if (template.status === "archived") throw new Error("Archived protocols cannot be published");
  const snapshot = protocolSnapshotFromDraft(template.draft);
  const version: DemoProtocolVersion = {
    id: crypto.randomUUID(),
    version: template.currentPublishedVersion + 1,
    snapshot: structuredClone(snapshot),
    changeSummary: changeSummary || (template.currentPublishedVersion ? "Provider-authored revision" : "Initial publication"),
    itemCount: snapshot.items.length,
    publishedAt: new Date().toISOString(),
    passCount: 0
  };
  template.versions.push(version);
  template.currentPublishedVersion = version.version;
  template.status = "published";
  template.hasUnpublishedChanges = false;
  template.updatedAt = version.publishedAt;
  return version;
}

export function archiveDemoProtocol(id: string) {
  const template = getDemoProtocol(id);
  if (!template) throw new Error("Protocol not found");
  template.status = "archived";
  template.archivedAt = new Date().toISOString();
  template.hasUnpublishedChanges = false;
  return template;
}

export function listDemoPublishedVersions() {
  return store().templates
    .filter((template) => template.status === "published")
    .flatMap((template) => template.versions.map((version) => ({
      id: version.id,
      template_id: template.id,
      protocol_name: template.draft.protocolName,
      treatment_label: version.snapshot.treatmentLabel,
      version: version.version,
      recovery_duration_days: version.snapshot.recoveryDurationDays,
      snapshot: version.snapshot
    })));
}

export function issueDemoProtocolPass(templateVersionId: string, clientName: string, mobile: string, treatmentDate: string) {
  const current = store();
  const template = current.templates.find((candidate) => candidate.versions.some((version) => version.id === templateVersionId));
  if (!template) throw new Error("Published protocol version not found");
  if (template.status !== "published") throw new Error("Only published protocols can issue passes");
  const version = template.versions.find((candidate) => candidate.id === templateVersionId)!;
  current.sequence += 1;
  const suffix = String(current.sequence).padStart(4, "0");
  const pass: DemoIssuedPass = {
    id: crypto.randomUUID(),
    publicId: `SP-DEMO${suffix}`,
    token: `demo-protocol-token-${suffix}`,
    clientName,
    mobile,
    treatmentDate,
    templateVersionId,
    templateVersion: version.version,
    snapshot: structuredClone(version.snapshot),
    issuedAt: new Date().toISOString(),
    revoked: false
  };
  current.passes.push(pass);
  version.passCount += 1;
  return pass;
}

export function lookupDemoProtocolPass(publicId: string, token: string): PassSnapshotSource | null {
  const pass = store().passes.find((candidate) => candidate.publicId === publicId && candidate.token === token);
  if (!pass) return null;
  if (pass.revoked) return { access: "revoked", serverNow: new Date().toISOString(), lastVerifiedAt: new Date().toISOString(), publicId };
  return issuedPassSource(pass);
}

function issuedPassSource(pass: DemoIssuedPass): PassSnapshotSource {
  const snapshot = pass.snapshot;
  const treatment = new Date(`${pass.treatmentDate}T12:00:00.000Z`);
  const now = new Date(treatment);
  now.setUTCDate(now.getUTCDate() + 2);
  const isoForDay = (day: number) => {
    const value = new Date(treatment);
    value.setUTCDate(value.getUTCDate() + day);
    return value.toISOString();
  };
  const eventItems = snapshot.items
    .filter((entry) => !entry.baselineAvailable && entry.returnDay !== null)
    .sort((a, b) => (a.returnDay ?? 0) - (b.returnDay ?? 0) || a.ordinal - b.ordinal);
  return {
    access: "active",
    serverNow: now.toISOString(),
    lastVerifiedAt: now.toISOString(),
    publicId: pass.publicId,
    clientName: pass.clientName,
    treatmentName: snapshot.treatmentLabel,
    treatmentDate: pass.treatmentDate,
    protocolTimeZone: snapshot.protocolTimeZone,
    recoveryDurationDays: snapshot.recoveryDurationDays,
    routineRestoredMessage: snapshot.routineRestoredMessage,
    templateVersion: pass.templateVersion,
    providerName: "Amy Skin Studio",
    providerPhone: "+16265550142",
    providerGuidance: snapshot.providerGuidance,
    protocolVersion: 1,
    status: "issued",
    items: snapshot.items.map((entry) => ({
      id: `${pass.id}-${entry.itemKey}`,
      key: entry.itemKey,
      label: entry.canonicalName,
      kind: entry.kind,
      inventoryGroup: entry.inventoryGroup,
      baselineAvailable: entry.baselineAvailable,
      authoredReturnAt: entry.returnDay === null ? null : isoForDay(entry.returnDay),
      providerNote: entry.providerNote || null,
      clientExplanation: entry.clientExplanation || null,
      aliases: entry.aliases
    })),
    events: eventItems.map((entry, index) => ({
      id: `${pass.id}-event-${entry.itemKey}`,
      itemId: `${pass.id}-${entry.itemKey}`,
      itemKey: entry.itemKey,
      itemLabel: entry.canonicalName,
      ordinal: index + 1,
      returnAt: isoForDay(entry.returnDay ?? 0),
      completedAt: null
    })),
    versions: [{ version: 1, createdAt: pass.issuedAt, reason: `Issued from template version ${pass.templateVersion}`, changedItemLabel: null, previousReturnAt: null, newReturnAt: null }]
  };
}
