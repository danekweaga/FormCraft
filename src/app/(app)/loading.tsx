export default function AppLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 w-64 rounded bg-surface-container-high" />
      <div className="h-5 w-full max-w-xl rounded bg-surface-container" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-40 rounded-xl bg-surface-primary" />
        <div className="h-40 rounded-xl bg-surface-container-low" />
      </div>
      <div className="h-56 rounded-xl bg-surface-container-lowest border border-outline-variant/10" />
    </div>
  );
}
