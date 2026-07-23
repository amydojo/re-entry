import type {
  AnswerOutcome,
  DerivedItem,
  DerivedPassState,
  PassSnapshotSource,
  ReturnEventSource
} from "./types";
import { isProviderOnlyQuery, normalizeProtocolTerm } from "./normalization";

const DAY_MS = 86_400_000;

function instant(value: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error(`Invalid protocol timestamp: ${value}`);
  return parsed;
}

function dateKeyInTimeZone(value: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone
  }).formatToParts(new Date(value));
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function calendarDayNumber(value: string): number {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

function eventIsComplete(event: ReturnEventSource, serverNowMs: number): boolean {
  return Boolean(event.completedAt) || instant(event.returnAt) <= serverNowMs;
}

export function derivePassState(source: PassSnapshotSource): DerivedPassState {
  const serverNowMs = instant(source.serverNow);
  const events = [...(source.events ?? [])].sort(
    (a, b) => instant(a.returnAt) - instant(b.returnAt) || a.ordinal - b.ordinal
  );
  const completedEvents = events.filter((event) => eventIsComplete(event, serverNowMs));
  const incompleteEvents = events.filter((event) => !eventIsComplete(event, serverNowMs));
  const activeEvent = incompleteEvents[0] ?? null;
  const followingEvent = incompleteEvents[1] ?? null;
  const completedIds = new Set(completedEvents.map((event) => event.itemId));

  const items: DerivedItem[] = (source.items ?? []).map((item) => {
    const matchingEvent = events.find((event) => event.itemId === item.id) ?? null;
    let state: DerivedItem["state"];
    if (item.baselineAvailable) state = "available";
    else if (matchingEvent && activeEvent?.id === matchingEvent.id) state = "queued";
    else if (matchingEvent && completedIds.has(item.id)) state = "returned";
    else state = "held";
    return { ...item, state, returnAt: matchingEvent?.returnAt ?? item.authoredReturnAt };
  });

  const treatmentDate = source.treatmentDate ?? null;
  const protocolTimeZone = source.protocolTimeZone ?? "America/Los_Angeles";
  const currentDateKey = dateKeyInTimeZone(source.serverNow, protocolTimeZone);
  const recoveryDay = treatmentDate
    ? Math.max(0, calendarDayNumber(currentDateKey) - calendarDayNumber(treatmentDate))
    : 0;
  const recoveryDurationDays = Math.max(1, source.recoveryDurationDays ?? 7);
  const routineState = incompleteEvents.length === 0 && recoveryDay >= recoveryDurationDays
    ? "Routine restored"
    : "Re-entry in progress";
  const updatedByProvider = [...(source.versions ?? [])]
    .filter((version) => version.version > 1)
    .sort((a, b) => b.version - a.version)[0] ?? null;

  return {
    access: source.access,
    serverNow: source.serverNow,
    lastVerifiedAt: source.lastVerifiedAt,
    publicId: source.publicId ?? null,
    clientName: source.clientName ?? null,
    treatmentName: source.treatmentName ?? null,
    treatmentDate,
    protocolTimeZone,
    recoveryDay,
    recoveryDurationDays,
    routineState,
    routineRestoredMessage: source.routineRestoredMessage ?? "Your provider-authored routine is fully restored.",
    activeEvent,
    followingEvent,
    completedEvents,
    items,
    availableRoutine: items.filter(
      (item) => item.inventoryGroup === "routine" && (item.state === "available" || item.state === "returned")
    ),
    heldRoutine: items.filter(
      (item) => item.inventoryGroup === "routine" && item.state === "held"
    ),
    updatedByProvider,
    protocolVersion: source.protocolVersion ?? 1,
    templateVersion: source.templateVersion ?? null,
    providerName: source.providerName ?? null,
    providerPhone: source.providerPhone ?? null,
    providerGuidance: source.providerGuidance ?? null
  };
}

export function answerItem(state: DerivedPassState, query: string): {
  outcome: AnswerOutcome;
  item: DerivedItem | null;
} {
  const normalized = normalizeProtocolTerm(query);
  if (!normalized) return { outcome: "NOT_IN_PASS", item: null };
  if (isProviderOnlyQuery(query)) return { outcome: "PROVIDER_ONLY", item: null };
  const item = state.items.find((candidate) => {
    const terms = [candidate.label, candidate.key, ...(candidate.aliases ?? [])];
    return terms.some((term) => normalizeProtocolTerm(term) === normalized);
  }) ?? null;
  if (!item) return { outcome: "NOT_IN_PASS", item: null };
  if (item.state === "queued") return { outcome: "QUEUED", item };
  if (item.state === "held") return { outcome: "HELD", item };
  return { outcome: "AVAILABLE", item };
}

export function formatProtocolDate(value: string, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    timeZone: "UTC"
  }).format(new Date(value)).toUpperCase();
}

export function relativeReturnCopy(returnAt: string, serverNow: string): string {
  const days = Math.ceil((instant(returnAt) - instant(serverNow)) / DAY_MS);
  if (days <= 0) return "Available now";
  if (days === 1) return "Returns tomorrow";
  return `Returns in ${days} days`;
}
