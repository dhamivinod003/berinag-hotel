import { cn } from "@/lib/cn";

interface LogoProps {
  className?: string;
  variant?: "default" | "compact";
}

// Stylised sun + waves mark, paired with the wordmark.
// Sun: warm orange gradient. Waves: sky blue. Wordmark: ink/forest.
export function Logo({ className, variant = "default" }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <SunWavesMark className="h-9 w-9 shrink-0" />
      {variant === "default" && (
        <div className="flex flex-col leading-none">
          <span className="font-display text-lg font-medium text-ink">
            Sun <span className="font-light italic">&amp;</span> Water
          </span>
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-ink-muted">
            Resort
          </span>
        </div>
      )}
    </div>
  );
}

export function SunWavesMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="sw-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="rgb(var(--sun-300))" />
          <stop offset="60%" stopColor="rgb(var(--sun-400))" />
          <stop offset="100%" stopColor="rgb(var(--sun-500))" />
        </radialGradient>
        <linearGradient id="sw-rays" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--sun-300))" />
          <stop offset="100%" stopColor="rgb(var(--sun-500))" />
        </linearGradient>
        <linearGradient id="sw-wave" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgb(var(--wave-400))" />
          <stop offset="100%" stopColor="rgb(var(--wave-600))" />
        </linearGradient>
      </defs>

      {/* Sun rays */}
      <g stroke="url(#sw-rays)" strokeWidth="2" strokeLinecap="round">
        <line x1="24" y1="3" x2="24" y2="8" />
        <line x1="8" y1="9" x2="11.5" y2="12.5" />
        <line x1="40" y1="9" x2="36.5" y2="12.5" />
        <line x1="3" y1="22" x2="8" y2="22" />
        <line x1="45" y1="22" x2="40" y2="22" />
      </g>

      {/* Sun */}
      <circle cx="24" cy="22" r="9" fill="url(#sw-sun)" />

      {/* Waves */}
      <path
        d="M4 36 Q10 32, 16 36 T28 36 T40 36 T52 36"
        stroke="url(#sw-wave)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M4 41 Q10 37, 16 41 T28 41 T40 41 T52 41"
        stroke="url(#sw-wave)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M4 46 Q10 42, 16 46 T28 46 T40 46 T52 46"
        stroke="url(#sw-wave)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
    </svg>
  );
}
