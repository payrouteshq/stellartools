import posthog from "posthog-js";

export function initPostHog() {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  if (posthog.__loaded) return;

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: "https://us.i.posthog.com",
    capture_pageview: true,
    capture_pageleave: true,
    person_profiles: "identified_only",
    respect_dnt: true,
  });
}

export function capture<T extends string = string, P extends Record<string, unknown> = Record<string, unknown>>(
  event: T,
  props?: P
) {
  if (typeof window === "undefined") return;
  posthog.capture(event, props ?? {});
}

