import { z } from "zod";
import type { PassSnapshotSource } from "./types";
import { normalizeProtocolTerm } from "./normalization";

export { normalizeProtocolTerm };
export type ProtocolTemplateStatus = "draft" | "published" | "archived";
export type ProtocolItemKind = "product" | "activity";
export type ProtocolInventoryGroup = "routine" | "activity";

export interface ProtocolDraftItem {
  id?: string;
  canonicalName: string;
  itemKey: string;
  kind: ProtocolItemKind;
  category: string;
  inventoryGroup: ProtocolInventoryGroup;
  clientExplanation: string;
  providerNote: string;
  baselineAvailable: boolean;
  returnDay: number | null;
  aliases: string[];
  ordinal: number;
  enabled: boolean;
}

export interface ProtocolDraft {
  id?: string;
  protocolName: string;
  treatmentLabel: string;
  internalDescription: string;
  recoveryDurationDays: number;
  protocolTimeZone: string;
  providerGuidance: string;
  routineRestoredMessage: string;
  items: ProtocolDraftItem[];
}

const timeZoneSchema = z.string().trim().min(1).max(80).refine((value) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}, "Use a valid IANA timezone.");

const draftItemSchema = z.object({
  id: z.string().uuid().optional(),
  canonicalName: z.string().trim().max(120),
  itemKey: z.string().trim().max(120),
  kind: z.enum(["product", "activity"]),
  category: z.string().trim().max(80),
  inventoryGroup: z.enum(["routine", "activity"]),
  clientExplanation: z.string().trim().max(500),
  providerNote: z.string().trim().max(500),
  baselineAvailable: z.boolean(),
  returnDay: z.number().int().min(0).max(180).nullable(),
  aliases: z.array(z.string().trim().max(80)).max(24),
  ordinal: z.number().int().min(0).max(200),
  enabled: z.boolean()
});

export const protocolDraftSaveSchema = z.object({
  id: z.string().uuid().optional(),
  protocolName: z.string().trim().max(120),
  treatmentLabel: z.string().trim().max(120),
  internalDescription: z.string().trim().max(500),
  recoveryDurationDays: z.number().int().min(1).max(180),
  protocolTimeZone: timeZoneSchema,
  providerGuidance: z.string().trim().max(1200),
  routineRestoredMessage: z.string().trim().max(500),
  items: z.array(draftItemSchema).max(60)
});

export const protocolDraftPublishSchema = protocolDraftSaveSchema.superRefine((draft, context) => {
  if (!draft.protocolName) context.addIssue({ code: "custom", path: ["protocolName"], message: "Protocol name is required before publishing." });
  if (!draft.treatmentLabel) context.addIssue({ code: "custom", path: ["treatmentLabel"], message: "Client-facing treatment label is required." });
  if (!draft.providerGuidance) context.addIssue({ code: "custom", path: ["providerGuidance"], message: "Provider guidance is required." });
  if (!draft.routineRestoredMessage) context.addIssue({ code: "custom", path: ["routineRestoredMessage"], message: "Routine-restored copy is required." });

  const items = draft.items.filter((item) => item.enabled);
  if (!items.length) {
    context.addIssue({ code: "custom", path: ["items"], message: "Add at least one enabled protocol item." });
    return;
  }

  const ordinals = new Set<number>();
  const names = new Map<string, number>();
  const lookupTerms = new Map<string, { index: number; label: string }>();
  let latestReturnDay = 0;

  items.forEach((item, index) => {
    const path = ["items", index] as (string | number)[];
    const canonical = normalizeProtocolTerm(item.canonicalName);
    const key = normalizeProtocolTerm(item.itemKey);
    if (!canonical) context.addIssue({ code: "custom", path: [...path, "canonicalName"], message: "Canonical display name is required." });
    if (!key) context.addIssue({ code: "custom", path: [...path, "itemKey"], message: "Item key is required." });

    if (canonical) {
      const duplicate = names.get(canonical);
      if (duplicate !== undefined) context.addIssue({ code: "custom", path: [...path, "canonicalName"], message: `Duplicates item ${duplicate + 1} after normalization.` });
      else names.set(canonical, index);
    }

    if (ordinals.has(item.ordinal)) context.addIssue({ code: "custom", path: [...path, "ordinal"], message: "Display order must be unique." });
    ordinals.add(item.ordinal);

    if (item.baselineAvailable && item.returnDay !== null && item.returnDay > 0) context.addIssue({ code: "custom", path: [...path, "returnDay"], message: "Available-now items cannot also have a future-only return day." });
    if (!item.baselineAvailable && item.returnDay === null) context.addIssue({ code: "custom", path: [...path, "returnDay"], message: "Held items need a return day." });
    if (item.returnDay !== null && item.returnDay > draft.recoveryDurationDays) context.addIssue({ code: "custom", path: [...path, "returnDay"], message: "Return day cannot exceed the recovery duration." });
    latestReturnDay = Math.max(latestReturnDay, item.returnDay ?? 0);

    const primaryTerms = new Set([canonical, key].filter(Boolean));
    for (const normalized of primaryTerms) {
      const existing = lookupTerms.get(normalized);
      if (existing && existing.index !== index) context.addIssue({ code: "custom", path, message: `Lookup term collides with ${existing.label}.` });
      else lookupTerms.set(normalized, { index, label: item.canonicalName || `item ${index + 1}` });
    }

    const localAliases = new Set<string>();
    item.aliases.forEach((alias, aliasIndex) => {
      const normalized = normalizeProtocolTerm(alias);
      const aliasPath = [...path, "aliases", aliasIndex];
      if (!normalized) {
        context.addIssue({ code: "custom", path: aliasPath, message: "Remove empty aliases." });
        return;
      }
      if (localAliases.has(normalized) || primaryTerms.has(normalized)) {
        context.addIssue({ code: "custom", path: aliasPath, message: "This item repeats the same lookup term." });
        return;
      }
      localAliases.add(normalized);
      const existing = lookupTerms.get(normalized);
      if (existing && existing.index !== index) context.addIssue({ code: "custom", path: aliasPath, message: `Collides with ${existing.label}.` });
      else lookupTerms.set(normalized, { index, label: item.canonicalName || `item ${index + 1}` });
    });
  });

  const sortedOrdinals = [...ordinals].sort((a, b) => a - b);
  sortedOrdinals.forEach((ordinal, index) => {
    if (ordinal !== index) context.addIssue({ code: "custom", path: ["items"], message: "Enabled item display order must be contiguous from 0." });
  });
  if (latestReturnDay > draft.recoveryDurationDays) context.addIssue({ code: "custom", path: ["recoveryDurationDays"], message: "Recovery duration must include every return event." });
});

export function validateProtocolForPublish(draft: unknown) {
  return protocolDraftPublishSchema.safeParse(draft);
}

export function protocolSnapshotFromDraft(draft: ProtocolDraft) {
  const items = draft.items.filter((item) => item.enabled).sort((a, b) => a.ordinal - b.ordinal).map((item) => ({
    itemKey: item.itemKey,
    canonicalName: item.canonicalName,
    kind: item.kind,
    category: item.category,
    inventoryGroup: item.inventoryGroup,
    clientExplanation: item.clientExplanation,
    providerNote: item.providerNote,
    baselineAvailable: item.baselineAvailable,
    returnDay: item.returnDay,
    aliases: item.aliases.map((alias) => alias.trim()).filter(Boolean),
    ordinal: item.ordinal
  }));
  return {
    protocolName: draft.protocolName,
    treatmentLabel: draft.treatmentLabel,
    internalDescription: draft.internalDescription,
    recoveryDurationDays: draft.recoveryDurationDays,
    protocolTimeZone: draft.protocolTimeZone,
    providerGuidance: draft.providerGuidance,
    routineRestoredMessage: draft.routineRestoredMessage,
    items
  };
}

function isoAtDay(day: number): string {
  const date = new Date("2026-01-01T12:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + day);
  return date.toISOString();
}

export function makeProtocolPreviewSource(draft: ProtocolDraft, recoveryDay: number): PassSnapshotSource {
  const snapshot = protocolSnapshotFromDraft(draft);
  const enabledItems = snapshot.items;
  const eventItems = enabledItems.filter((item) => !item.baselineAvailable && item.returnDay !== null).sort((a, b) => (a.returnDay ?? 0) - (b.returnDay ?? 0) || a.ordinal - b.ordinal);
  const items = enabledItems.map((item) => ({
    id: `preview-${item.itemKey}`,
    key: item.itemKey,
    label: item.canonicalName,
    kind: item.kind,
    inventoryGroup: item.inventoryGroup,
    baselineAvailable: item.baselineAvailable,
    authoredReturnAt: item.returnDay === null ? null : isoAtDay(item.returnDay),
    providerNote: item.providerNote || null,
    clientExplanation: item.clientExplanation || null,
    aliases: item.aliases
  }));
  const events = eventItems.map((item, index) => ({
    id: `preview-event-${item.itemKey}`,
    itemId: `preview-${item.itemKey}`,
    itemKey: item.itemKey,
    itemLabel: item.canonicalName,
    ordinal: index + 1,
    returnAt: isoAtDay(item.returnDay ?? 0),
    completedAt: null
  }));
  return {
    access: "active",
    serverNow: isoAtDay(Math.max(0, recoveryDay)),
    lastVerifiedAt: isoAtDay(Math.max(0, recoveryDay)),
    publicId: "PREVIEW",
    clientName: "Client preview",
    treatmentName: draft.treatmentLabel || "Untitled treatment",
    treatmentDate: "2026-01-01",
    protocolTimeZone: draft.protocolTimeZone,
    providerName: "Provider preview",
    providerPhone: null,
    providerGuidance: draft.providerGuidance,
    routineRestoredMessage: draft.routineRestoredMessage,
    recoveryDurationDays: draft.recoveryDurationDays,
    templateVersion: 0,
    protocolVersion: 1,
    status: "issued",
    items,
    events,
    versions: [{ version: 1, createdAt: "2026-01-01T12:00:00.000Z", reason: "Preview", changedItemLabel: null, previousReturnAt: null, newReturnAt: null }]
  };
}

export function summarizeProtocolChange(previousSnapshot: unknown, draft: ProtocolDraft): string[] {
  const next = protocolSnapshotFromDraft(draft);
  if (!previousSnapshot || typeof previousSnapshot !== "object") return ["Initial publication"];
  const previous = previousSnapshot as Partial<typeof next>;
  const changes: string[] = [];
  if (previous.protocolName !== next.protocolName) changes.push("Protocol identity changed");
  if (previous.treatmentLabel !== next.treatmentLabel) changes.push("Client treatment label changed");
  if (previous.recoveryDurationDays !== next.recoveryDurationDays) changes.push("Recovery duration changed");
  const previousItems = Array.isArray(previous.items) ? previous.items : [];
  if (previousItems.length !== next.items.length) changes.push(`Item count ${previousItems.length} → ${next.items.length}`);
  if (JSON.stringify(previousItems) !== JSON.stringify(next.items) && previousItems.length === next.items.length) changes.push("Item timing, aliases, or guidance changed");
  if (previous.providerGuidance !== next.providerGuidance) changes.push("Provider guidance changed");
  if (previous.routineRestoredMessage !== next.routineRestoredMessage) changes.push("Routine-restored message changed");
  return changes.length ? changes : ["No behavioral differences detected"];
}
