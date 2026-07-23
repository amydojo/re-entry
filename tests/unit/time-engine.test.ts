import { describe, expect, it } from "vitest";
import { answerItem, derivePassState, relativeReturnCopy } from "@/lib/domain/time-engine";
import { makeDemoSnapshot } from "@/lib/domain/demo";

const DAY2 = "2026-07-22T23:00:00.000Z";

describe("deterministic time engine", () => {
  it("derives Day 2 in the provider-authored timezone", () => {
    const state = derivePassState(makeDemoSnapshot(DAY2));
    expect(state.recoveryDay).toBe(2);
    expect(state.activeEvent?.itemLabel).toBe("Makeup");
    expect(state.followingEvent?.itemLabel).toBe("Exfoliating acids");
    expect(state.availableRoutine).toHaveLength(3);
    expect(state.heldRoutine).toHaveLength(2);
  });

  it("advances all connected state from the supplied server clock", () => {
    const state = derivePassState(makeDemoSnapshot("2026-07-25T08:00:00.000Z"));
    expect(state.completedEvents.map((event) => event.itemLabel)).toEqual(["Makeup", "Exfoliating acids"]);
    expect(state.activeEvent?.itemLabel).toBe("Retinoid");
    expect(state.availableRoutine.map((item) => item.label)).toContain("Makeup");
    expect(state.availableRoutine.map((item) => item.label)).toContain("Exfoliating acids");
  });

  it("enters Routine restored after all authored events complete", () => {
    const state = derivePassState(makeDemoSnapshot("2026-07-28T08:00:00.000Z"));
    expect(state.routineState).toBe("Routine restored");
    expect(state.activeEvent).toBeNull();
  });

  it("does not trust the real clock", () => {
    expect(derivePassState(makeDemoSnapshot(DAY2)).serverNow).toBe(DAY2);
  });

  it("formats relative return copy deterministically", () => {
    expect(relativeReturnCopy("2026-07-23T23:00:00Z", DAY2)).toBe("Returns tomorrow");
  });
});

describe("issued-pass answer engine", () => {
  const state = derivePassState(makeDemoSnapshot(DAY2));
  it.each([
    ["Gentle cleanser", "AVAILABLE"],
    ["Retinoid", "HELD"],
    ["Makeup", "QUEUED"],
    ["Vitamin C", "NOT_IN_PASS"],
    ["My skin is burning", "PROVIDER_ONLY"]
  ] as const)("answers %s as %s", (query, outcome) => {
    expect(answerItem(state, query).outcome).toBe(outcome);
  });
});
