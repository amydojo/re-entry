export type PassAccess = "active" | "revoked" | "expired" | "invalid";
export type PassStatus = "issued" | "revoked" | "expired";
export type ItemKind = "product" | "activity";
export type InventoryGroup = "routine" | "activity";
export type ItemState = "available" | "held" | "queued" | "returned";
export type AnswerOutcome = "AVAILABLE" | "HELD" | "QUEUED" | "NOT_IN_PASS" | "PROVIDER_ONLY";

export interface PassItemSource {
  id: string;
  key: string;
  label: string;
  kind: ItemKind;
  inventoryGroup: InventoryGroup;
  baselineAvailable: boolean;
  authoredReturnAt: string | null;
  providerNote?: string | null;
  clientExplanation?: string | null;
  aliases?: string[];
}

export interface ReturnEventSource {
  id: string;
  itemId: string;
  itemKey: string;
  itemLabel: string;
  ordinal: number;
  returnAt: string;
  completedAt: string | null;
}

export interface ProtocolVersionSource {
  version: number;
  createdAt: string;
  reason: string | null;
  changedItemLabel: string | null;
  previousReturnAt: string | null;
  newReturnAt: string | null;
}

export interface PassSnapshotSource {
  access: PassAccess;
  serverNow: string;
  lastVerifiedAt: string;
  publicId?: string;
  clientName?: string;
  treatmentName?: string;
  treatmentDate?: string;
  protocolTimeZone?: string;
  providerName?: string;
  providerPhone?: string | null;
  providerGuidance?: string | null;
  routineRestoredMessage?: string | null;
  recoveryDurationDays?: number;
  templateVersion?: number | null;
  protocolVersion?: number;
  status?: PassStatus;
  items?: PassItemSource[];
  events?: ReturnEventSource[];
  versions?: ProtocolVersionSource[];
}

export interface DerivedItem extends PassItemSource {
  state: ItemState;
  returnAt: string | null;
}

export interface DerivedPassState {
  access: PassAccess;
  serverNow: string;
  lastVerifiedAt: string;
  publicId: string | null;
  clientName: string | null;
  treatmentName: string | null;
  treatmentDate: string | null;
  protocolTimeZone: string;
  recoveryDay: number;
  recoveryDurationDays: number;
  routineState: "Re-entry in progress" | "Routine restored";
  routineRestoredMessage: string;
  activeEvent: ReturnEventSource | null;
  followingEvent: ReturnEventSource | null;
  completedEvents: ReturnEventSource[];
  items: DerivedItem[];
  availableRoutine: DerivedItem[];
  heldRoutine: DerivedItem[];
  updatedByProvider: ProtocolVersionSource | null;
  protocolVersion: number;
  templateVersion: number | null;
  providerName: string | null;
  providerPhone: string | null;
  providerGuidance: string | null;
}
