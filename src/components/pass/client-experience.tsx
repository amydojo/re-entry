"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnswerOutcome, DerivedPassState, PassSnapshotSource } from "@/lib/domain/types";
import { answerItem, derivePassState, formatProtocolDate, relativeReturnCopy } from "@/lib/domain/time-engine";
import { SkinPassArtifact } from "./skin-pass-artifact";
import { ReentryRail } from "./reentry-rail";
import { Action } from "@/components/ui/action";

type Dialog =
  | { type: "check" }
  | { type: "answer"; outcome: AnswerOutcome; query: string }
  | { type: "inventory"; inventory: "available" | "held" }
  | { type: "guidance" }
  | null;

const safetyCopy = "Pain, reactions, worsening symptoms, or unexpected recovery are not answered here. Contact the provider directly.";

export function ClientExperience({ initialSource, publicId, token }: {
  initialSource: PassSnapshotSource;
  publicId: string;
  token: string;
}) {
  const [source, setSource] = useState(initialSource);
  const state = useMemo(() => derivePassState(source), [source]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [query, setQuery] = useState("");
  const [firstOpen, setFirstOpen] = useState(true);
  const [offline, setOffline] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [justCompleted, setJustCompleted] = useState<string | null>(null);
  const storageKey = `reentry:${publicId}`;

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(initialSource));
    const sync = () => setOffline(!navigator.onLine);
    const hydrationTimer = window.setTimeout(() => {
      setFirstOpen(localStorage.getItem(`${storageKey}:opened`) !== "1");
      sync();
    }, 0);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.clearTimeout(hydrationTimer);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [initialSource, storageKey]);

  function openPass() {
    localStorage.setItem(`${storageKey}:opened`, "1");
    setFirstOpen(false);
  }

  async function verify() {
    if (!navigator.onLine) { setOffline(true); return; }
    const previousActive = state.activeEvent;
    const response = await fetch("/api/pass/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ publicId, token })
    });
    if (!response.ok) return;
    const next = await response.json() as PassSnapshotSource;
    const nextState = derivePassState(next);
    if (previousActive && nextState.activeEvent?.id !== previousActive.id) {
      setJustCompleted(previousActive.itemLabel);
      setTransitioning(true);
      window.setTimeout(() => setJustCompleted(null), 1800);
      window.setTimeout(() => setTransitioning(false), 1280);
    }
    setSource(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function submitCheck(event: React.FormEvent) {
    event.preventDefault();
    const result = answerItem(state, query);
    setDialog({ type: "answer", outcome: result.outcome, query });
  }

  if (state.access !== "active") {
    const title = state.access === "revoked" ? "This Skin Pass was revoked." : state.access === "expired" ? "This Skin Pass has expired." : "This Skin Pass cannot be opened.";
    return <AccessBoundary title={title} publicId={state.publicId ?? publicId} />;
  }

  if (firstOpen) {
    return (
      <div className="access-state">
        <p className="meta">ISSUED SKIN PASS · {state.publicId}</p>
        <h1 className="page-title">Your routine will return in stages.</h1>
        <p className="support">This permanent pass shows only what {state.providerName ?? "your provider"} defined. No account is required.</p>
        <SkinPassArtifact
          event={state.activeEvent}
          serverNow={state.serverNow}
          totalEvents={source.events?.length ?? 0}
          routineState={state.routineState}
          recoveryDurationDays={state.recoveryDurationDays}
          routineRestoredMessage={state.routineRestoredMessage}
        />
        <Action onClick={openPass}>Open Skin Pass</Action>
      </div>
    );
  }

  const active = state.activeEvent;
  const following = state.followingEvent;
  const update = state.updatedByProvider;

  return (
    <div data-transitioning={transitioning}>
      <div className="brand-row"><span className="brand">RE:ENTRY</span><span className="meta">{state.publicId}</span></div>
      {offline && <div className="notice" role="status" style={{ marginTop: 18 }}><strong>Offline · last verified state</strong><br />Frozen at {new Date(state.lastVerifiedAt).toLocaleString()}. Time will not advance until verified online.</div>}
      {justCompleted && <div className="notice" role="status" style={{ marginTop: 18 }}>{justCompleted} returned to routine. The rail and active event advanced together.</div>}
      {update && <div className="notice" role="status" style={{ marginTop: 18 }}>Provider updated {update.changedItemLabel ?? "the protocol"}. Version {update.version} is now active.</div>}

      <div className="row" style={{ marginTop: 24 }}>
        <div><p className="meta">{state.treatmentName}</p><p className="meta" style={{ marginTop: 8 }}>{state.treatmentDate?.toUpperCase()}</p></div>
        <div style={{ textAlign: "right" }}><p className="meta">Recovery</p><p className="meta" style={{ marginTop: 8 }}>DAY {String(state.recoveryDay).padStart(2, "0")} / {String(state.recoveryDurationDays).padStart(2, "0")}</p></div>
      </div>
      <p className="section-label">Routine state</p>
      <div className="row"><h1 className="page-title small" style={{ margin: 0 }}>{state.routineState}</h1>{state.routineState === "Re-entry in progress" && <span aria-label="Live protocol position" style={{ width: 8, height: 8, borderRadius: 8, background: "var(--re-color-signal-current)" }} />}</div>
      <p className="support" style={{ marginTop: 6 }}>{state.availableRoutine.length} items available now. {state.heldRoutine.length} remain held.</p>

      <div className="skin-pass-stack">
        {following && <div className="future-tab"><div><small>Following</small>{following.itemLabel} · {formatProtocolDate(following.returnAt)}</div><span>→</span></div>}
        <SkinPassArtifact
          event={active}
          serverNow={state.serverNow}
          totalEvents={source.events?.length ?? 0}
          routineState={state.routineState}
          recoveryDurationDays={state.recoveryDurationDays}
          routineRestoredMessage={state.routineRestoredMessage}
        />
      </div>
      <ReentryRail state={state} />

      <div style={{ marginTop: 18 }}>
        <button className="inventory-row" onClick={() => setDialog({ type: "inventory", inventory: "available" })}><span>AVAILABLE NOW</span><span className="inventory-value">{state.availableRoutine.length}<b>›</b></span></button>
        <button className="inventory-row" onClick={() => setDialog({ type: "inventory", inventory: "held" })}><span>TEMPORARILY HELD</span><span className="inventory-value">{state.heldRoutine.length}<b>›</b></span></button>
      </div>
      <button className="next-action" onClick={() => setDialog({ type: "check" })} style={{ marginTop: 24 }}><span><small>Next valid action</small><strong>Check a product or activity</strong></span><span className="action-arrow">→</span></button>
      <button className="action quiet" onClick={() => setDialog({ type: "guidance" })} style={{ marginTop: 14 }}>PROVIDER GUIDANCE <span className="action-arrow">→</span></button>
      <button className="action secondary" onClick={verify} style={{ marginTop: 12 }}>Verify current state <span className="action-arrow">↻</span></button>
      <p className="meta secondary" style={{ marginTop: 28, lineHeight: "16px" }}>ISSUED BY {state.providerName} · TEMPLATE {state.templateVersion ?? "LEGACY"} · PASS {String(state.protocolVersion).padStart(2, "0")}<br />Time is part of the protocol.</p>

      {dialog && <Modal onClose={() => setDialog(null)}>
        {dialog.type === "check" && <form onSubmit={submitCheck}>
          <p className="meta">CHECK AN ITEM</p><h2>What are you thinking about using or doing?</h2>
          <p className="support">The answer comes only from this issued Skin Pass.</p>
          <div className="field" style={{ marginTop: 24 }}><label htmlFor="item-query">Product or activity</label><input id="item-query" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Retinoid" /></div>
          <div className="dialog-actions"><Action type="submit">Check this item</Action><Action variant="secondary" onClick={() => setDialog(null)}>Cancel</Action></div>
        </form>}
        {dialog.type === "answer" && <AnswerView state={state} query={dialog.query} outcome={dialog.outcome} onClose={() => setDialog(null)} />}
        {dialog.type === "inventory" && <InventoryView state={state} inventory={dialog.inventory} onClose={() => setDialog(null)} />}
        {dialog.type === "guidance" && <GuidanceView state={state} onClose={() => setDialog(null)} />}
      </Modal>}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="dialog" role="dialog" aria-modal="true">{children}</section></div>;
}

function AnswerView({ state, query, outcome, onClose }: { state: DerivedPassState; query: string; outcome: AnswerOutcome; onClose: () => void }) {
  const item = answerItem(state, query).item;
  const authoredCopy = item?.clientExplanation || "It is part of the current provider-authored routine.";
  const config = outcome === "AVAILABLE"
    ? { eyebrow: "AVAILABLE NOW", title: `${item?.label ?? query} is available now.`, copy: authoredCopy }
    : outcome === "QUEUED"
      ? { eyebrow: "RETURNS NEXT", title: `${item?.label ?? query} returns next.`, copy: item?.returnAt ? `${relativeReturnCopy(item.returnAt, state.serverNow)} · ${formatProtocolDate(item.returnAt)}. ${item.clientExplanation ?? ""}`.trim() : "It is the next scheduled return event." }
      : outcome === "HELD"
        ? { eyebrow: "NOT YET", title: `${item?.label ?? query} remains held.`, copy: item?.returnAt ? `${relativeReturnCopy(item.returnAt, state.serverNow)} · ${formatProtocolDate(item.returnAt)}. ${item.clientExplanation ?? ""}`.trim() : "The provider included it but has not made it available yet." }
        : outcome === "PROVIDER_ONLY"
          ? { eyebrow: "CONTACT PROVIDER", title: "This question cannot be answered by RE:ENTRY.", copy: safetyCopy }
          : { eyebrow: "NOT LISTED", title: `${query || "That item"} is not in this Skin Pass.`, copy: "RE:ENTRY will not infer timing or use general skincare guidance. Ask the provider." };
  return <><p className="meta">{config.eyebrow}</p><div className="answer-card" style={{ marginTop: 18 }}><h2>{config.title}</h2><p>{config.copy}</p></div><div className="disclosure" style={{ marginTop: 20 }}><h3>Why this answer</h3><p>It was derived only from pass protocol version {state.protocolVersion}, verified at {new Date(state.lastVerifiedAt).toLocaleString()}.</p></div><div className="dialog-actions"><ProviderContact state={state} /><Action variant="secondary" onClick={onClose}>Back to pass</Action></div></>;
}

function InventoryView({ state, inventory, onClose }: { state: DerivedPassState; inventory: "available" | "held"; onClose: () => void }) {
  const items = inventory === "available" ? state.availableRoutine : state.heldRoutine;
  return <><p className="meta">{inventory === "available" ? "AVAILABLE NOW" : "TEMPORARILY HELD"}</p><h2>{inventory === "available" ? "Current routine inventory" : "Staged for later"}</h2><div className="stack" style={{ marginTop: 20 }}>{items.map((item) => <div className="choice selected" key={item.id}><div><strong>{item.label}</strong><span>{item.returnAt && inventory === "held" ? relativeReturnCopy(item.returnAt, state.serverNow) : item.clientExplanation || "Provider-defined"}</span></div><span className="choice-status">{item.state === "queued" ? "RETURNS NEXT" : inventory === "available" ? "AVAILABLE" : "HELD"}</span></div>)}</div><div className="dialog-actions"><Action variant="secondary" onClick={onClose}>Back to pass</Action></div></>;
}

function GuidanceView({ state, onClose }: { state: DerivedPassState; onClose: () => void }) {
  return <><p className="meta">PROVIDER GUIDANCE</p><h2>{state.providerName}</h2><p className="support">{state.providerGuidance}</p><div className="disclosure" style={{ marginTop: 24 }}><h3>Protocol boundary</h3><p>RE:ENTRY does not diagnose, interpret symptoms, or fill missing protocol items. {safetyCopy}</p></div><div className="dialog-actions"><ProviderContact state={state} /><Action variant="secondary" onClick={onClose}>Back to pass</Action></div></>;
}

function ProviderContact({ state }: { state: DerivedPassState }) {
  return state.providerPhone ? <Action href={`sms:${state.providerPhone}`}>Text provider</Action> : <Action variant="secondary" disabled>Provider contact unavailable</Action>;
}

function AccessBoundary({ title, publicId }: { title: string; publicId: string }) {
  return <div className="access-state"><p className="meta">ACCESS STATE · {publicId}</p><h1 className="page-title">{title}</h1><p className="support">No current protocol details are shown. Contact the issuing provider for the next valid step.</p><Action href="/" variant="secondary">Return to RE:ENTRY</Action></div>;
}
