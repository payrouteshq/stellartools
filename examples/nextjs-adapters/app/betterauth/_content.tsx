"use client";

import React from "react";

import { authClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Badge,
  Button,
  CodeBlock,
  Spinner,
  TextField,
  UnderlineTabs,
  UnderlineTabsContent,
  UnderlineTabsList,
  UnderlineTabsTrigger,
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

const updateCustomerSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
});

const createSubscriptionSchema = z.object({
  product_id: z.string().min(1, "Product ID is required"),
});

const createRefundSchema = z.object({
  payment_id: z.string().min(1, "Payment ID is required"),
  reason: z.string().min(1, "Reason is required"),
});

type SignUpValues = z.infer<typeof signUpSchema>;
type SignInValues = z.infer<typeof signInSchema>;
type UpdateCustomerValues = z.infer<typeof updateCustomerSchema>;
type CreateSubscriptionValues = z.infer<typeof createSubscriptionSchema>;
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
    try {
      setOutput(await fn());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
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
              <Button type="submit" disabled={loading} className="w-full">
                {loading && <Spinner size={14} strokeColor="currentColor" />}
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
              <Button type="submit" disabled={loading} className="w-full">
                {loading && <Spinner size={14} strokeColor="currentColor" />}
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
          >
            {loading && <Spinner size={14} strokeColor="currentColor" />}
            Retrieve
          </Button>
        </ActionRow>

        <ActionRow method="POST" path="/stellar/customer/update">
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

        <ActionRow method="POST" path="/stellar/subscription/create">
          <CreateSubscriptionForm
            loading={loading}
            onSubmit={(body) =>
              withLoading("POST /stellar/subscription/create", () =>
                apiFetch("/stellar/subscription/create", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                })
              )
            }
          />
        </ActionRow>
      </Section>

      <Section label="Refunds">
        <ActionRow method="POST" path="/stellar/refund/create">
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

function ActionRow({ method, path, children }: { method: "GET" | "POST"; path: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start">
      <div className="flex min-w-0 shrink-0 items-center gap-2 pt-1">
        <Badge variant={method === "GET" ? "secondary" : "outline"} className="font-mono text-[10px]">
          {method}
        </Badge>
        <span className="text-muted-foreground font-mono text-xs">{path}</span>
      </div>
      <div className="sm:ml-auto">{children}</div>
    </div>
  );
}

// ── Inline forms ──────────────────────────────────────────────────────────────

function UpdateCustomerForm({ loading, onSubmit }: { loading: boolean; onSubmit: (v: UpdateCustomerValues) => void }) {
  const form = RHF.useForm<UpdateCustomerValues>({ resolver: zodResolver(updateCustomerSchema) });
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-2">
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
            className="w-36"
            error={error?.message ?? null}
          />
        )}
      />
      <RHF.Controller
        control={form.control}
        name="phone"
        render={({ field, fieldState: { error } }) => (
          <TextField
            id="upd-phone"
            label="Phone"
            value={field.value ?? ""}
            onChange={field.onChange}
            placeholder="+1 555 0100"
            className="w-36"
            error={error?.message ?? null}
          />
        )}
      />
      <Button type="submit" size="sm" disabled={loading} className="mb-0.5">
        {loading && <Spinner size={14} strokeColor="currentColor" />}
        Update
      </Button>
    </form>
  );
}

function CreateSubscriptionForm({
  loading,
  onSubmit,
}: {
  loading: boolean;
  onSubmit: (v: CreateSubscriptionValues) => void;
}) {
  const form = RHF.useForm<CreateSubscriptionValues>({ resolver: zodResolver(createSubscriptionSchema) });
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-2">
      <RHF.Controller
        control={form.control}
        name="product_id"
        render={({ field, fieldState }) => (
          <TextField
            id="sub-product"
            label="Product ID"
            value={field.value ?? ""}
            onChange={field.onChange}
            placeholder="prod_…"
            className="w-52"
            error={fieldState.error?.message ?? null}
          />
        )}
      />
      <Button type="submit" size="sm" disabled={loading} className="mb-0.5">
        {loading && <Spinner size={14} strokeColor="currentColor" />}
        Create
      </Button>
    </form>
  );
}

function CreateRefundForm({ loading, onSubmit }: { loading: boolean; onSubmit: (v: CreateRefundValues) => void }) {
  const form = RHF.useForm<CreateRefundValues>({ resolver: zodResolver(createRefundSchema) });
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-2">
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
            className="w-44"
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
            className="w-44"
            error={fieldState.error?.message ?? null}
          />
        )}
      />
      <Button type="submit" size="sm" disabled={loading} className="mb-0.5">
        {loading && <Spinner size={14} strokeColor="currentColor" />}
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
