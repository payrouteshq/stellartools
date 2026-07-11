"use client";

import * as React from "react";

import { Cohort, FilterOp, RuleBlock } from "@/app/actions/db";
import { getCohort } from "@/app/actions/db";
import { AppSettings, saveCohort } from "@/app/actions/posthog";
import { useStellarToolsContext } from "@stellartools/app-sdk";
import { Button, Input, SelectField, Spinner } from "@stellartools/shared-ui";
import { WEBHOOK_EVENT_TYPES, WebhookEventType } from "@stellartools/core";
import { useRouter, useSearchParams } from "next/navigation";

// ─── Event catalog ────────────────────────────────────────────────────────────

type PropMeta = { type: "currency" | "enum" | "string"; source?: "products" };
type EventCatalogEntry = { properties: Record<string, PropMeta> };

const RESOURCE_PROPS: Record<string, Record<string, PropMeta>> = {
  customer:        { email: { type: "string" }, name: { type: "string" } },
  payment_method:  {},
  checkout:        { product_id: { type: "enum", source: "products" }, status: { type: "string" } },
  payment:         { amount: { type: "currency" } },
  refund:          { amount: { type: "currency" } },
  subscription:    { product_id: { type: "enum", source: "products" }, status: { type: "string" } },
};

const EVENT_CATALOG = Object.fromEntries(
  WEBHOOK_EVENT_TYPES.map((k) => [k, { properties: RESOURCE_PROPS[k.split(".")[0]] ?? {} }])
) as Record<WebhookEventType, EventCatalogEntry>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EVENT_KEYS = Object.keys(EVENT_CATALOG) as WebhookEventType[];
const DEFAULT_EVENT = EVENT_KEYS[0];

function newBlock(): RuleBlock {
  return {
    id: crypto.randomUUID(),
    event: DEFAULT_EVENT,
    filters: [],
    window: { amount: 30, unit: "days" },
    count: { op: "gte", value: 1 },
  };
}

function newCohort(installationId: string): Cohort {
  return {
    id: crypto.randomUUID(),
    installationId,
    name: "",
    description: "",
    match: "all",
    blocks: [newBlock()],
    posthogCohortId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const eventOptions = EVENT_KEYS.map((k) => ({ value: k, label: k.replace(".", " ") }));
const countOpOptions = [
  { value: "gte", label: "at least" },
  { value: "lte", label: "at most" },
  { value: "eq", label: "exactly" },
];
const windowUnitOptions = [
  { value: "days", label: "days" },
  { value: "weeks", label: "weeks" },
  { value: "months", label: "months" },
];
const filterOpOptions: { value: FilterOp; label: string }[] = [
  { value: "eq", label: "= equals" },
  { value: "is_not", label: "≠ not equals" },
  { value: "gt", label: "> greater than" },
  { value: "lt", label: "< less than" },
  { value: "gte", label: "≥ greater or equal" },
  { value: "lte", label: "≤ less or equal" },
];

// ─── Rule block editor ───────────────────────────────────────────────────────

function RuleBlockEditor({
  block,
  onChange,
  onRemove,
  canRemove,
}: {
  block: RuleBlock;
  onChange: (b: RuleBlock) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const propKeys = Object.keys(EVENT_CATALOG[block.event as WebhookEventType]?.properties ?? {});

  return (
    <div className="border-border rounded-lg border p-4 flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">Condition</span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive text-xs underline-offset-4 hover:underline"
          >
            Remove
          </button>
        )}
      </div>

      {/* Event */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">Event</label>
        <SelectField
          id={`event-${block.id}`}
          label=""
          value={block.event}
          onChange={(v: string) => onChange({ ...block, event: v as WebhookEventType, filters: [] })}
          items={eventOptions}
          triggerClassName="shadow-none"
        />
      </div>

      {/* Frequency */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">Frequency</label>
        <div className="flex items-center gap-2">
          <SelectField
            id={`count-op-${block.id}`}
            label=""
            value={block.count.op}
            onChange={(v: string) => onChange({ ...block, count: { ...block.count, op: v as "gte" | "lte" | "eq" } })}
            items={countOpOptions}
            triggerClassName="shadow-none w-32"
          />
          <Input
            type="number"
            min={1}
            value={block.count.value}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange({ ...block, count: { ...block.count, value: Number(e.target.value) } })
            }
            className="shadow-none w-20"
          />
          <span className="text-muted-foreground text-sm">times</span>
        </div>
      </div>

      {/* Time window */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">Time window</label>
        {block.window ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last</span>
            <Input
              type="number"
              min={1}
              value={block.window.amount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onChange({ ...block, window: { ...block.window!, amount: Number(e.target.value) } })
              }
              className="shadow-none w-20"
            />
            <SelectField
              id={`unit-${block.id}`}
              label=""
              value={block.window.unit}
              onChange={(v: string) =>
                onChange({ ...block, window: { ...block.window!, unit: v as "days" | "weeks" | "months" } })
              }
              items={windowUnitOptions}
              triggerClassName="shadow-none w-28"
            />
            <button
              type="button"
              onClick={() => onChange({ ...block, window: null })}
              className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
            >
              Any time
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Any time</span>
            <button
              type="button"
              onClick={() => onChange({ ...block, window: { amount: 30, unit: "days" } })}
              className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
            >
              Set window
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      {propKeys.length > 0 && (
        <div className="flex flex-col gap-2">
          <label className="text-xs text-muted-foreground">Filters <span className="font-normal">(optional)</span></label>
          {block.filters.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <SelectField
                id={`prop-${block.id}-${i}`}
                label=""
                value={f.prop}
                onChange={(v: string) => {
                  const next = [...block.filters];
                  next[i] = { ...f, prop: v };
                  onChange({ ...block, filters: next });
                }}
                items={propKeys.map((k) => ({ value: k, label: k }))}
                triggerClassName="shadow-none w-32"
              />
              <SelectField
                id={`op-${block.id}-${i}`}
                label=""
                value={f.op}
                onChange={(v: string) => {
                  const next = [...block.filters];
                  next[i] = { ...f, op: v as FilterOp };
                  onChange({ ...block, filters: next });
                }}
                items={filterOpOptions}
                triggerClassName="shadow-none w-40"
              />
              <Input
                value={String(f.value)}
                placeholder="Enter value"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const next = [...block.filters];
                  next[i] = { ...f, value: e.target.value };
                  onChange({ ...block, filters: next });
                }}
                className="shadow-none flex-1"
              />
              <button
                type="button"
                onClick={() => onChange({ ...block, filters: block.filters.filter((_, j) => j !== i) })}
                className="text-muted-foreground hover:text-destructive text-sm shrink-0"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({ ...block, filters: [...block.filters, { prop: propKeys[0], op: "eq", value: "" }] })
            }
            className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline self-start"
          >
            + Add filter
          </button>
        </div>
      )}

    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function CohortPage() {
  const searchParams = useSearchParams();
  const appToken = searchParams.get("st_token") ?? "";
  const editId = searchParams.get("id");
  const router = useRouter();

  const { settings, instId } = useStellarToolsContext();
  const appSettings = settings as unknown as AppSettings;

  const [cohort, setCohort] = React.useState<Cohort | null>(() => (editId ? null : newCohort(instId)));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!editId) return;
    getCohort(editId).then((existing) => {
      if (existing) setCohort(existing);
      else setError("Cohort not found");
    });
  }, [editId]);

  const updateBlock = (i: number, b: RuleBlock) => {
    if (!cohort) return;
    const next = [...cohort.blocks];
    next[i] = b;
    setCohort({ ...cohort, blocks: next });
  };

  if (!cohort) {
    return (
      <div className="flex h-screen items-center justify-center">
        {error ? <p className="text-destructive text-sm">{error}</p> : <Spinner />}
      </div>
    );
  }

  const handleSave = async () => {
    if (!cohort.name.trim()) { setError("Name is required"); return; }
    if (cohort.blocks.length === 0) { setError("Add at least one rule"); return; }
    setSaving(true);
    setError(null);
    try {
      await saveCohort(cohort, appSettings);
      window.parent.postMessage({ type: "stellar:data-changed" }, "*");
      router.push(`/dashboard?st_token=${appToken}`);
    } catch {
      setError("Failed to save cohort. Check your PostHog keys.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-background min-h-screen px-5 py-6">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">

        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">{editId ? "Edit cohort" : "New cohort"}</h2>
          <button
            type="button"
            onClick={() => router.push(`/dashboard?st_token=${appToken}`)}
            className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
          >
            ← Back
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <Input
            placeholder="Cohort name"
            value={cohort.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCohort({ ...cohort, name: e.target.value })}
            className="shadow-none text-sm"
          />
          <Input
            placeholder="Description (optional)"
            value={cohort.description ?? ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCohort({ ...cohort, description: e.target.value })}
            className="shadow-none text-sm"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">Match</span>
          <div className="flex rounded-md border overflow-hidden">
            {(["all", "any"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setCohort({ ...cohort, match: m })}
                className={`px-3 py-1 text-xs transition-colors ${
                  cohort.match === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "all" ? "All rules (AND)" : "Any rule (OR)"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {cohort.blocks.map((block, i) => (
            <RuleBlockEditor
              key={block.id}
              block={block}
              onChange={(b) => updateBlock(i, b)}
              onRemove={() => setCohort({ ...cohort, blocks: cohort.blocks.filter((_, j) => j !== i) })}
              canRemove={cohort.blocks.length > 1}
            />
          ))}
          <button
            type="button"
            onClick={() => setCohort({ ...cohort, blocks: [...cohort.blocks, newBlock()] })}
            className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline self-start"
          >
            + Add rule
          </button>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <div className="flex items-center gap-3">
          <div className="flex-1" />
          <Button variant="outline" onClick={() => router.push(`/dashboard?st_token=${appToken}`)} className="shadow-none" disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} isLoading={saving} className="shadow-none">
            {saving ? "Saving…" : "Save cohort"}
          </Button>
        </div>

      </div>
    </div>
  );
}

export default function CohortNewPage() {
  return (
    <React.Suspense fallback={<div className="flex h-screen w-screen items-center justify-center"><Spinner /></div>}>
      <CohortPage />
    </React.Suspense>
  );
}
