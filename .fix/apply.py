from pathlib import Path

client = Path("src/components/pass/client-experience.tsx")
text = client.read_text()
text = text.replace(
'''  useEffect(() => {
    setFirstOpen(localStorage.getItem(`${storageKey}:opened`) !== "1");
    localStorage.setItem(storageKey, JSON.stringify(initialSource));
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, [initialSource, storageKey]);''',
'''  useEffect(() => {
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
  }, [initialSource, storageKey]);''')
client.write_text(text)

wizard = Path("src/components/provider/issue-wizard.tsx")
text = wizard.read_text()
text = text.replace(
'''  const previewEvents = useMemo<ReturnEventSource[]>(() => [
    makeEvent("makeup", "Makeup", 1, days.makeup),
    makeEvent("acids", "Exfoliating acids", 2, days.acids),
    makeEvent("retinoid", "Retinoid", 3, days.retinoid)
  ], [days, treatmentDate]);

  function makeEvent(id: string, label: string, ordinal: number, day: number): ReturnEventSource {
    const date = new Date(`${treatmentDate}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + day);
    return { id, itemId: id, itemKey: id, itemLabel: label, ordinal, returnAt: date.toISOString(), completedAt: null };
  }''',
'''  const previewEvents = useMemo<ReturnEventSource[]>(() => [
    makePreviewEvent(treatmentDate, "makeup", "Makeup", 1, days.makeup),
    makePreviewEvent(treatmentDate, "acids", "Exfoliating acids", 2, days.acids),
    makePreviewEvent(treatmentDate, "retinoid", "Retinoid", 3, days.retinoid)
  ], [days, treatmentDate]);''')
text += '''\n\nfunction makePreviewEvent(treatmentDate: string, id: string, label: string, ordinal: number, day: number): ReturnEventSource {\n  const date = new Date(`${treatmentDate}T00:00:00.000Z`);\n  date.setUTCDate(date.getUTCDate() + day);\n  return { id, itemId: id, itemKey: id, itemLabel: label, ordinal, returnAt: date.toISOString(), completedAt: null };\n}\n'''
wizard.write_text(text)

manager = Path("src/components/provider/pass-manager.tsx")
text = manager.read_text()
text = text.replace(
'export function PassManager({ pass, events, versions, audits }: { pass: Pass; events: EventRow[]; versions: VersionRow[]; audits: AuditRow[] }) {',
'export function PassManager({ pass, events, versions, audits, serverNow }: { pass: Pass; events: EventRow[]; versions: VersionRow[]; audits: AuditRow[]; serverNow: string }) {')
text = text.replace(
'const futureEvents = useMemo(() => events.filter((event) => !event.completed_at && new Date(event.return_at).getTime() > Date.now()), [events]);',
'const futureEvents = useMemo(() => events.filter((event) => !event.completed_at && new Date(event.return_at).getTime() > new Date(serverNow).getTime()), [events, serverNow]);')
manager.write_text(text)

page = Path("src/app/desk/pass/[id]/page.tsx")
text = page.read_text()
text = text.replace('<PassManager pass={demoPass} events={demoEvents} versions=', '<PassManager pass={demoPass} events={demoEvents} serverNow="2026-07-22T19:00:00Z" versions=')
text = text.replace('<PassManager pass={pass} events={events} versions=', '<PassManager pass={pass} events={events} serverNow={new Date().toISOString()} versions=')
page.write_text(text)

Path("vitest.config.ts").write_text('''import { fileURLToPath } from "node:url";\nimport { defineConfig } from "vitest/config";\n\nexport default defineConfig({\n  resolve: {\n    alias: {\n      "@": fileURLToPath(new URL("./src", import.meta.url))\n    }\n  },\n  test: {\n    environment: "node",\n    include: ["tests/unit/**/*.test.ts"],\n    coverage: { reporter: ["text", "json-summary"] }\n  }\n});\n''')
