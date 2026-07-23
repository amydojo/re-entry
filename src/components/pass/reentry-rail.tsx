import type { DerivedPassState } from "@/lib/domain/types";

export function ReentryRail({ state }: { state: DerivedPassState }) {
  const eventItems = state.items.filter((item) => item.returnAt);
  const total = Math.max(eventItems.length, 1);
  return (
    <section className="rail" aria-label="Re-entry rail">
      <div className="rail-labels"><span>Held</span><span>Queued</span><span>Returned</span></div>
      <div className="rail-track">
        <div className="rail-line" />
        {eventItems.map((item, index) => {
          const position = 14 + (index * 72) / Math.max(total - 1, 1);
          const current = state.activeEvent?.itemId === item.id;
          return (
            <div key={item.id} className={`rail-token ${current ? "current" : ""}`} style={{ left: `${position}%` }}>
              <span>{item.label.replace("Exfoliating ", "")}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
