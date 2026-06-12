"use client";

import * as React from "react";

import { cn } from "../../lib/utils";

const DURATION_MS = 500;

interface CircularProgressProps extends React.SVGProps<SVGSVGElement> {
  value: number;
  max: number;
  size?: number;
}

function wedgePathFromPercentage(percentage: number, size: number): string {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;

  if (percentage <= 0) return "";

  if (percentage >= 100) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
  }

  const angleRad = (-90 * Math.PI) / 180 + (percentage / 100) * 2 * Math.PI;
  const endX = cx + r * Math.cos(angleRad);
  const endY = cy + r * Math.sin(angleRad);
  const largeArcFlag = percentage > 50 ? 1 : 0;

  return `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
}

export const CircularProgress = React.memo(({ value, max, size = 24, className, ...props }: CircularProgressProps) => {
  const targetPercentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const [displayPercentage, setDisplayPercentage] = React.useState(targetPercentage);
  const displayRef = React.useRef(displayPercentage);
  displayRef.current = displayPercentage;

  React.useEffect(() => {
    const start = displayRef.current;
    if (start === targetPercentage) return;

    const delta = targetPercentage - start;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / DURATION_MS, 1);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const next = start + delta * eased;
      displayRef.current = next;
      setDisplayPercentage(next);

      if (t < 1) requestAnimationFrame(tick);
    };

    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [targetPercentage]);

  const wedgePath = React.useMemo(() => wedgePathFromPercentage(displayPercentage, size), [displayPercentage, size]);

  const center = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={cn("shrink-0", className)} {...props}>
      <circle cx={center} cy={center} r={center} fill="currentColor" className="text-muted" />
      {wedgePath && <path d={wedgePath} fill="currentColor" className="text-primary" />}
      <circle
        cx={center}
        cy={center}
        r={center - 0.5}
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        className="text-border opacity-50"
      />
    </svg>
  );
});

CircularProgress.displayName = "CircularProgress";
