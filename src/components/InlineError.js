"use client";

// Standard inline error used across module pages for validation and operation
// failures. Unifies the previously hand-repeated markup into one component;
// pass `className` to override spacing per context.
//
// Optionally accepts `action={{ label, onClick }}` to render a retry/action
// button beneath the message — the shared "Try again" pattern.

export default function InlineError({ children, className = "", action }) {
  return (
    <div className={`text-mismatch text-sm ${className}`}>
      <p role="alert">{children}</p>
      {action && (
        <button onClick={action.onClick} className="text-sm text-teal mt-1 hover:underline">
          {action.label}
        </button>
      )}
    </div>
  );
}
