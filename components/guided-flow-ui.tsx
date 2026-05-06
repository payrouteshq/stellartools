"use client";

import * as React from "react";

import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { GuidedFlowInstance } from "@/hooks/use-guided-flow";
import { X } from "lucide-react";

const POPUP_W = 272;
const GAP = 6;
const AW = 10; // arrow half-width
const AH = 8;  // arrow height
const POPUP_H_EST = 140;

function Arrow({ side, x }: { side: "top" | "bottom"; x: number }) {
  const clamped = Math.max(AW + 8, Math.min(x, POPUP_W - AW - 8));

  // CSS border-triangle: zero-width/height element with colored borders creates a solid triangle
  // For "bottom" (popup below target) → arrow points UP (▲) → sits above the card
  // For "top" (popup above target) → arrow points DOWN (▼) → sits below the card
  const outer: React.CSSProperties =
    side === "bottom"
      ? { borderLeft: `${AW}px solid transparent`, borderRight: `${AW}px solid transparent`, borderBottom: `${AH}px solid hsl(var(--border))` }
      : { borderLeft: `${AW}px solid transparent`, borderRight: `${AW}px solid transparent`, borderTop: `${AH}px solid hsl(var(--border))` };

  const inner: React.CSSProperties =
    side === "bottom"
      ? { borderLeft: `${AW - 1}px solid transparent`, borderRight: `${AW - 1}px solid transparent`, borderBottom: `${AH - 1}px solid hsl(var(--card))`, top: 1, left: -(AW - 1) }
      : { borderLeft: `${AW - 1}px solid transparent`, borderRight: `${AW - 1}px solid transparent`, borderTop: `${AH - 1}px solid hsl(var(--card))`, top: -1, left: -(AW - 1) };

  return (
    <div style={{ position: "absolute", left: clamped - AW, [side === "bottom" ? "bottom" : "top"]: "100%", width: 0, height: 0, ...outer }}>
      <div style={{ position: "absolute", width: 0, height: 0, ...inner }} />
    </div>
  );
}

export function GuidedFlowUI({ flows }: { flows: GuidedFlowInstance[] }) {
  const activeFlow = React.useMemo(() => flows.find((f) => f.currentStep && f.isActiveOnPage), [flows]);

  const [coords, setCoords] = React.useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const updateCoords = React.useCallback(() => {
    if (!activeFlow?.currentStep) return;
    const el = document.querySelector(`[data-flow-id="${activeFlow.currentStep.id}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      setCoords({ top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height });
    } else {
      setCoords(null);
    }
  }, [activeFlow]);

  React.useEffect(() => {
    updateCoords();
    const obs = new MutationObserver(updateCoords);
    obs.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", updateCoords);
    window.addEventListener("scroll", updateCoords, { passive: true });
    return () => {
      obs.disconnect();
      window.removeEventListener("resize", updateCoords);
      window.removeEventListener("scroll", updateCoords);
    };
  }, [updateCoords]);

  if (!activeFlow || !activeFlow.currentStep || !coords) return null;

  const { currentStep, next, dismiss } = activeFlow;

  // Center popup over target, clamped to viewport edges
  const cx = coords.left + coords.width / 2;
  const popupLeft = Math.max(12, Math.min(cx - POPUP_W / 2, window.innerWidth - POPUP_W - 12));

  // Arrow X is relative to the popup's left edge
  const arrowX = cx - popupLeft;

  // Prefer below; only go above if there's clearly not enough space below
  const spaceBelow = window.innerHeight - (coords.top - window.scrollY) - coords.height;
  const side = spaceBelow < POPUP_H_EST + GAP + AH + 16 ? "top" : "bottom";

  const popupTop =
    side === "bottom"
      ? coords.top + coords.height + GAP + AH
      : coords.top - GAP - AH - POPUP_H_EST;

  return createPortal(
    <>
      {/* Spotlight */}
      <div
        style={{
          position: "absolute",
          top: coords.top - 3,
          left: coords.left - 3,
          width: coords.width + 6,
          height: coords.height + 6,
          borderRadius: 8,
          pointerEvents: "none",
          zIndex: 9998,
          outline: "2px solid hsl(var(--primary))",
          outlineOffset: 1,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
        }}
      />

      {/* Card with arrow attached */}
      <div
        className="bg-card border rounded-xl shadow-2xl"
        style={{ position: "absolute", top: popupTop, left: popupLeft, width: POPUP_W, zIndex: 9999 }}
      >
        {/* The arrow sits outside the card via position:absolute + bottom/top:100% */}
        <Arrow side={side} x={arrowX} />

        <div className="p-4">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="bg-primary mt-0.5 size-1.5 shrink-0 animate-pulse rounded-full" />
              <span className="text-sm font-semibold leading-tight">{currentStep.title}</span>
            </div>
            <button
              onClick={dismiss}
              className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0 transition-colors"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <p className="text-muted-foreground mb-4 pl-3.5 text-xs leading-relaxed">{currentStep.content}</p>

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={dismiss} size="sm" className="h-7 px-3 text-xs">
              Skip
            </Button>
            <Button onClick={next} size="sm" className="h-7 px-3 text-xs">
              Next →
            </Button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
