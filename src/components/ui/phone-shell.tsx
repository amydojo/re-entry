export function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="app-stage">
      <section className="phone-shell" aria-label="RE:ENTRY application">
        <div className="phone-content">
          <div className="statusbar" aria-hidden="true"><span>9:41</span><span>•••</span></div>
          {children}
        </div>
      </section>
    </main>
  );
}
