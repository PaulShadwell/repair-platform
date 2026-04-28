import type { CSSProperties } from "react";

interface SpinnerProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
  label?: string; // accessible label, defaults to "Loading"
}

export function Spinner({ size = 20, className = "", style, label = "Loading" }: SpinnerProps) {
  return (
    <span
      className={`spinner ${className}`}
      style={{ width: size, height: size, ...style }}
      role="status"
      aria-label={label}
    >
      <span className="visually-hidden">{label}</span>
    </span>
  );
}
