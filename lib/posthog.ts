import { AuthProvider, Network } from "@/constant/schema.client";
import posthog from "posthog-js";

export function initPostHog() {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  if (posthog.__loaded) return;

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: true,
    capture_pageleave: true,
    person_profiles: "identified_only",
    respect_dnt: true,
  });
}

type IdentifyProps = {
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  authMethod?: AuthProvider;
  signedUpAt?: string;
};

export function identifyUser(userId: string, props: IdentifyProps) {
  if (typeof window === "undefined") return;
  posthog.identify(userId, {
    $email: props.email,
    ...(props.name ? { $name: props.name } : {}),
    ...(props.name ? { name: props.name } : {}),
    ...(props.firstName ? { first_name: props.firstName } : {}),
    ...(props.lastName ? { last_name: props.lastName } : {}),
    ...(props.authMethod ? { auth_method: props.authMethod } : {}),
    ...(props.signedUpAt ? { signed_up_at: props.signedUpAt } : {}),
  });
}

type OrgGroupProps = {
  name: string;
  environment: Network;
  createdAt?: string;
  description?: string | null;
  hasLogo?: boolean;
  hasSupportEmail?: boolean;
};

export function identifyOrganization(orgId: string, props: OrgGroupProps) {
  if (typeof window === "undefined") return;
  posthog.group("organization", orgId, {
    name: props.name,
    environment: props.environment,
    ...(props.createdAt ? { created_at: props.createdAt } : {}),
    ...(props.description ? { description: props.description } : {}),
    has_logo: props.hasLogo ?? false,
    has_support_email: props.hasSupportEmail ?? false,
  });
}

export function resetUser() {
  if (typeof window === "undefined") return;
  posthog.reset();
}

type Events =
  | { event: "user_signed_up"; props: { email: string; auth_method: AuthProvider } }
  | { event: "user_signed_in"; props: { email: string; auth_method: AuthProvider } }
  | { event: "organization_created"; props: { org_id: string; org_name: string; environment: Network } }
  | { event: "organization_selected"; props: { org_id: string; org_name: string } }
  | { event: "marketplace_app_interest"; props: { app_id: string; app_name: string; app_category: string } }
  | { event: "marketplace_app_viewed"; props: { app_id: string; app_name: string; app_category: string } }
  | { event: "marketplace_developer_docs_clicked"; props?: Record<string, unknown> }
  | { event: "marketplace_viewed"; props?: Record<string, unknown> };

export function capture<T extends Events["event"]>(event: T, props?: Extract<Events, { event: T }>["props"]) {
  if (typeof window === "undefined") return;
  posthog.capture(event, props ?? {});
}
