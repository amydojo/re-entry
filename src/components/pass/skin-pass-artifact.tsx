import type { DerivedPassState, ReturnEventSource } from "@/lib/domain/types";
import { formatProtocolDate, relativeReturnCopy } from "@/lib/domain/time-engine";

export function SkinPassArtifact({
  event,
  serverNow,
  totalEvents,
  completed = false,
  routineState = "Routine restored",
  recoveryDurationDays = 7,
  routineRestoredMessage = "Your provider-authored routine is fully restored."
}: {
  event: ReturnEventSource | null;
  serverNow: string;
  totalEvents: number;
  completed?: boolean;
  routineState?: DerivedPassState["routineState"];
  recoveryDurationDays?: number;
  routineRestoredMessage?: string;
}) {
  if (!event && routineState === "Re-entry in progress") {
    return (
      <article className="skin-pass" aria-label="Recovery window Skin Pass">
        <div className="skin-pass-edge" />
        <div className="skin-pass-signal" aria-label="Current recovery window" />
        <p className="meta">RECOVERY WINDOW</p>
        <div className="skin-pass-rule" />
        <h2>Routine remains staged</h2>
        <p className="skin-pass-date">FULL ROUTINE · DAY {String(recoveryDurationDays).padStart(2, "0")}</p>
        <div className="skin-pass-status"><small>Status</small><span>Awaiting restoration boundary</span></div>
        <span className="edge-label">ACTIVE PROTOCOL</span>
        <span className="event-index">··</span>
      </article>
    );
  }

  if (!event) {
    return (
      <article className="skin-pass" aria-label="Routine restored Skin Pass">
        <div className="skin-pass-edge" />
        <p className="meta">PROTOCOL COMPLETE</p>
        <div className="skin-pass-rule" />
        <h2>Routine restored</h2>
        <p className="skin-pass-date">{routineRestoredMessage.toUpperCase()}</p>
        <div className="skin-pass-status"><small>Status</small><span>Permanent record</span></div>
        <span className="edge-label">RETURN RECORD</span>
        <span className="event-index">✓</span>
      </article>
    );
  }

  const headline = completed
    ? `${event.itemLabel} returned\nto routine`
    : `${event.itemLabel} ${relativeReturnCopy(event.returnAt, serverNow).toLowerCase()}`;

  return (
    <article className="skin-pass" aria-label={`${event.itemLabel} return event`}>
      <div className="skin-pass-edge" />
      {!completed && <div className="skin-pass-signal" aria-label="Current event" />}
      <p className="meta">RETURN EVENT {String(event.ordinal).padStart(2, "0")}</p>
      <div className="skin-pass-rule" />
      <h2>{headline}</h2>
      <p className="skin-pass-date">{formatProtocolDate(event.returnAt)}</p>
      <div className="skin-pass-status"><small>Status</small><span>{completed ? "Returned to routine" : "Awaiting return"}</span></div>
      <span className="edge-label">{completed ? "COMPLETED EVENT" : "SCHEDULED CHANGE"}</span>
      <span className="event-index">{String(event.ordinal).padStart(2, "0")}/{String(totalEvents).padStart(2, "0")}</span>
    </article>
  );
}
