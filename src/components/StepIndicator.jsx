export default function StepIndicator({ steps, currentStep }) {
  return (
    <div className="step-indicator">
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const state =
          stepNum < currentStep ? "done" : stepNum === currentStep ? "active" : "upcoming";
        return (
          <div className={`step-indicator-item ${state}`} key={label}>
            <span className="step-indicator-dot">{state === "done" ? "✓" : stepNum}</span>
            <span className="step-indicator-label">{label}</span>
            {stepNum < steps.length && <span className="step-indicator-line" />}
          </div>
        );
      })}
    </div>
  );
}