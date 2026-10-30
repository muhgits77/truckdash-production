export function HoldingPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1.25rem",
        background: "#f6f1e7",
        color: "#1f2a2e",
        fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <div style={{ maxWidth: 460, textAlign: "center" }}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0, lineHeight: 1.25 }}>
          This page isn&apos;t available right now.
        </h1>
        <p style={{ marginTop: "0.9rem", fontSize: "1rem", color: "#4a5559", lineHeight: 1.6 }}>
          Looking for a website for your food truck?
        </p>
        <a
          href="https://bluegrassdigitalforge.com/food-truck-websites"
          style={{
            display: "inline-block",
            marginTop: "1.25rem",
            padding: "0.75rem 1.4rem",
            borderRadius: 999,
            background: "#b8722c",
            color: "#fff",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          See food truck websites →
        </a>
        <p style={{ marginTop: "2rem", fontSize: "0.85rem", color: "#6b7579" }}>
          Bluegrass Digital Forge
        </p>
      </div>
    </main>
  );
}
