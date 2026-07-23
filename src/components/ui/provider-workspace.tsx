import Link from "next/link";

export function ProviderWorkspace({ children, section = "PROTOCOL STUDIO" }: { children: React.ReactNode; section?: string }) {
  return (
    <main className="provider-stage">
      <section className="provider-shell" aria-label="RE:ENTRY provider workspace">
        <header className="provider-nav">
          <Link href="/desk" className="brand">RE:ENTRY</Link>
          <nav aria-label="Provider workspace">
            <Link href="/desk">Skin Pass desk</Link>
            <Link href="/protocols">Protocols</Link>
            <Link href="/issue">Issue pass</Link>
          </nav>
          <span className="meta">{section}</span>
        </header>
        {children}
      </section>
    </main>
  );
}
