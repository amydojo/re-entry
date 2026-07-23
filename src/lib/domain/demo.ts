import type { PassSnapshotSource } from "./types";

export const DEMO_PUBLIC_ID = "SP-0042";
export const DEMO_TOKEN = "demo-secure-token";

export function makeDemoSnapshot(now = "2026-07-22T16:00:00.000Z"): PassSnapshotSource {
  return {
    access: "active",
    serverNow: now,
    lastVerifiedAt: now,
    publicId: DEMO_PUBLIC_ID,
    clientName: "Jordan Lee",
    treatmentName: "Microneedling",
    treatmentDate: "2026-07-20",
    providerName: "Amy Skin Studio",
    providerPhone: "+16265550142",
    providerGuidance: "Use only the products and activities named in this Skin Pass. Contact the studio for symptoms or anything unexpected.",
    protocolVersion: 1,
    status: "issued",
    items: [
      { id: "cleanser", key: "gentle-cleanser", label: "Gentle cleanser", kind: "product", inventoryGroup: "routine", baselineAvailable: true, authoredReturnAt: null },
      { id: "moisturizer", key: "barrier-moisturizer", label: "Barrier moisturizer", kind: "product", inventoryGroup: "routine", baselineAvailable: true, authoredReturnAt: null },
      { id: "spf", key: "mineral-spf", label: "Mineral SPF", kind: "product", inventoryGroup: "routine", baselineAvailable: true, authoredReturnAt: null },
      { id: "exercise", key: "intense-exercise", label: "Intense exercise", kind: "activity", inventoryGroup: "activity", baselineAvailable: true, authoredReturnAt: null },
      { id: "makeup", key: "makeup", label: "Makeup", kind: "product", inventoryGroup: "routine", baselineAvailable: false, authoredReturnAt: "2026-07-23T00:00:00.000Z" },
      { id: "acids", key: "exfoliating-acids", label: "Exfoliating acids", kind: "product", inventoryGroup: "routine", baselineAvailable: false, authoredReturnAt: "2026-07-25T00:00:00.000Z" },
      { id: "retinoid", key: "retinoid", label: "Retinoid", kind: "product", inventoryGroup: "routine", baselineAvailable: false, authoredReturnAt: "2026-07-27T00:00:00.000Z" }
    ],
    events: [
      { id: "event-makeup", itemId: "makeup", itemKey: "makeup", itemLabel: "Makeup", ordinal: 1, returnAt: "2026-07-23T00:00:00.000Z", completedAt: null },
      { id: "event-acids", itemId: "acids", itemKey: "exfoliating-acids", itemLabel: "Exfoliating acids", ordinal: 2, returnAt: "2026-07-25T00:00:00.000Z", completedAt: null },
      { id: "event-retinoid", itemId: "retinoid", itemKey: "retinoid", itemLabel: "Retinoid", ordinal: 3, returnAt: "2026-07-27T00:00:00.000Z", completedAt: null }
    ],
    versions: [{ version: 1, createdAt: "2026-07-20T18:00:00.000Z", reason: "Issued", changedItemLabel: null, previousReturnAt: null, newReturnAt: null }]
  };
}
