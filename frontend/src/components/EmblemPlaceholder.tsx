// State Emblem of India / Ashoka Lion Capital.
//
// Source asset: public/state-emblem.png (transparent background, original aspect ratio
// preserved). Rendered with object-fit: contain so it is never stretched or distorted,
// and stays visually distinct from the PRAMANA mark alongside it.
//
// `size` sets a fixed px box (used on the Login page). Pass `className` with responsive
// Tailwind width/height utilities instead when the box needs to scale across breakpoints
// (used in the header) — `className` takes precedence over `size` when both are given.

export default function EmblemPlaceholder({
  size = 44,
  className,
}: {
  size?: number;
  variant?: 'light' | 'dark';
  className?: string;
}) {
  return (
    <img
      src="/state-emblem.png"
      alt="State Emblem of India"
      className={className ? `${className} object-contain shrink-0` : 'object-contain shrink-0'}
      style={className ? undefined : { width: size, height: size }}
    />
  );
}
