import Link from "next/link";

export function ContextHeader({ title, meta, backHref }: { title: string; meta?: string; backHref: string }) {
  return (
    <header className="context-header">
      <Link href={backHref} aria-label="Go back">←</Link>
      <div className="context-title">{title}</div>
      <div className="meta secondary">{meta}</div>
    </header>
  );
}
