import { describe, expect, it } from "vitest";
import { cloneLightChemicalPeelDraft } from "@/lib/domain/protocol-presets";
import {
  makeProtocolPreviewSource,
  protocolSnapshotFromDraft,
  summarizeProtocolChange,
  validateProtocolForPublish
} from "@/lib/domain/protocol-studio";
import { normalizeProtocolTerm } from "@/lib/domain/normalization";
import { answerItem, derivePassState } from "@/lib/domain/time-engine";

function clone() {
  return cloneLightChemicalPeelDraft();
}

describe("Protocol Studio validation", () => {
  it("normalizes punctuation and spacing consistently", () => {
    expect(normalizeProtocolTerm("  Glycolic-Acid  ")).toBe("glycolic acid");
  });

  it("accepts the complete Light Chemical Peel protocol", () => {
    expect(validateProtocolForPublish(clone()).success).toBe(true);
  });

  it("allows a stable key to normalize to its own canonical name", () => {
    const draft = clone();
    draft.items[0].itemKey = "gentle-cleanser";
    expect(validateProtocolForPublish(draft).success).toBe(true);
  });

  it("rejects aliases that collide across items", () => {
    const draft = clone();
    draft.items[1].aliases.push("face wash");
    const result = validateProtocolForPublish(draft);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.message.includes("Collides"))).toBe(true);
  });

  it("rejects held items without a return condition", () => {
    const draft = clone();
    draft.items[3].returnDay = null;
    expect(validateProtocolForPublish(draft).success).toBe(false);
  });

  it("rejects return events beyond the declared recovery window", () => {
    const draft = clone();
    draft.recoveryDurationDays = 6;
    expect(validateProtocolForPublish(draft).success).toBe(false);
  });
});

describe("generic protocol snapshots", () => {
  it("creates an ordered immutable-ready snapshot", () => {
    const snapshot = protocolSnapshotFromDraft(clone());
    expect(snapshot.treatmentLabel).toBe("Light Chemical Peel");
    expect(snapshot.items[0].canonicalName).toBe("Gentle cleanser");
    expect(snapshot.items.at(-1)?.returnDay).toBe(10);
  });

  it("evaluates aliases without treatment-specific branching", () => {
    const state = derivePassState(makeProtocolPreviewSource(clone(), 2));
    expect(answerItem(state, "face wash").outcome).toBe("AVAILABLE");
    expect(answerItem(state, "foundation").outcome).toBe("QUEUED");
    expect(answerItem(state, "tretinoin").outcome).toBe("HELD");
    expect(answerItem(state, "vitamin c").outcome).toBe("NOT_IN_PASS");
    expect(answerItem(state, "my skin is burning").outcome).toBe("PROVIDER_ONLY");
  });

  it("waits for the routine-restored boundary after return events finish", () => {
    expect(derivePassState(makeProtocolPreviewSource(clone(), 7)).routineState).toBe("Re-entry in progress");
    expect(derivePassState(makeProtocolPreviewSource(clone(), 10)).routineState).toBe("Routine restored");
  });

  it("reports version differences without mutating the previous snapshot", () => {
    const first = protocolSnapshotFromDraft(clone());
    const secondDraft = clone();
    secondDraft.items.find((item) => item.itemKey === "retinoid")!.returnDay = 9;
    const changes = summarizeProtocolChange(first, secondDraft);
    expect(changes).toContain("Item timing, aliases, or guidance changed");
    expect(first.items.find((item) => item.itemKey === "retinoid")?.returnDay).toBe(10);
  });
});
