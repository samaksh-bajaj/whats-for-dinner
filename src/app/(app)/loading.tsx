/**
 * Shown while a screen's data is on its way. Shapes, not a spinner: the page
 * that follows has a heading and a list, so this says so.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="h-9 w-40 rounded-lg bg-sunk" />
      <div className="mt-8 space-y-3">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="h-14 rounded-card bg-sunk/70" />
        ))}
      </div>
    </div>
  );
}
