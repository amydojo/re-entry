import type { ProtocolDraft } from "./protocol-studio";

export const lightChemicalPeelDraft: ProtocolDraft = {
  protocolName: "Light Chemical Peel",
  treatmentLabel: "Light Chemical Peel",
  internalDescription: "A gentle peel protocol with staged product and activity return.",
  recoveryDurationDays: 10,
  protocolTimeZone: "America/Los_Angeles",
  providerGuidance: "Use only the products and activities named in this Skin Pass. Contact the studio for symptoms, worsening discomfort, or anything unexpected.",
  routineRestoredMessage: "Your full provider-authored routine is restored.",
  items: [
    {
      canonicalName: "Gentle cleanser",
      itemKey: "gentle-cleanser",
      kind: "product",
      category: "cleanser",
      inventoryGroup: "routine",
      clientExplanation: "Use the gentle cleanser selected by your provider.",
      providerNote: "Keep cleansing brief and non-exfoliating.",
      baselineAvailable: true,
      returnDay: null,
      aliases: ["cleanser", "face wash"],
      ordinal: 0,
      enabled: true
    },
    {
      canonicalName: "Barrier moisturizer",
      itemKey: "barrier-moisturizer",
      kind: "product",
      category: "moisturizer",
      inventoryGroup: "routine",
      clientExplanation: "Keep the routine simple and barrier-focused.",
      providerNote: "Use the provider-selected bland moisturizer.",
      baselineAvailable: true,
      returnDay: null,
      aliases: ["moisturizer", "barrier cream"],
      ordinal: 1,
      enabled: true
    },
    {
      canonicalName: "Mineral SPF",
      itemKey: "mineral-spf",
      kind: "product",
      category: "sun protection",
      inventoryGroup: "routine",
      clientExplanation: "Use the provider-selected mineral sunscreen.",
      providerNote: "Reapply as directed by the provider.",
      baselineAvailable: true,
      returnDay: null,
      aliases: ["sunscreen", "spf"],
      ordinal: 2,
      enabled: true
    },
    {
      canonicalName: "Intense exercise",
      itemKey: "intense-exercise",
      kind: "activity",
      category: "activity",
      inventoryGroup: "activity",
      clientExplanation: "Wait until the scheduled activity return day.",
      providerNote: "Avoid heat and heavy perspiration during the initial window.",
      baselineAvailable: false,
      returnDay: 2,
      aliases: ["workout", "gym", "running"],
      ordinal: 3,
      enabled: true
    },
    {
      canonicalName: "Makeup",
      itemKey: "makeup",
      kind: "product",
      category: "cosmetic",
      inventoryGroup: "routine",
      clientExplanation: "Wait until the scheduled return day before applying complexion products.",
      providerNote: "Clean applicators before first use after treatment.",
      baselineAvailable: false,
      returnDay: 3,
      aliases: ["foundation", "concealer"],
      ordinal: 4,
      enabled: true
    },
    {
      canonicalName: "Exfoliating acids",
      itemKey: "exfoliating-acids",
      kind: "product",
      category: "active",
      inventoryGroup: "routine",
      clientExplanation: "Keep exfoliating acids held until their scheduled return.",
      providerNote: "Includes leave-on acid toners and treatment serums.",
      baselineAvailable: false,
      returnDay: 7,
      aliases: ["aha", "bha", "glycolic acid", "salicylic acid"],
      ordinal: 5,
      enabled: true
    },
    {
      canonicalName: "Retinoid",
      itemKey: "retinoid",
      kind: "product",
      category: "active",
      inventoryGroup: "routine",
      clientExplanation: "Keep retinoids held until the final scheduled return.",
      providerNote: "Includes prescription and over-the-counter vitamin A products.",
      baselineAvailable: false,
      returnDay: 10,
      aliases: ["retinol", "tretinoin", "adapalene"],
      ordinal: 6,
      enabled: true
    }
  ]
};

export function cloneLightChemicalPeelDraft(): ProtocolDraft {
  return structuredClone(lightChemicalPeelDraft);
}
