export default function GearTag({ size = 42, variant = "dark", showWordmark = true, className = "" }) {
  return (
    <div className={`gear-tag-logo-container ${className}`} style={{ display: "inline-flex", alignItems: "center" }}>
      <img
        src="/logo-transparent.png"
        alt="GearGrid"
        style={{
          height: size,
          width: "auto",
          maxWidth: "100%",
          objectFit: "contain",
          display: "block",
          background: "transparent",
          filter: "drop-shadow(0 0 8px rgba(74, 222, 128, 0.3))",
        }}
      />
    </div>
  );
}