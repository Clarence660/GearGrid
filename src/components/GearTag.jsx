export default function GearTag({ size = 32, variant = "dark", showWordmark = true, className = "" }) {
  const logoSrc = variant === "dark" ? "/logo.png" : "/logo-transparent.png";

  return (
    <div className={`gear-tag-logo-container ${className}`} style={{ display: "inline-flex", alignItems: "center" }}>
      <img
        src={logoSrc}
        alt="GearGrid"
        style={{
          height: size,
          width: "auto",
          maxWidth: "100%",
          objectFit: "contain",
          display: "block",
          borderRadius: variant === "dark" ? "6px" : "0px",
        }}
      />
    </div>
  );
}