// Wraps a loading screen (rendered inside the app shell, so the sidebar stays visible): announces
// "Loading…" to screen readers and marks the region busy.
export function LoadingRegion({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
