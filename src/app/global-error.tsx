"use client";

/**
 * The last resort: this replaces the root layout, so it ships its own <html>
 * and cannot rely on fonts or tokens being present.
 */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 24px",
          background: "#f6efdf",
          color: "#2b2119",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: 30, fontWeight: 600, margin: 0 }}>
          What&rsquo;s Cooking is down
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: "#5c4c39" }}>
          Something broke badly enough to take the whole page with it. Reloading
          usually sorts it.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 16,
            height: 52,
            borderRadius: 12,
            border: "none",
            background: "#be3a22",
            color: "#fffbf1",
            fontSize: 17,
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
