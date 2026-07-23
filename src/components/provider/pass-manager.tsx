"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Action } from "@/components/ui/action";
import { ContextHeader } from "@/components/ui/context-header";

type EventRow = { id: string; ordinal: number; return_at: string; completed_at: string | null; item_label: string };
type VersionRow = { version: number; created_at: string; reason: string | null; changed_item_label: string | null; previous_return_at: string | null; new_return_at: string | null };
type AuditRow = { id: string; action: string; actor_kind: string; metadata: Record<string, unknown>; created_at: string };
type Pass = { id: string; public_id: string; client_name: string; client_mobile: string | null; treatment_name: string; treatment_date: string; status: string; protocol_version: number; revoked_at: string | null };

export function PassManager({ pass, events, versions, audits, serverNow }: { pass: Pass; events: EventRow[]; versions: VersionRow[]; audits: AuditRow[]; serverNow: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"manage" | "edit" | "review" | "revoke" | "revoked">(pass.status === "revoked" ? "revoked" : "manage");
  const futureEvents = useMemo(() => events.filter((event) => !event.completed_at && new Date(event.return_at).getTime() > new Date(serverNow).getTime()), [events, serverNow]);
  const [eventId, setEventId] = useState(futureEvents[0]?.id ?? "");
  const selected = futureEvents.find((event) => event.id === eventId) ?? null;
  const [returnDate, setReturnDate] = useState(selected?.return_at.slice(0, 10) ?? "");
  const [reason, setReason] = useState("");
  const [revokeNote, setRevokeNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function chooseEvent(id: string) {
    setEventId(id); const event = futureEvents.find((candidate) => candidate.id === id); setReturnDate(event?.return_at.slice(0, 10) ?? "");
  }

  async function publish() {
    if (!selected) return; setLoading(true); setError(null);
    const response = await fetch(`/api/provider/passes/${pass.id}/events/${selected.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ returnAt: `${returnDate}T00:00:00.000Z`, reason }) });
    const body = await response.json();
    if (!response.ok) { setError(body.error ?? "Update failed"); setLoading(false); return; }
    setLoading(false); setMode("manage"); router.refresh();
  }

  async function revoke() {
    setLoading(true); setError(null);
    const response = await fetch(`/api/provider/passes/${pass.id}/revoke`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ note: revokeNote }) });
    const body = await response.json();
    if (!response.ok) { setError(body.error ?? "Revocation failed"); setLoading(false); return; }
    setLoading(false); setMode("revoked"); router.refresh();
  }

  if (mode === "revoked") return <><ContextHeader title="Pass revoked" meta="ACCESS CLOSED" backHref="/desk" /><p className="section-label">Lifecycle complete</p><h1 className="page-title small">The client link no longer exposes protocol details.</h1><p className="support">The revocation, reason, and time remain in the provider audit record.</p><div className="disclosure" style={{ marginTop: 32 }}><h3>Revoked pass</h3><p>{pass.client_name}<br />{pass.public_id}<br />{pass.revoked_at ? new Date(pass.revoked_at).toLocaleString() : "Just revoked"}</p></div><div style={{ marginTop: 28 }}><Action href="/desk">Return to desk</Action></div></>;

  if (mode === "edit" || mode === "review") return <><ContextHeader title={mode === "edit" ? "Update protocol" : "Review update"} meta={`VERSION ${pass.protocol_version + 1}`} backHref="#" />
    {mode === "edit" ? <><p className="section-label">Future events only</p><h1 className="page-title small">Completed events are locked.</h1><p className="support">Choose one future return event. Publishing creates a new protocol version and client notice.</p><div className="stack-lg" style={{ marginTop: 30 }}><div className="field"><label htmlFor="event">Return event</label><select id="event" value={eventId} onChange={(e) => chooseEvent(e.target.value)}>{futureEvents.map((event) => <option value={event.id} key={event.id}>{event.item_label} · {new Date(event.return_at).toLocaleDateString()}</option>)}</select></div><div className="field"><label htmlFor="return-date">New return date</label><input id="return-date" type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} /></div><div className="field"><label htmlFor="reason">Reason for update</label><textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} /><small>Shown in provider audit history and protocol version record</small></div><Action disabled={!selected || !returnDate || reason.trim().length < 3} onClick={() => setMode("review")}>Review version difference</Action><Action variant="secondary" onClick={() => setMode("manage")}>Cancel update</Action></div></>
    : <><p className="section-label">Version difference</p><h1 className="page-title small">One provider-authored date will change.</h1><div className="disclosure" style={{ marginTop: 28 }}><h3>{selected?.item_label}</h3><p>Previous: {selected ? new Date(selected.return_at).toLocaleDateString() : "—"}<br />New: {returnDate ? new Date(`${returnDate}T00:00:00Z`).toLocaleDateString() : "—"}<br /><br />Reason: {reason}</p></div><div className="notice" style={{ marginTop: 22 }}>The client will see “Provider updated” and protocol version {pass.protocol_version + 1}.</div>{error && <p className="field-error" role="alert">{error}</p>}<div className="stack" style={{ marginTop: 24 }}><Action disabled={loading} onClick={publish}>{loading ? "Publishing…" : "Publish update"}</Action><Action variant="secondary" onClick={() => setMode("edit")}>Back to edit</Action></div></>}</>;

  if (mode === "revoke") return <><ContextHeader title="Revoke Skin Pass" meta="CONFIRM" backHref="#" /><p className="section-label">Explicit confirmation</p><h1 className="page-title small">Close client access permanently?</h1><p className="support">Revocation overrides the current protocol. No treatment details will remain visible from the client link.</p><div className="disclosure" style={{ marginTop: 28 }}><h3>Consequences</h3><p>Client access closes immediately.<br />The token is revoked.<br />Protocol details are no longer returned.<br />The audit record remains provider-visible.</p></div><div className="field" style={{ marginTop: 24 }}><label htmlFor="revoke-note">Revocation note</label><textarea id="revoke-note" value={revokeNote} onChange={(e) => setRevokeNote(e.target.value)} /></div>{error && <p className="field-error" role="alert">{error}</p>}<div className="stack" style={{ marginTop: 24 }}><Action variant="danger" disabled={loading || revokeNote.trim().length < 3} onClick={revoke}>{loading ? "Revoking…" : "Confirm revocation"}</Action><Action variant="secondary" onClick={() => setMode("manage")}>Cancel</Action></div></>;

  return <><ContextHeader title="Manage Skin Pass" meta={pass.public_id} backHref="/desk" /><p className="section-label">{pass.status.toUpperCase()} · PROTOCOL {pass.protocol_version}</p><h1 className="page-title small">{pass.client_name}</h1><p className="support">{pass.treatment_name} · {pass.treatment_date}</p><div className="choice selected" style={{ marginTop: 24 }}><div><strong>{pass.public_id}</strong><span>{events.filter((event) => event.completed_at).length} completed · {futureEvents.length} future</span></div><span className="choice-status">ACTIVE</span></div>
    <p className="section-label">Management actions</p><div className="stack"><Action variant="secondary" disabled={!futureEvents.length} onClick={() => setMode("edit")}>Edit future return date</Action><Action variant="secondary" onClick={() => navigator.clipboard.writeText(pass.public_id)}>Copy permanent pass ID</Action><Action variant="danger" onClick={() => setMode("revoke")}>Revoke pass</Action></div>
    <p className="section-label">Protocol versions</p><ul className="audit-list">{versions.map((version) => <li key={version.version}><span className="meta">VERSION {version.version} · {new Date(version.created_at).toLocaleDateString()}</span><br />{version.version === 1 ? "Skin Pass issued" : `${version.changed_item_label} changed from ${version.previous_return_at ? new Date(version.previous_return_at).toLocaleDateString() : "—"} to ${version.new_return_at ? new Date(version.new_return_at).toLocaleDateString() : "—"}`}{version.reason && <><br />{version.reason}</>}</li>)}</ul>
    <p className="section-label">Audit history</p><ul className="audit-list">{audits.slice(0, 8).map((audit) => <li key={audit.id}><span className="meta">{audit.action.replaceAll("_", " ")} · {new Date(audit.created_at).toLocaleString()}</span><br />Actor: {audit.actor_kind}</li>)}</ul>
  </>;
}
