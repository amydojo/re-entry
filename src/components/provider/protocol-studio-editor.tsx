"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Action } from "@/components/ui/action";
import { ReentryRail } from "@/components/pass/reentry-rail";
import { SkinPassArtifact } from "@/components/pass/skin-pass-artifact";
import { answerItem, derivePassState } from "@/lib/domain/time-engine";
import {
  makeProtocolPreviewSource,
  normalizeProtocolTerm,
  summarizeProtocolChange,
  validateProtocolForPublish,
  type ProtocolDraft,
  type ProtocolDraftItem,
  type ProtocolTemplateStatus
} from "@/lib/domain/protocol-studio";

type VersionRecord = {
  id: string;
  version: number;
  snapshot: unknown;
  changeSummary: string;
  itemCount: number;
  publishedAt: string;
  passCount?: number;
};

type Mode = "edit" | "preview" | "publish" | "published" | "history" | "archive" | "archived";

type EditorProps = {
  initialDraft: ProtocolDraft;
  templateId: string | null;
  initialStatus: ProtocolTemplateStatus;
  initialVersion: number;
  initialHasUnpublishedChanges: boolean;
  initialVersions: VersionRecord[];
};

export function ProtocolStudioEditor({
  initialDraft,
  templateId,
  initialStatus,
  initialVersion,
  initialHasUnpublishedChanges,
  initialVersions
}: EditorProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialDraft);
  const [savedId, setSavedId] = useState(templateId);
  const [status, setStatus] = useState(initialStatus);
  const [currentVersion, setCurrentVersion] = useState(initialVersion);
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(initialHasUnpublishedChanges);
  const [versions, setVersions] = useState(initialVersions);
  const [mode, setMode] = useState<Mode>(initialStatus === "archived" ? "archived" : "edit");
  const [previewDay, setPreviewDay] = useState(2);
  const [previewQuery, setPreviewQuery] = useState("retinol");
  const [changeSummary, setChangeSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const validationRef = useRef<HTMLDivElement>(null);
  const itemListRef = useRef<HTMLDivElement>(null);

  const previewSource = useMemo(() => makeProtocolPreviewSource(draft, previewDay), [draft, previewDay]);
  const previewState = useMemo(() => derivePassState(previewSource), [previewSource]);
  const previewAnswer = useMemo(() => answerItem(previewState, previewQuery), [previewQuery, previewState]);
  const previousSnapshot = versions[0]?.snapshot ?? null;
  const differences = useMemo(() => summarizeProtocolChange(previousSnapshot, draft), [previousSnapshot, draft]);
  const enabledItems = draft.items.filter((item) => item.enabled);
  const returnItems = enabledItems.filter((item) => !item.baselineAvailable && item.returnDay !== null).sort((a, b) => (a.returnDay ?? 0) - (b.returnDay ?? 0) || a.ordinal - b.ordinal);

  function patchDraft(patch: Partial<ProtocolDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setHasUnpublishedChanges(currentVersion > 0);
    setSavedMessage(null);
  }

  function patchItem(index: number, patch: Partial<ProtocolDraftItem>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)
    }));
    setHasUnpublishedChanges(currentVersion > 0);
    setSavedMessage(null);
  }

  function addItem() {
    const ordinal = draft.items.filter((item) => item.enabled).length;
    const next: ProtocolDraftItem = {
      canonicalName: "New protocol item",
      itemKey: `new-item-${draft.items.length + 1}`,
      kind: "product",
      category: "skincare",
      inventoryGroup: "routine",
      clientExplanation: "Provider-authored guidance for this item.",
      providerNote: "",
      baselineAvailable: false,
      returnDay: Math.min(draft.recoveryDurationDays, Math.max(1, ordinal)),
      aliases: [],
      ordinal,
      enabled: true
    };
    patchDraft({ items: [...draft.items, next] });
    requestAnimationFrame(() => itemListRef.current?.lastElementChild?.querySelector<HTMLElement>("input")?.focus());
  }

  function removeItem(index: number) {
    const items = draft.items
      .filter((_, itemIndex) => itemIndex !== index)
      .map((item, ordinal) => ({ ...item, ordinal }));
    patchDraft({ items });
    requestAnimationFrame(() => itemListRef.current?.querySelector<HTMLElement>("input")?.focus());
  }

  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= draft.items.length) return;
    const items = [...draft.items];
    [items[index], items[target]] = [items[target], items[index]];
    patchDraft({ items: items.map((item, ordinal) => ({ ...item, ordinal })) });
  }

  async function saveDraft(): Promise<string | null> {
    setBusy(true);
    setError(null);
    setIssues([]);
    const method = savedId ? "PUT" : "POST";
    const endpoint = savedId ? `/api/provider/protocols/${savedId}` : "/api/provider/protocols";
    const response = await fetch(endpoint, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft)
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "Protocol draft could not be saved.");
      setIssues(Array.isArray(body.issues) ? body.issues.map((issue: { message?: string }) => issue.message ?? "Review this field.") : []);
      setBusy(false);
      requestAnimationFrame(() => validationRef.current?.focus());
      return null;
    }
    const id = String(body.id);
    setSavedId(id);
    setDraft((current) => ({ ...current, id }));
    setSavedMessage("Draft saved. The working edition will survive refresh.");
    setBusy(false);
    if (!savedId) router.replace(`/protocols/${id}`);
    router.refresh();
    return id;
  }

  function beginPublishReview() {
    const validation = validateProtocolForPublish(draft);
    if (!validation.success) {
      setError("Resolve the protocol validation before publication.");
      setIssues(validation.error.issues.map((issue) => issue.message));
      requestAnimationFrame(() => validationRef.current?.focus());
      return;
    }
    setError(null);
    setIssues([]);
    setMode("publish");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function publish() {
    const id = await saveDraft();
    if (!id) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/provider/protocols/${id}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ changeSummary })
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "Protocol could not be published.");
      setIssues(Array.isArray(body.issues) ? body.issues.map((issue: { message?: string }) => issue.message ?? "Review this field.") : []);
      setBusy(false);
      requestAnimationFrame(() => validationRef.current?.focus());
      return;
    }
    const version = Number(body.version);
    setCurrentVersion(version);
    setStatus("published");
    setHasUnpublishedChanges(false);
    setVersions((current) => [{
      id: String(body.id),
      version,
      snapshot: body.snapshot,
      changeSummary: changeSummary || (version === 1 ? "Initial publication" : "Provider-authored revision"),
      itemCount: enabledItems.length,
      publishedAt: new Date().toISOString(),
      passCount: 0
    }, ...current]);
    setMode("published");
    setBusy(false);
    router.refresh();
  }

  async function archive() {
    if (!savedId) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/provider/protocols/${savedId}/archive`, { method: "POST" });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "Protocol could not be archived.");
      setBusy(false);
      return;
    }
    setStatus("archived");
    setMode("archived");
    setBusy(false);
    router.refresh();
  }

  if (mode === "archived") {
    return (
      <section className="protocol-terminal">
        <p className="meta">ARCHIVED TECHNICAL RECORD</p>
        <h1 className="workspace-title">{draft.protocolName}</h1>
        <p className="workspace-support">New issuance is closed. Published editions and every historical Skin Pass remain intact.</p>
        <div className="protocol-proof-grid">
          <div><span>Published editions</span><strong>{versions.length}</strong></div>
          <div><span>Latest fixed edition</span><strong>{currentVersion || "—"}</strong></div>
          <div><span>Lifecycle</span><strong>Archived</strong></div>
        </div>
        <div className="stack" style={{ maxWidth: 420, marginTop: 32 }}><Action href="/protocols">Return to protocol library</Action><Action variant="secondary" onClick={() => setMode("history")}>Inspect version history</Action></div>
      </section>
    );
  }

  if (mode === "history") {
    return (
      <section className="protocol-history-view">
        <StudioHeader draft={draft} status={status} version={currentVersion} onMode={setMode} />
        <div className="provider-page-head compact">
          <div><p className="section-label">Immutable technical record</p><h1 className="workspace-title">Version history</h1><p className="workspace-support">Published editions can be previewed and referenced. They cannot be rewritten in place.</p></div>
        </div>
        <div className="version-ledger">
          {versions.map((version) => (
            <article key={version.id} className="version-record">
              <div><p className="meta">EDITION {String(version.version).padStart(2, "0")}</p><h2>{version.changeSummary}</h2><p>{new Date(version.publishedAt).toLocaleString()}</p></div>
              <dl><div><dt>Items</dt><dd>{version.itemCount}</dd></div><div><dt>Issued passes</dt><dd>{version.passCount ?? 0}</dd></div><div><dt>Mutability</dt><dd>Fixed</dd></div></dl>
              <button className="text-action" type="button" onClick={() => { setPreviewDay(2); setMode("preview"); }}>Preview current machine output →</button>
            </article>
          ))}
          {!versions.length && <div className="protocol-empty"><p className="meta">NO FIXED EDITIONS</p><h2>Publish version 1 to start the record.</h2></div>}
        </div>
      </section>
    );
  }

  if (mode === "published") {
    return (
      <section className="protocol-terminal">
        <p className="meta">PUBLICATION COMPLETE · EDITION {String(currentVersion).padStart(2, "0")}</p>
        <h1 className="workspace-title">The protocol is fixed.</h1>
        <p className="workspace-support">New Skin Passes can now receive this immutable edition. Existing passes will never be silently rewritten.</p>
        <div className="protocol-proof-grid">
          <div><span>Protocol</span><strong>{draft.protocolName}</strong></div>
          <div><span>Items</span><strong>{enabledItems.length}</strong></div>
          <div><span>Recovery window</span><strong>{draft.recoveryDurationDays} days</strong></div>
        </div>
        <div className="stack" style={{ maxWidth: 460, marginTop: 32 }}>
          <Action href={`/issue?template=${savedId}`}>Issue from edition {currentVersion}</Action>
          <Action variant="secondary" onClick={() => setMode("edit")}>Return to working draft</Action>
          <Action variant="quiet" onClick={() => setMode("history")}>Open version history</Action>
        </div>
      </section>
    );
  }

  if (mode === "archive") {
    return (
      <section className="protocol-terminal danger-zone">
        <p className="meta">LIFECYCLE CONFIRMATION</p>
        <h1 className="workspace-title">Archive {draft.protocolName}?</h1>
        <p className="workspace-support">This closes new issuance. Published editions and every existing Skin Pass remain readable and unchanged.</p>
        <div className="disclosure"><h3>What remains</h3><p>Historical versions remain fixed.<br />Existing client links keep working.<br />Provider records remain visible.<br />No protocol data is deleted.</p></div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="stack" style={{ maxWidth: 460, marginTop: 28 }}><Action variant="danger" onClick={archive} disabled={busy}>{busy ? "Archiving…" : "Confirm archive"}</Action><Action variant="secondary" onClick={() => setMode("edit")}>Cancel</Action></div>
      </section>
    );
  }

  if (mode === "publish") {
    return (
      <section>
        <StudioHeader draft={draft} status={status} version={currentVersion} onMode={setMode} />
        <div className="provider-page-head compact"><div><p className="section-label">Fix a stable edition</p><h1 className="workspace-title">Publication review</h1><p className="workspace-support">This action creates an immutable template version. Later edits become a different edition.</p></div></div>
        <div className="publish-review-grid">
          <section className="publication-sheet">
            <p className="meta">{currentVersion ? `EDITION ${String(currentVersion + 1).padStart(2, "0")}` : "INITIAL EDITION"}</p>
            <h2>{draft.protocolName}</h2>
            <p>{draft.treatmentLabel} · {draft.recoveryDurationDays} days · {draft.protocolTimeZone}</p>
            <dl>
              <div><dt>Enabled items</dt><dd>{enabledItems.length}</dd></div>
              <div><dt>Return events</dt><dd>{returnItems.length}</dd></div>
              <div><dt>Lookup aliases</dt><dd>{enabledItems.reduce((sum, item) => sum + item.aliases.length, 0)}</dd></div>
              <div><dt>Routine restored</dt><dd>Day {draft.recoveryDurationDays}</dd></div>
            </dl>
            <div className="field"><label htmlFor="change-summary">Publication note</label><textarea id="change-summary" value={changeSummary} onChange={(event) => setChangeSummary(event.target.value)} placeholder={currentVersion ? "What changed in this edition?" : "Initial publication"} /></div>
          </section>
          <section className="publication-diff">
            <p className="meta">VERSION DIFFERENCE</p>
            <ul>{differences.map((difference) => <li key={difference}>{difference}</li>)}</ul>
            <p className="section-label">Return timeline</p>
            <ol>{returnItems.map((item) => <li key={item.itemKey}><span>Day {item.returnDay}</span>{item.canonicalName}</li>)}</ol>
            <p className="section-label">Client guidance</p>
            <p>{draft.providerGuidance}</p>
          </section>
        </div>
        <ValidationSummary error={error} issues={issues} validationRef={validationRef} />
        <div className="publish-actions"><Action onClick={publish} disabled={busy}>{busy ? "Publishing edition…" : `Publish edition ${currentVersion + 1}`}</Action><Action variant="secondary" onClick={() => setMode("edit")}>Back to editor</Action></div>
      </section>
    );
  }

  return (
    <section>
      <StudioHeader draft={draft} status={status} version={currentVersion} onMode={setMode} />
      <div className="provider-page-head compact">
        <div>
          <p className="section-label">The provider authors the rules</p>
          <h1 className="workspace-title">{mode === "preview" ? "Client machine preview" : draft.protocolName || "Untitled protocol"}</h1>
          <p className="workspace-support">{mode === "preview" ? "The real Skin Pass engine is running against unsaved draft data." : "Build the identity, item vocabulary, and Re-entry Rail before fixing an edition."}</p>
        </div>
        <div className="studio-mode-switch" role="group" aria-label="Protocol Studio mode"><button type="button" aria-pressed={mode === "edit"} onClick={() => setMode("edit")}>Author</button><button type="button" aria-pressed={mode === "preview"} onClick={() => setMode("preview")}>Preview</button></div>
      </div>

      <ValidationSummary error={error} issues={issues} validationRef={validationRef} />
      {savedMessage && <div className="notice" role="status">{savedMessage}</div>}

      {mode === "preview" ? (
        <PreviewPanel draft={draft} previewDay={previewDay} setPreviewDay={setPreviewDay} previewQuery={previewQuery} setPreviewQuery={setPreviewQuery} previewState={previewState} previewSource={previewSource} previewAnswer={previewAnswer} />
      ) : (
        <div className="studio-layout">
          <div className="studio-author-column">
            <ProtocolIdentity draft={draft} patchDraft={patchDraft} />
            <section className="studio-section">
              <div className="studio-section-head"><div><p className="meta">02 · PROTOCOL ITEMS</p><h2>Define the vocabulary.</h2></div><button className="text-action" type="button" onClick={addItem}>Add item +</button></div>
              <p className="workspace-support">Canonical names and aliases are the only vocabulary the client answer engine may recognize.</p>
              <div className="protocol-item-list" ref={itemListRef}>
                {draft.items.map((item, index) => <ProtocolItemEditor key={`${item.itemKey}-${index}`} item={item} index={index} total={draft.items.length} duration={draft.recoveryDurationDays} patchItem={patchItem} removeItem={removeItem} moveItem={moveItem} />)}
              </div>
            </section>
          </div>
          <aside className="studio-machine-column">
            <section className="studio-section sticky-instrument">
              <p className="meta">03 · RE-ENTRY RAIL</p>
              <h2>Place each return in time.</h2>
              <p className="workspace-support">Every control remains keyboard-operable. Moving an item changes the real preview engine.</p>
              <div className="studio-rail" aria-label="Editable return timeline">
                <div className="studio-rail-axis"><span>Day 0</span><span>Day {draft.recoveryDurationDays}</span></div>
                {enabledItems.map((item) => {
                  const sourceIndex = draft.items.findIndex((candidate) => candidate === item);
                  const position = item.baselineAvailable ? 0 : Math.min(100, ((item.returnDay ?? 0) / draft.recoveryDurationDays) * 100);
                  return <div className="studio-rail-row" key={item.itemKey}><div className="studio-rail-track"><div className="studio-rail-position" style={{ left: `${position}%` }} data-current={item.baselineAvailable ? "true" : "false"} /></div><label><span>{item.canonicalName}</span><select value={item.baselineAvailable ? "available" : String(item.returnDay ?? 1)} onChange={(event) => event.target.value === "available" ? patchItem(sourceIndex, { baselineAvailable: true, returnDay: null }) : patchItem(sourceIndex, { baselineAvailable: false, returnDay: Number(event.target.value) })}><option value="available">Available now</option>{Array.from({ length: draft.recoveryDurationDays }, (_, day) => <option value={day + 1} key={day + 1}>Day {day + 1}</option>)}</select></label></div>;
                })}
              </div>
              <div className="rail-restored-boundary"><span>Routine restored</span><strong>Day {draft.recoveryDurationDays}</strong></div>
              <Action variant="secondary" onClick={() => setMode("preview")}>Run client preview</Action>
            </section>
          </aside>
        </div>
      )}

      <footer className="studio-footer">
        <div><span className="meta">WORKING STATE</span><p>{status === "draft" ? "Unpublished draft" : hasUnpublishedChanges ? `Edition ${currentVersion} fixed · draft changes pending` : `Edition ${currentVersion} fixed`}</p></div>
        <div className="studio-footer-actions"><Action variant="secondary" onClick={saveDraft} disabled={busy}>{busy ? "Saving…" : "Save draft"}</Action><Action onClick={beginPublishReview}>Review publication</Action></div>
      </footer>
    </section>
  );
}

function StudioHeader({ draft, status, version, onMode }: { draft: ProtocolDraft; status: ProtocolTemplateStatus; version: number; onMode: (mode: Mode) => void }) {
  return <div className="studio-context"><div><span className="meta">PROTOCOL STUDIO</span><span>{draft.treatmentLabel || "Client label pending"}</span></div><div className="studio-context-actions"><span className="protocol-status" data-status={status}>{status}{version ? ` · V${version}` : ""}</span><button type="button" onClick={() => onMode("history")}>Version history</button>{status !== "archived" && version > 0 && <button type="button" onClick={() => onMode("archive")}>Archive</button>}</div></div>;
}

function ValidationSummary({ error, issues, validationRef }: { error: string | null; issues: string[]; validationRef: React.RefObject<HTMLDivElement | null> }) {
  if (!error && !issues.length) return null;
  return <div className="validation-summary" role="alert" tabIndex={-1} ref={validationRef} aria-labelledby="validation-title"><p className="meta" id="validation-title">VALIDATION NEEDS ATTENTION</p>{error && <strong>{error}</strong>}{issues.length > 0 && <ul>{[...new Set(issues)].map((issue) => <li key={issue}>{issue}</li>)}</ul>}</div>;
}

function ProtocolIdentity({ draft, patchDraft }: { draft: ProtocolDraft; patchDraft: (patch: Partial<ProtocolDraft>) => void }) {
  return <section className="studio-section"><p className="meta">01 · PROTOCOL IDENTITY</p><h2>Name the instrument.</h2><div className="field-grid"><div className="field"><label htmlFor="protocol-name">Internal protocol name</label><input id="protocol-name" value={draft.protocolName} onChange={(event) => patchDraft({ protocolName: event.target.value })} /></div><div className="field"><label htmlFor="treatment-label">Client-facing treatment label</label><input id="treatment-label" value={draft.treatmentLabel} onChange={(event) => patchDraft({ treatmentLabel: event.target.value })} /></div><div className="field field-wide"><label htmlFor="internal-description">Internal description</label><textarea id="internal-description" value={draft.internalDescription} onChange={(event) => patchDraft({ internalDescription: event.target.value })} /></div><div className="field"><label htmlFor="duration">Recovery duration</label><input id="duration" type="number" min={1} max={180} value={draft.recoveryDurationDays} onChange={(event) => patchDraft({ recoveryDurationDays: Math.max(1, Number(event.target.value) || 1) })} /><small>Routine-restored boundary in days</small></div><div className="field"><label htmlFor="timezone">Protocol timezone</label><input id="timezone" value={draft.protocolTimeZone} onChange={(event) => patchDraft({ protocolTimeZone: event.target.value })} /><small>IANA timezone, such as America/Los_Angeles</small></div><div className="field field-wide"><label htmlFor="guidance">Provider-authored general guidance</label><textarea id="guidance" value={draft.providerGuidance} onChange={(event) => patchDraft({ providerGuidance: event.target.value })} /></div><div className="field field-wide"><label htmlFor="restored-message">Routine-restored message</label><textarea id="restored-message" value={draft.routineRestoredMessage} onChange={(event) => patchDraft({ routineRestoredMessage: event.target.value })} /></div></div></section>;
}

function ProtocolItemEditor({ item, index, total, duration, patchItem, removeItem, moveItem }: { item: ProtocolDraftItem; index: number; total: number; duration: number; patchItem: (index: number, patch: Partial<ProtocolDraftItem>) => void; removeItem: (index: number) => void; moveItem: (index: number, direction: -1 | 1) => void }) {
  const aliasValue = item.aliases.join(", ");
  return <fieldset className="protocol-item-editor"><legend>Item {String(index + 1).padStart(2, "0")} · {item.canonicalName}</legend><div className="protocol-item-toolbar"><span className="meta">ORDER {String(index).padStart(2, "0")}</span><div><button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0} aria-label={`Move ${item.canonicalName} earlier`}>↑</button><button type="button" onClick={() => moveItem(index, 1)} disabled={index === total - 1} aria-label={`Move ${item.canonicalName} later`}>↓</button><button type="button" onClick={() => removeItem(index)} aria-label={`Remove ${item.canonicalName}`}>Remove</button></div></div><div className="field-grid"><div className="field"><label htmlFor={`canonical-${index}`}>Canonical display name</label><input id={`canonical-${index}`} value={item.canonicalName} onChange={(event) => patchItem(index, { canonicalName: event.target.value, itemKey: item.itemKey.startsWith("new-item-") ? normalizeProtocolTerm(event.target.value).replaceAll(" ", "-") : item.itemKey })} /></div><div className="field"><label htmlFor={`key-${index}`}>Stable item key</label><input id={`key-${index}`} value={item.itemKey} onChange={(event) => patchItem(index, { itemKey: event.target.value })} /></div><div className="field"><label htmlFor={`kind-${index}`}>Item type</label><select id={`kind-${index}`} value={item.kind} onChange={(event) => patchItem(index, { kind: event.target.value as ProtocolDraftItem["kind"], inventoryGroup: event.target.value === "activity" ? "activity" : "routine" })}><option value="product">Product or ingredient</option><option value="activity">Activity</option></select></div><div className="field"><label htmlFor={`category-${index}`}>Category</label><input id={`category-${index}`} value={item.category} onChange={(event) => patchItem(index, { category: event.target.value })} /></div><div className="field"><label htmlFor={`state-${index}`}>Treatment-time state</label><select id={`state-${index}`} value={item.baselineAvailable ? "available" : "held"} onChange={(event) => patchItem(index, event.target.value === "available" ? { baselineAvailable: true, returnDay: null } : { baselineAvailable: false, returnDay: item.returnDay ?? Math.min(duration, 1) })}><option value="available">Available immediately</option><option value="held">Held until later</option></select></div><div className="field"><label htmlFor={`return-${index}`}>Return day</label><select id={`return-${index}`} disabled={item.baselineAvailable} value={item.returnDay ?? 1} onChange={(event) => patchItem(index, { returnDay: Number(event.target.value) })}>{Array.from({ length: duration }, (_, day) => <option key={day + 1} value={day + 1}>Day {day + 1}</option>)}</select></div><div className="field field-wide"><label htmlFor={`aliases-${index}`}>Client lookup aliases</label><input id={`aliases-${index}`} value={aliasValue} onChange={(event) => patchItem(index, { aliases: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /><small>Comma-separated. Ambiguous terms are rejected before publication.</small></div><div className="field field-wide"><label htmlFor={`explanation-${index}`}>Client-facing explanation</label><textarea id={`explanation-${index}`} value={item.clientExplanation} onChange={(event) => patchItem(index, { clientExplanation: event.target.value })} /></div><div className="field field-wide"><label htmlFor={`note-${index}`}>Provider note</label><textarea id={`note-${index}`} value={item.providerNote} onChange={(event) => patchItem(index, { providerNote: event.target.value })} /></div></div></fieldset>;
}

function PreviewPanel({ draft, previewDay, setPreviewDay, previewQuery, setPreviewQuery, previewState, previewSource, previewAnswer }: { draft: ProtocolDraft; previewDay: number; setPreviewDay: (day: number) => void; previewQuery: string; setPreviewQuery: (query: string) => void; previewState: ReturnType<typeof derivePassState>; previewSource: ReturnType<typeof makeProtocolPreviewSource>; previewAnswer: ReturnType<typeof answerItem> }) {
  const answerLabel = previewAnswer.outcome === "AVAILABLE" ? "Available now" : previewAnswer.outcome === "QUEUED" ? "Returns next" : previewAnswer.outcome === "HELD" ? "Held for later" : previewAnswer.outcome === "PROVIDER_ONLY" ? "Contact provider" : "Not listed";
  return <div className="preview-layout"><section className="preview-controls"><p className="meta">REAL CLIENT ENGINE</p><h2>Move through recovery.</h2><div className="field"><label htmlFor="preview-day">Preview recovery day</label><input id="preview-day" type="range" min={0} max={draft.recoveryDurationDays + 1} value={previewDay} onChange={(event) => setPreviewDay(Number(event.target.value))} /><output htmlFor="preview-day">Day {previewDay}</output></div><div className="preview-presets" role="group" aria-label="Preview states"><button type="button" onClick={() => setPreviewDay(0)}>Day 0</button><button type="button" onClick={() => setPreviewDay(2)}>Day 2</button>{draft.items.filter((item) => item.returnDay !== null).slice(0, 2).map((item) => <button type="button" key={item.itemKey} onClick={() => setPreviewDay(item.returnDay ?? 0)}>After {item.canonicalName}</button>)}<button type="button" onClick={() => setPreviewDay(draft.recoveryDurationDays)}>Routine restored</button></div><div className="field" style={{ marginTop: 28 }}><label htmlFor="preview-query">Test client lookup</label><input id="preview-query" value={previewQuery} onChange={(event) => setPreviewQuery(event.target.value)} placeholder="retinol" /></div><div className="preview-answer" data-outcome={previewAnswer.outcome}><span className="meta">{previewAnswer.outcome}</span><strong>{answerLabel}</strong><p>{previewAnswer.item?.clientExplanation ?? (previewAnswer.outcome === "PROVIDER_ONLY" ? "Symptom language remains outside protocol classification." : "The engine will not guess beyond the authored vocabulary.")}</p></div></section><section className="client-preview-device" aria-label="Client Skin Pass preview"><div className="brand-row"><span className="brand">RE:ENTRY</span><span className="meta">PREVIEW</span></div><div className="row" style={{ marginTop: 22 }}><div><p className="meta">{previewState.treatmentName}</p><p className="meta" style={{ marginTop: 8 }}>SIMULATED PASS</p></div><div style={{ textAlign: "right" }}><p className="meta">Recovery</p><p className="meta" style={{ marginTop: 8 }}>DAY {String(previewState.recoveryDay).padStart(2, "0")} / {String(previewState.recoveryDurationDays).padStart(2, "0")}</p></div></div><p className="section-label">Routine state</p><h2 className="page-title small" style={{ marginTop: 0 }}>{previewState.routineState}</h2><p className="support">{previewState.availableRoutine.length} available · {previewState.heldRoutine.length} held</p><div className="skin-pass-stack"><SkinPassArtifact event={previewState.activeEvent} serverNow={previewState.serverNow} totalEvents={previewSource.events?.length ?? 0} routineState={previewState.routineState} recoveryDurationDays={previewState.recoveryDurationDays} routineRestoredMessage={previewState.routineRestoredMessage} /></div><ReentryRail state={previewState} /><div className="preview-inventory"><div><span>AVAILABLE NOW</span><strong>{previewState.availableRoutine.map((item) => item.label).join(" · ") || "None"}</strong></div><div><span>TEMPORARILY HELD</span><strong>{previewState.heldRoutine.map((item) => item.label).join(" · ") || "None"}</strong></div></div></section></div>;
}
