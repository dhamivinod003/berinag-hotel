export default function Loading() {
  return (
    <div className="fixed inset-0 grid place-items-center bg-card">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-pill border-2 border-forest-800/20 border-t-forest-800" />
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-muted">
          Loading
        </p>
      </div>
    </div>
  );
}
