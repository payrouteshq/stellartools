"use client";

import { useCallback, useEffect, useMemo } from "react";

import { useCookieState } from "@/hooks/use-cookie-state";
import { capture } from "@/lib/posthog";
import { usePathname, useRouter } from "next/navigation";

export type FlowStep<T extends string> = {
  id: T;
  path: string;
  title: string;
  content: string;
};

export type GuidedFlowState = {
  completed: string[];
  dismissed: boolean;
};

export function useGuidedFlow<T extends string>(funnelName: string, steps: FlowStep<T>[]) {
  const pathname = usePathname();
  const router = useRouter();

  const [state, setState] = useCookieState<GuidedFlowState>(`st_flow_${funnelName}`, {
    completed: [],
    dismissed: false,
  });

  const currentStep = useMemo(() => {
    if (state.dismissed) return null;
    return steps.find((s) => !state.completed.includes(s.id)) || null;
  }, [state, steps]);

  const isActiveOnPage = currentStep?.path === pathname;

  useEffect(() => {
    if (currentStep && isActiveOnPage) {
      capture("flow_step_viewed", { funnel: funnelName, step: currentStep.id });
    }
  }, [currentStep?.id, isActiveOnPage, funnelName]);

  const next = useCallback(() => {
    if (!currentStep) return;
    capture("flow_step_completed", { funnel: funnelName, step: currentStep.id });

    setState((prev) => ({ ...prev, completed: [...prev.completed, currentStep.id] }));

    const nextStep = steps[steps.findIndex((s) => s.id === currentStep.id) + 1];
    if (nextStep && nextStep.path !== pathname) {
      router.push(nextStep.path);
    }
  }, [currentStep, steps, funnelName, pathname, router, setState]);

  const dismiss = useCallback(() => {
    setState((prev) => ({ ...prev, dismissed: true }));
    capture("flow_dismissed", { funnel: funnelName });
  }, [funnelName, setState]);

  return { currentStep, next, dismiss, isActiveOnPage, funnelName };
}

export type GuidedFlowInstance = ReturnType<typeof useGuidedFlow>;
