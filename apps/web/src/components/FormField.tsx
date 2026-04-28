import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  wide?: boolean;
  children: ReactNode;
}

export function FormField({ label, required, error, hint, className = "", wide, children }: FormFieldProps) {
  return (
    <label className={`form-field ${wide ? "wide" : ""} ${error ? "has-error" : ""} ${className}`}>
      <span className="form-field-label">
        {label}
        {required && <span className="field-required" aria-hidden="true"> *</span>}
      </span>
      {children}
      {error && (
        <span className="form-field-error" role="alert">
          {error}
        </span>
      )}
      {hint && !error && (
        <span className="field-help">{hint}</span>
      )}
    </label>
  );
}
