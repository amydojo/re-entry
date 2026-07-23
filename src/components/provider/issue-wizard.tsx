"use client";

import { useMemo, useState } from "react";
import { Action } from "@/components/ui/action";
import { ContextHeader } from "@/components/ui/context-header";
import { ReentryRail } from "@/components/pass/reentry-rail";
import { SkinPassArtifact } from "@/components/pass/skin-pass-artifact";
import { derivePassState } from "@/lib/domain/time-engine";
import { makeProtocolPreviewSource, type ProtocolDraft } from "@/lib/domain/protocol-studio";

type ProtocolSnapshot = Omit<ProtocolDraft, "id" | "items"> & {
  items: Array<{
    itemKey: string;
    canonicalName: string;
    kind: "product" | "activity";
    category: string;
    inventoryGroup: "routine" | "activity";
    clientExplanation: string;
    providerNote: string;
    baselineAvailable: boolean;
    returnDay: number | null;
    aliases: string[];
    ordinal: number;
  }>;
};

export type IssuableProtocolVersion = {
  id: string;
  templateId: string;
  protocolName: string;
  treatmentLabel: string;
  version: number;
  recoveryDurationDays: number;
  snapshot: unknown;
};

type Issued = {
  id: string;
  publicId: string;
  token: string;
  protocolVersion: number;
  templateVersion: number;
  treatmentName: string;
};

type Step = 1 | 2 | 3;
const defaultDate = new Date().toISOString().slice(0, 10);

function snapshotToDraft(snapshot: unknown): ProtocolDraft {
  const source = snapshot as ProtocolSnapshot;
  return {
    protocolName: source.protocolName ?? "Published protocol",
    treatmentLabel: source.treatmentLabel ?? "Treatment",
    internalDescription: source.internalDescription ?? "",
    recoveryDurationDays: source.recoveryDurationDays ?? 7,
    protocolTimeZone: source.protocolTimeZone ?? "America/Los_Angeles",
    providerGuidance: source.providerGuidance ?? "Contact the provider for symptoms or anything unexpected.",
    routineRestoredMessage: source.routineRestoredMessage ?? "Your provider-authored routine is fully restored.",
    items: (source.items ?? []).map((item) => ({ ...item, enabled: true }))
  };
}

export function IssueWizard({ protocols, initialTemplateId }: { protocols: IssuableProtocolVersion[]; initialTemplateId: string | null }) {
  const preferred = protocols.find((protocol) => protocol.templateId === initialTemplateId) ?? protocols[0] ?? null;
  const [step, setStep] = useState<Step>(1);
  const [selectedId, setSelectedId] = useState(preferred?.id ?? "");
  const [clientName, setClientName] = useState("");
  const [mobile, setMobile] = useState("");
  const [treatmentDate, setTreatmentDate] = useState(defaultDate);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selected = protocols.find((protocol) => protocol.id === selectedId) ?? null;
  const draft = useMemo(() => selected ? snapshotToDraft(selected.snapshot) : null, [selected]);
  const previewSource = useMemo(() => draft ? makeProtocolPreviewSource(draft, 0) : null, [draft]);
  const previewState = useMemo(() => previewSource ? derivePassState(previewSource) : null, [previewSource]);

  async function issue() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    const response = await fetch("/api/provider/passes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        templateVersionId: selected.id,
        clientName,
        mobile,
        treatmentDate
      })
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "Skin Pass could not be issued.");
      setLoading(false);
      return;
    }
    setIssued(body);
    setStep(3);
    setLoading(false);
  }

  if (issued) return <IssuedShare issued={issued} mobile={mobile} />;

  return (
    <>
      <ContextHeader title="Issue Skin Pass" meta={`STEP ${String(step).padStart(2, "0")} / 02`} backHref={step === 1 ? "/desk" : "#"} />
      <div className="stepper issue-two" aria-label="Issuance progress">
        {["Protocol + client", "Review + issue"].map((name, index) => <div className={`step ${step === index + 1 ? "current" : ""}`} key={name}><span className="number">0{index + 1}</span><span className="name">{name}</span></div>)}
      </div>

      {!protocols.length && <section className="access-state"><p className="meta">NO PUBLISHED PROTOCOLS</p><h1 className="page-title">Fix an edition first.</h1><p className="support">Drafts and archived protocols cannot issue Skin Passes.</p><Action href="/protocols/new">Create a protocol</Action></section>}

      {step === 1 && protocols.length > 0 && (
        <section>
          <h1 className="page-title small">Choose a fixed protocol edition.</h1>
          <p className="support">The issued Skin Pass receives an immutable snapshot. Later template edits cannot rewrite it.</p>
          <div className="stack-lg" style={{ marginTop: 30 }}>
            <div className="stack" role="radiogroup" aria-label="Published protocols">
              {protocols.map((protocol) => <button className={`choice ${selectedId === protocol.id ? "selected" : ""}`} aria-pressed={selectedId === protocol.id} type="button" key={protocol.id} onClick={() => setSelectedId(protocol.id)}><div><strong>{protocol.treatmentLabel}</strong><span>{protocol.protocolName} · {protocol.recoveryDurationDays}-day window</span></div><span className="choice-status">V{protocol.version} · FIXED</span></button>)}
            </div>
            <div className="field"><label htmlFor="client">Client name</label><input id="client" value={clientName} onChange={(event) => setClientName(event.target.value)} required /></div>
            <div className="field"><label htmlFor="mobile">Client mobile</label><input id="mobile" type="tel" value={mobile} onChange={(event) => setMobile(event.target.value)} /><small>Optional for the device sms: handoff</small></div>
            <div className="field"><label htmlFor="date">Treatment date</label><input id="date" type="date" value={treatmentDate} onChange={(event) => setTreatmentDate(event.target.value)} required /><small>Recovery Day 0 begins in the protocol timezone</small></div>
            <Action disabled={!selected || !clientName || !treatmentDate} onClick={() => setStep(2)}>Review exact client artifact</Action>
          </div>
        </section>
      )}

      {step === 2 && selected && previewSource && previewState && (
        <section>
          <h1 className="page-title small">Review the fixed edition.</h1>
          <p className="support">Issuance preserves template version {selected.version}, creates a permanent pass ID, hashes the access token, and records pass protocol version 1.</p>
          <div className="skin-pass-stack">
            {previewState.followingEvent && <div className="future-tab"><div><small>Following</small>{previewState.followingEvent.itemLabel}</div><span>→</span></div>}
            <SkinPassArtifact event={previewState.activeEvent} serverNow={previewState.serverNow} totalEvents={previewSource.events?.length ?? 0} routineState={previewState.routineState} recoveryDurationDays={previewState.recoveryDurationDays} routineRestoredMessage={previewState.routineRestoredMessage} />
          </div>
          <ReentryRail state={previewState} />
          <div className="disclosure" style={{ marginTop: 22 }}><h3>Exact protocol snapshot</h3><p>{selected.treatmentLabel} · Template version {selected.version}<br />{draft?.items.filter((item) => item.baselineAvailable).length ?? 0} available immediately<br />{draft?.items.filter((item) => !item.baselineAvailable).length ?? 0} staged return items<br />Routine restored Day {selected.recoveryDurationDays}</p></div>
          {error && <p className="field-error" role="alert" style={{ marginTop: 16 }}>{error}</p>}
          <div className="stack" style={{ marginTop: 24 }}><Action onClick={issue} disabled={loading}>{loading ? "Issuing…" : "Issue Skin Pass"}</Action><Action variant="secondary" onClick={() => setStep(1)}>Back to protocol selection</Action></div>
        </section>
      )}
    </>
  );
}

function IssuedShare({ issued, mobile }: { issued: Issued; mobile: string }) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = `${origin}/client/${issued.publicId}/${issued.token}`;
  const [copied, setCopied] = useState(false);
  async function copy() { await navigator.clipboard.writeText(url); setCopied(true); }
  async function share() { if (navigator.share) await navigator.share({ title: "RE:ENTRY Skin Pass", url }); else await copy(); }
  return <><ContextHeader title="Skin Pass issued" meta="COMPLETE" backHref="/desk" /><p className="section-label">Permanent ID assigned</p><h1 className="page-title small">The {issued.treatmentName} Skin Pass is live.</h1><p className="support">Template version {issued.templateVersion} is now an immutable issued snapshot. The raw token is shown only in this delivery state.</p><div className="disclosure" style={{ marginTop: 28 }}><h3>Skin Pass record</h3><p className="meta">{issued.publicId} · TEMPLATE {issued.templateVersion} · PASS {issued.protocolVersion}</p></div><p className="section-label">Secure client link</p><div className="copy-code">{url}</div><div className="stack" style={{ marginTop: 24 }}><Action onClick={copy}>{copied ? "Link copied" : "Copy secure client link"}</Action><Action variant="secondary" onClick={share}>Share with device</Action>{mobile && <Action variant="secondary" href={`sms:${mobile}?&body=${encodeURIComponent(`Your RE:ENTRY Skin Pass: ${url}`)}`}>Text client</Action>}<Action variant="secondary" href={`/client/${issued.publicId}/${issued.token}`}>Open client view</Action><Action variant="quiet" href={`/desk/pass/${issued.id}`}>Manage issued pass</Action></div></>;
}
