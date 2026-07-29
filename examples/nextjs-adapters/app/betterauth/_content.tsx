"use client";

import React from "react";

import { authClient } from "@/lib/auth-client";
import { capture } from "@/lib/posthog";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Badge,
  Button,
  CodeBlock,
  type PhoneNumber,
  PhoneNumberField,
  Spinner,
  TextField,
  UnderlineTabs,
  UnderlineTabsContent,
  UnderlineTabsList,
  UnderlineTabsTrigger,
  cn,
  phoneNumberToString,
} from "@stellartools/shared-ui";
import * as RHF from "react-hook-form";
import { z } from "zod";

// ── Auth schemas ──────────────────────────────────────────────────────────────

const signUpSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const signInSchema = z.object({
  email: z.email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

// ── Billing action schemas ────────────────────────────────────────────────────

const updateCustomerFormSchema = z.object({
  name: z.string().optional(),
  phone: z
    .object({
      number: z.string(),
      countryCode: z.string(),
    })
    .optional(),
});

type UpdateCustomerPayload = {
  name?: string;
  phone?: string;
};

const createRefundSchema = z.object({
  payment_id: z.string().min(1, "Payment ID is required"),
  reason: z.string().min(1, "Reason is required"),
});

type SignUpValues = z.infer<typeof signUpSchema>;
type SignInValues = z.infer<typeof signInSchema>;
type UpdateCustomerFormValues = z.infer<typeof updateCustomerFormSchema>;
type CreateRefundValues = z.infer<typeof createRefundSchema>;
type View = "sign-up" | "sign-in";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`/api/auth${path}`, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message ?? `${res.status} ${res.statusText}`);
  return data;
}

// ── Root component ────────────────────────────────────────────────────────────

export default function BetterAuthContent() {
  const { data: session } = authClient.useSession();
  const [view, setView] = React.useState<View>("sign-up");
  const [loading, setLoading] = React.useState(false);
  const [output, setOutput] = React.useState<object | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [lastEndpoint, setLastEndpoint] = React.useState<string | null>(null);

  const signUpForm = RHF.useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
  });
  const signInForm = RHF.useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const withLoading = async (endpoint: string, fn: () => Promise<object>) => {
    setLoading(true);
    setOutput(null);
    setError(null);
    setLastEndpoint(endpoint);
    let success = false;
    try {
      setOutput(await fn());
      success = true;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      capture("playground_api_called", { endpoint, success });
    }
  };

  // ── Auth handlers ─────────────────────────────────────────────────────────

  const handleSignUp = signUpForm.handleSubmit(({ email, password, name }) =>
    withLoading("signUp.email", async () => {
      const res = await authClient.signUp.email({ email, password, name });
      if (res.error) throw new Error(res.error.message);
      return { ok: true, userId: res.data?.user.id, message: "Account created — Stellar customer auto-linked" };
    })
  );

  const handleSignIn = signInForm.handleSubmit(({ email, password }) =>
    withLoading("signIn.email", async () => {
      const res = await authClient.signIn.email({ email, password });
      if (res.error) throw new Error(res.error.message);
      return { ok: true, userId: res.data?.user.id };
    })
  );

  // ── Not authenticated ─────────────────────────────────────────────────────

  if (!session) {
    return (
      <div className="space-y-6">
        <UnderlineTabs value={view} onValueChange={(v) => setView(v as View)}>
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="sign-up" className="text-xs font-semibold tracking-wide uppercase">
              Sign Up
            </UnderlineTabsTrigger>
            <UnderlineTabsTrigger value="sign-in" className="text-xs font-semibold tracking-wide uppercase">
              Sign In
            </UnderlineTabsTrigger>
          </UnderlineTabsList>

          <UnderlineTabsContent value="sign-up" className="pt-6">
            <form onSubmit={handleSignUp} className="max-w-sm space-y-4">
              <RHF.Controller
                control={signUpForm.control}
                name="name"
                render={({ field, fieldState }) => (
                  <TextField
                    id="name"
                    label="Name"
                    value={field.value}
                    onChange={(v) => field.onChange(v)}
                    placeholder="Jane Doe"
                    error={fieldState.error?.message ?? null}
                  />
                )}
              />
              <RHF.Controller
                control={signUpForm.control}
                name="email"
                render={({ field, fieldState }) => (
                  <TextField
                    id="email-up"
                    label="Email"
                    type="email"
                    value={field.value}
                    onChange={(v) => field.onChange(v)}
                    placeholder="jane@example.com"
                    error={fieldState.error?.message ?? null}
                  />
                )}
              />
              <RHF.Controller
                control={signUpForm.control}
                name="password"
                render={({ field, fieldState }) => (
                  <TextField
                    id="password-up"
                    label="Password"
                    type="password"
                    value={field.value}
                    onChange={(v) => field.onChange(v)}
                    placeholder="••••••••"
                    error={fieldState.error?.message ?? null}
                  />
                )}
              />
              <Button type="submit" disabled={loading} className="w-full" isLoading={loading}>
                Create account
              </Button>
            </form>
          </UnderlineTabsContent>

          <UnderlineTabsContent value="sign-in" className="pt-6">
            <form onSubmit={handleSignIn} className="max-w-sm space-y-4">
              <RHF.Controller
                control={signInForm.control}
                name="email"
                render={({ field, fieldState }) => (
                  <TextField
                    id="email-in"
                    label="Email"
                    type="email"
                    value={field.value}
                    onChange={(v) => field.onChange(v)}
                    placeholder="jane@example.com"
                    error={fieldState.error?.message ?? null}
                  />
                )}
              />
              <RHF.Controller
                control={signInForm.control}
                name="password"
                render={({ field, fieldState }) => (
                  <TextField
                    id="password-in"
                    label="Password"
                    type="password"
                    value={field.value}
                    onChange={(v) => field.onChange(v)}
                    placeholder="••••••••"
                    error={fieldState.error?.message ?? null}
                  />
                )}
              />
              <Button type="submit" disabled={loading} className="w-full" isLoading={loading}>
                Sign in
              </Button>
            </form>
          </UnderlineTabsContent>
        </UnderlineTabs>

        <ResponseBlock output={output} error={error} endpoint={lastEndpoint} />
      </div>
    );
  }

  // ── Authenticated ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="bg-muted/50 flex items-center gap-2 rounded-lg border px-3 py-2">
        <Badge variant="outline" className="shrink-0 text-xs">
          ● Signed in
        </Badge>
        <span className="text-muted-foreground font-mono text-xs">{session.user.email}</span>
        <span className="text-muted-foreground ml-auto font-mono text-xs">id: {session.user.id}</span>
        <Button
          size="sm"
          variant="ghost"
          className="ml-2 h-6 text-xs"
          onClick={() => authClient.signOut()}
          disabled={loading}
          isLoading={loading}
        >
          Sign out
        </Button>
      </div>

      {/* Customer */}
      <Section label="Customer">
        <ActionRow method="GET" path="/stellar/customer/retrieve">
          <Button
            size="sm"
            disabled={loading}
            onClick={() => withLoading("GET /stellar/customer/retrieve", () => apiFetch("/stellar/customer/retrieve"))}
            isLoading={loading}
          >
            Retrieve
          </Button>
        </ActionRow>

        <ActionRow method="POST" path="/stellar/customer/update" stacked>
          <UpdateCustomerForm
            loading={loading}
            onSubmit={(body) =>
              withLoading("POST /stellar/customer/update", () =>
                apiFetch("/stellar/customer/update", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                })
              )
            }
          />
        </ActionRow>
      </Section>

      <Section label="Subscriptions">
        <ActionRow method="GET" path="/stellar/subscriptions/list">
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() =>
              withLoading("GET /stellar/subscriptions/list", () => apiFetch("/stellar/subscriptions/list"))
            }
          >
            {loading && <Spinner size={14} strokeColor="currentColor" />}
            List
          </Button>
        </ActionRow>
      </Section>

      <Section label="Refunds">
        <ActionRow method="POST" path="/stellar/refund/create" stacked>
          <CreateRefundForm
            loading={loading}
            onSubmit={(body) =>
              withLoading("POST /stellar/refund/create", () =>
                apiFetch("/stellar/refund/create", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                })
              )
            }
          />
        </ActionRow>
      </Section>

      <ResponseBlock output={output} error={error} endpoint={lastEndpoint} />
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">{label}</p>
      <div className="divide-border divide-y rounded-lg border">{children}</div>
    </div>
  );
}

// ── Action row ────────────────────────────────────────────────────────────────

function ActionRow({
  method,
  path,
  children,
  stacked = false,
}: {
  method: "GET" | "POST";
  path: string;
  children: React.ReactNode;
  stacked?: boolean;
}) {
  const endpoint = (
    <div className="flex min-w-0 items-center gap-2">
      <Badge variant={method === "GET" ? "secondary" : "outline"} className="font-mono text-[10px]">
        {method}
      </Badge>
      <span className="text-muted-foreground font-mono text-xs">{path}</span>
    </div>
  );

  if (stacked) {
    return (
      <div className="px-4 py-3">
        {endpoint}
        <div
          className={cn(
            "mt-2",
            "**:data-[slot=input]:h-7 **:data-[slot=input]:px-2 **:data-[slot=input]:text-xs **:data-[slot=input-group]:mt-0 **:data-[slot=input-group]:h-7 **:data-[slot=input-group]:text-xs **:data-[slot=input-group-control]:py-0 **:data-[slot=input-group-control]:text-xs **:data-[slot=label]:text-[10px] **:data-[slot=label]:font-medium [&_.space-y-2]:space-y-1 [&_[data-slot=input-group]_button]:h-7 [&_[data-slot=input-group]_button]:gap-1 [&_[data-slot=input-group]_button]:px-2 [&_[data-slot=input-group]_button_span]:text-xs [&_[data-slot=input-group]_button_svg]:h-2.5 [&_[data-slot=input-group]_button_svg]:w-4 **:[[type=submit]]:h-7 **:[[type=submit]]:px-2.5 **:[[type=submit]]:text-xs"
          )}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {endpoint}
      <div className="ml-auto shrink-0">{children}</div>
    </div>
  );
}

// ── Inline forms ──────────────────────────────────────────────────────────────

function UpdateCustomerForm({ loading, onSubmit }: { loading: boolean; onSubmit: (v: UpdateCustomerPayload) => void }) {
  const form = RHF.useForm<UpdateCustomerFormValues>({
    resolver: zodResolver(updateCustomerFormSchema),
    defaultValues: { name: "", phone: { number: "", countryCode: "US" } },
  });

  const handleSubmit = form.handleSubmit(({ name, phone }) => {
    onSubmit({
      name: name?.trim() || undefined,
      phone: phone?.number ? phoneNumberToString(phone as PhoneNumber) : undefined,
    });
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-x-2 gap-y-2">
      <RHF.Controller
        control={form.control}
        name="name"
        render={({ field, fieldState: { error } }) => (
          <TextField
            id="upd-name"
            label="Name"
            value={field.value ?? ""}
            onChange={field.onChange}
            placeholder="Jane Doe"
            className="w-32 shadow-none"
            error={error?.message ?? null}
          />
        )}
      />
      <RHF.Controller
        control={form.control}
        name="phone"
        render={({ field, fieldState: { error } }) => (
          <PhoneNumberField
            id="upd-phone"
            label="Phone"
            value={field.value ?? { number: "", countryCode: "US" }}
            onChange={field.onChange}
            error={error?.message ?? null}
            groupClassName="w-44 shadow-none"
            inputClassName="shadow-none"
          />
        )}
      />
      <Button type="submit" size="sm" disabled={loading} isLoading={loading}>
        Update
      </Button>
    </form>
  );
}

function CreateRefundForm({ loading, onSubmit }: { loading: boolean; onSubmit: (v: CreateRefundValues) => void }) {
  const form = RHF.useForm<CreateRefundValues>({ resolver: zodResolver(createRefundSchema) });
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-x-2 gap-y-2">
      <RHF.Controller
        control={form.control}
        name="payment_id"
        render={({ field, fieldState }) => (
          <TextField
            id="ref-payment"
            label="Payment ID"
            value={field.value ?? ""}
            onChange={field.onChange}
            placeholder="pay_…"
            className="w-40 shadow-none"
            error={fieldState.error?.message ?? null}
          />
        )}
      />
      <RHF.Controller
        control={form.control}
        name="reason"
        render={({ field, fieldState }) => (
          <TextField
            id="ref-reason"
            label="Reason"
            value={field.value ?? ""}
            onChange={field.onChange}
            placeholder="duplicate charge"
            className="w-40 shadow-none"
            error={fieldState.error?.message ?? null}
          />
        )}
      />
      <Button type="submit" size="sm" disabled={loading}>
        Create
      </Button>
    </form>
  );
}

// ── Response block ────────────────────────────────────────────────────────────

function ResponseBlock({
  output,
  error,
  endpoint,
}: {
  output: object | null;
  error: string | null;
  endpoint: string | null;
}) {
  if (!output && !error) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {endpoint && <span className="text-muted-foreground font-mono text-xs">{endpoint}</span>}
        {error ? (
          <Badge variant="destructive" className="ml-auto text-xs">
            Error
          </Badge>
        ) : (
          <Badge variant="secondary" className="ml-auto text-xs">
            OK
          </Badge>
        )}
      </div>
      <CodeBlock language="json" filename="response.json">
        {error ? `// Error\n${error}` : JSON.stringify(output, null, 2)}
      </CodeBlock>
    </div>
  );
}
