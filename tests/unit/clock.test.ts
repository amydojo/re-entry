import { describe, expect, it } from "vitest";
import { FixedClock } from "@/lib/domain/clock";

describe("test clock", () => {
  it("returns copies of one controlled instant", () => {
    const clock = new FixedClock(new Date("2026-07-22T20:00:00Z"));
    const first = clock.now(); first.setUTCFullYear(2030);
    expect(clock.now().toISOString()).toBe("2026-07-22T20:00:00.000Z");
  });
});
