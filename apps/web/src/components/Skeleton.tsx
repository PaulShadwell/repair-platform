interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  count?: number; // repeat N skeleton lines
}

export function Skeleton({ width = "100%", height = "1em", borderRadius = 4, className = "", count = 1 }: SkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);
  return (
    <>
      {items.map((i) => (
        <span
          key={i}
          className={`skeleton ${className}`}
          style={{ width, height, borderRadius, display: "block", marginBottom: count > 1 ? "0.5rem" : 0 }}
          aria-hidden="true"
        />
      ))}
    </>
  );
}
