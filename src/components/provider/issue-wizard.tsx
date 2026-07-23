"use client";

import { useMemo, useState } from "react";
import { Action } from "@/components/ui/action";
import { ContextHeader } from "@/components/ui/context-header";
import { SkinPassArtifact } from "@/components/pass/skin-pass-artifact";
import type { ReturnEventSource } from "@/lib/domain/types";

type Issued = { id: string; publicId: string; token: string; protocolVersion: number };
type Step = 1 | 2 | 3 | 4;

const defaultDate = new Date().toISOString().slice(0, 10);

export function IssueWizard() {
  const [step, setStep] = useState<Step>(1);
  const [clientName, setClientName] = useState("");
  const [mobile, setMobile] = useState("");
  const [treatmentDate, setTreatmentDate] = useState(defaultDate);
  const [days, setDays] = useState({ makeup: 3, acids: 5, retinoid: 7, exercise: 0 });
  const [issued, setIssued] = useState<Issued | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const previewEvents = useMemo<ReturnEventSource[]>(() => [
    makePreviewEvent(treatmentDate, "makeup", "Makeup", 1, days.makeup),
    makePreviewEvent(treatmentDate, "acids", "Exfoliating acids", 2, days.acids),
    makePreviewEvent(treatmentDate, "retinoid", "Retinoid", 3, days.retinoid)
  ], [days, treatmentDate]);

  async function issue() {
    setLoading(true); setError(null);
    const response = await fetch("/api/provider/passes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      clientName, mobile, treatmentDate, treatmentName: "Microneedling",
      items: [
        { key: "makeup", returnDay: days.makeup },
        { key: "exfoliating-acids", returnDay: days.acids },
        { key: "retinoid", returnDay: days.retinoid },
        { key: "intense-exercise", returnDay: days.exercise }
      ]
    }) });
    const body = await response.json();
    if (!response.ok) { setError(body.error ?? "Skin Pass could not be issued."); setLoading(false); return; }
    setIssued(body); setStep(4); setLoading(false);
  }

  if (issued) return <IssuedShare issued={issued} mobile={mobile} />;

  return <>
    <ContextHeader title="Issue Skin Pass" meta={`STEP ${String(step).padStart(2, "0")} / 03`} backHref={step === 1 ? "/desk" : "#"} />
    <div className="stepper" aria-label="Issuance progress">{["Treatment", "Protocol", "Issue"].map((name, index) => <div className={`step ${step === index + 1 ? "current" : ""}`} key={name}><span className="number">0{index + 1}</span><span className="name">{name}</span></div>)}</div>
    {step === 1 && <section><h1 className="page-title small">What treatment happened?</h1><p className="support">The treatment and date establish every relative return event.</p><div className="stack-lg" style={{ marginTop: 36 }}><div className="field"><label htmlFor="client">Client name</label><input id="client" value={clientName} onChange={(e) => setClientName(e.target.value)} required /><small>Optional display name on provider records</small></div><div className="field"><label htmlFor="mobile">Client mobile</label><input id="mobile" type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} /><small>Optional for sms: handoff</small></div><div className="field"><label htmlFor="date">Treatment date</label><input id="date" type="date" value={treatmentDate} onChange={(e) => setTreatmentDate(e.target.value)} required /><small>Recovery Day 0 begins on this date</small></div><button className="choice selected" type="button"><div><strong>Microneedling</strong><span>7-day staged baseline</span></div><span className="choice-status">SELECTED</span></button><Action disabled={!clientName || !treatmentDate} onClick={() => setStep(2)}>Continue to protocol</Action></div></section>}
    {step === 2 && <section><h1 className="page-title small">Stage each return.</h1><p className="support">These dates become the live machine positions. Nothing is inferred later.</p><div className="stack-lg" style={{ marginTop: 30 }}><DayField label="Makeup" value={days.makeup} onChange={(value) => setDays({ ...days, makeup: value })} /><DayField label="Exfoliating acids" value={days.acids} onChange={(value) => setDays({ ...days, acids: value })} /><DayField label="Retinoid" value={days.retinoid} onChange={(value) => setDays({ ...days, retinoid: value })} /><DayField label="Intense exercise" value={days.exercise} onChange={(value) => setDays({ ...days, exercise: value })} /><Action onClick={() => setStep(3)}>Review exact client artifact</Action><Action variant="secondary" onClick={() => setStep(1)}>Back to treatment</Action></div></section>}
    {step === 3 && <section><h1 className="page-title small">Review before issuance.</h1><p className="support">Issuance creates the permanent pass ID, protocol version 1, secure token, and audit record.</p><div className="skin-pass-stack"><div className="future-tab"><div><small>Following</small>Exfoliating acids · Day {days.acids}</div><span>→</span></div><SkinPassArtifact event={previewEvents[0]} serverNow={`${treatmentDate}T00:00:00.000Z`} totalEvents={3} /></div><div className="disclosure"><h3>Exact protocol</h3><p>Makeup Day {days.makeup}<br />Exfoliating acids Day {days.acids}<br />Retinoid Day {days.retinoid}<br />Intense exercise Day {days.exercise}</p></div>{error && <p className="field-error" role="alert" style={{ marginTop: 16 }}>{error}</p>}<div className="stack" style={{ marginTop: 24 }}><Action onClick={issue} disabled={loading}>{loading ? "Issuing…" : "Issue Skin Pass"}</Action><Action variant="secondary" onClick={() => setStep(2)}>Back to protocol</Action></div></section>}
  </>;
}

function DayField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <div className="field"><label htmlFor={`day-${label}`}>{label} returns on</label><select id={`day-${label}`} value={value} onChange={(e) => onChange(Number(e.target.value))}>{Array.from({ length: 15 }, (_, day) => <option value={day} key={day}>Day {day}</option>)}</select></div>;
}

function IssuedShare({ issued, mobile }: { issued: Issued; mobile: string }) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = `${origin}/client/${issued.publicId}/${issued.token}`;
  const [copied, setCopied] = useState(false);
  async function copy() { await navigator.clipboard.writeText(url); setCopied(true); }
  async function share() { if (navigator.share) await navigator.share({ title: "RE:ENTRY Skin Pass", url }); else await copy(); }
  return <><ContextHeader title="Skin Pass issued" meta="COMPLETE" backHref="/desk" /><p className="section-label">Permanent ID assigned</p><h1 className="page-title small">The Skin Pass is live.</h1><p className="support">The raw access token is shown only in this delivery state. The database stores its hash.</p><div className="disclosure" style={{ marginTop: 28 }}><h3>Skin Pass ID</h3><p className="meta">{issued.publicId} · PROTOCOL {issued.protocolVersion}</p></div><p className="section-label">Secure client link</p><div className="copy-code">{url}</div><div className="stack" style={{ marginTop: 24 }}><Action onClick={copy}>{copied ? "Link copied" : "Copy secure client link"}</Action><Action variant="secondary" onClick={share}>Share with device</Action>{mobile && <Action variant="secondary" href={`sms:${mobile}?&body=${encodeURIComponent(`Your RE:ENTRY Skin Pass: ${url}`)}`}>Text client</Action>}<Action variant="secondary" href={`/client/${issued.publicId}/${issued.token}`}>Open client view</Action><Action variant="quiet" href={`/desk/pass/${issued.id}`}>Manage issued pass</Action></div></>;
}


function makePreviewEvent(treatmentDate: string, id: string, label: string, ordinal: number, day: number): ReturnEventSource {
  const date = new Date(`${treatmentDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + day);
  return { id, itemId: id, itemKey: id, itemLabel: label, ordinal, returnAt: date.toISOString(), completedAt: null };
}
