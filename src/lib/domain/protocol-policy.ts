import type { ReturnEventSource } from "./types";

export function canEditReturnEvent(event: ReturnEventSource, serverNow: string): boolean {
  return event.completedAt === null && Date.parse(event.returnAt) > Date.parse(serverNow);
}

export function nextProtocolVersion(currentVersion: number): number {
  if (!Number.isInteger(currentVersion) || currentVersion < 1) throw new Error("Invalid protocol version");
  return currentVersion + 1;
}

export function applyFutureReturnUpdate(
  event: ReturnEventSource,
  newReturnAt: string,
  serverNow: string
): ReturnEventSource {
  if (!canEditReturnEvent(event, serverNow)) throw new Error("Only future return events may be edited");
  if (Date.parse(newReturnAt) <= Date.parse(serverNow)) throw new Error("Updated return event must remain in the future");
  return { ...event, returnAt: newReturnAt };
}
