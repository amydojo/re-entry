import { describe, expect, it } from "vitest";
import { applyFutureReturnUpdate, canEditReturnEvent, nextProtocolVersion } from "@/lib/domain/protocol-policy";
import type { ReturnEventSource } from "@/lib/domain/types";

const future: ReturnEventSource = { id: "event", itemId: "item", itemKey: "retinoid", itemLabel: "Retinoid", ordinal: 3, returnAt: "2026-07-27T07:00:00Z", completedAt: null };

describe("protocol mutation policy", () => {
  it("permits only incomplete future events", () => {
    expect(canEditReturnEvent(future, "2026-07-22T20:00:00Z")).toBe(true);
    expect(canEditReturnEvent({ ...future, completedAt: "2026-07-21T00:00:00Z" }, "2026-07-22T20:00:00Z")).toBe(false);
    expect(canEditReturnEvent({ ...future, returnAt: "2026-07-20T00:00:00Z" }, "2026-07-22T20:00:00Z")).toBe(false);
  });

  it("preserves the event identity while updating a future timestamp", () => {
    expect(applyFutureReturnUpdate(future, "2026-07-28T07:00:00Z", "2026-07-22T20:00:00Z")).toEqual({ ...future, returnAt: "2026-07-28T07:00:00Z" });
  });

  it("rejects completed and past edits", () => {
    expect(() => applyFutureReturnUpdate({ ...future, completedAt: future.returnAt }, "2026-07-28T07:00:00Z", "2026-07-22T20:00:00Z")).toThrow(/Only future/);
    expect(() => applyFutureReturnUpdate(future, "2026-07-21T07:00:00Z", "2026-07-22T20:00:00Z")).toThrow(/remain in the future/);
  });

  it("increments protocol versions exactly once", () => expect(nextProtocolVersion(4)).toBe(5));
});
