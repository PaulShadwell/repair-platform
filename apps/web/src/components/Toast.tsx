import { useEffect } from "react";
import { X } from "lucide-react";

interface ToastProps {
  message: string;
  type: "success" | "error" | "info";
  onDismiss: () => void;
}

export function Toast({ message, type, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timeoutMs = type === "error" ? 6000 : 4000;
    const timeoutId = window.setTimeout(onDismiss, timeoutMs);
    return () => window.clearTimeout(timeoutId);
  }, [message, type, onDismiss]);

  if (!message) return null;

  return (
    <div
      className={`toast toast-${type}`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <span className="toast-message">{message}</span>
      <button
        type="button"
        className="toast-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  );
}
