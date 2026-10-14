export default function GearTag({ size = 40, variant = "dark", showWordmark = false }) {
  const ink = variant === "dark" ? "#F5F1E8" : "#14231F";
  const accent = "#E8A03D";

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path
          d="M6 30.5L30.5 6C31.9 4.6 34.1 4.6 35.5 6L58 28.5C59.4 29.9 59.4 32.1 58 33.5L33.5 58C32.1 59.4 29.9 59.4 28.5 58L6 35.5C4.6 34.1 4.6 31.9 6 30.5Z"
          stroke={ink}
          strokeWidth="2.5"
          strokeDasharray="1 5"
          strokeLinecap="round"
        />
        <circle cx="20" cy="20" r="4" stroke={ink} strokeWidth="2.5" />
        <g stroke={accent} strokeWidth="2.5" strokeLinecap="round">
          <path d="M30 34h8M30 34v8M30 42h8M38 34v8" />
        </g>
      </svg>
      {showWordmark && (
        <span
          style={{
            fontFamily: "'Archivo Black', sans-serif",
            fontSize: size * 0.42,
            letterSpacing: "-0.01em",
            color: ink,
          }}
        >
          GEAR<span style={{ color: accent }}>GRID</span>
        </span>
      )}
    </div>
  );
}