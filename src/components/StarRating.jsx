export default function StarRating({ value, onChange, readOnly = false, size = 18 }) {
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="star-rating" role={readOnly ? undefined : "radiogroup"} aria-label="Rating">
      {stars.map((n) => (
        <button
          key={n}
          type="button"
          className={`star-btn${n <= value ? " filled" : ""}`}
          style={{ fontSize: size }}
          onClick={() => !readOnly && onChange?.(n)}
          disabled={readOnly}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}