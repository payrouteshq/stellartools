/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";

import { type BridgeContext, createBridgeFetch, stellar } from "@stellartools/app-embed-bridge";
import { Skeleton } from "@stellartools/shared-ui";

type AppStep = "connect" | "overview";

export type TemplateIds = {
  paymentReceivedTemplateId?: string;
  paymentFailedTemplateId?: string;
  refundSucceededTemplateId?: string;
  subscriptionCreatedTemplateId?: string;
  subscriptionCanceledTemplateId?: string;
  customerWelcomeTemplateId?: string;
};

type ResendAppContextValue = {
  bridge: BridgeContext;
  step: AppStep;
  hasApiKey: boolean;
  resendApiKey: string;
  customerSyncEnabled: boolean;
  templateIds: TemplateIds;
  error: string | null;
  saving: boolean;
  setResendApiKey: (value: string) => void;
  saveConnectStep: () => Promise<boolean>;
  saveSyncSettings: (patch: { customerSyncEnabled?: boolean }) => Promise<void>;
  saveTemplateIds: (patch: Partial<TemplateIds>) => Promise<void>;
};

const ResendAppContext = createContext<ResendAppContextValue | null>(null);

export function ResendAppProvider({ children }: { children: ReactNode }) {
  const [bridge, setBridge] = useState<BridgeContext | null>(null);
  const [step, setStep] = useState<AppStep>("connect");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [resendApiKey, setResendApiKey] = useState("");
  const [customerSyncEnabled, setSyncEnabled] = useState(false);
  const [templateIds, setTemplateIds] = useState<TemplateIds>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const context = stellar.init((update) => {
      setBridge((prev) => (prev ? { ...prev, ...update } : prev));
    });
    if (context) setBridge(context);
  }, []);

  useEffect(() => {
    if (!bridge?.theme) return;
    document.documentElement.classList.toggle("dark", bridge.theme === "dark");
  }, [bridge?.theme]);

  useEffect(() => {
    if (!bridge?.appToken) return;
    try {
      const payload = JSON.parse(atob(bridge.appToken.split(".")[1])) as {
        settings?: { resendApiKey?: string; customerSyncEnabled?: boolean } & TemplateIds;
      };
      const settings = payload.settings ?? {};
      const hasKey = Boolean(settings.resendApiKey);
      setHasApiKey(hasKey);
      setStep(hasKey ? "overview" : "connect");
      setSyncEnabled(Boolean(settings.customerSyncEnabled));
      const {
        paymentReceivedTemplateId,
        paymentFailedTemplateId,
        refundSucceededTemplateId,
        subscriptionCreatedTemplateId,
        subscriptionCanceledTemplateId,
        customerWelcomeTemplateId,
      } = settings;
      setTemplateIds({
        paymentReceivedTemplateId,
        paymentFailedTemplateId,
        refundSucceededTemplateId,
        subscriptionCreatedTemplateId,
        subscriptionCanceledTemplateId,
        customerWelcomeTemplateId,
      });
    } catch {
      setError("Failed to load settings");
    }
  }, [bridge?.appToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSetResendApiKey = useCallback((v: string) => {
    setError(null);
    setResendApiKey(v);
  }, []);

  const saveConnectStep = useCallback(async () => {
    if (!bridge) return false;

    if (!resendApiKey.trim()) {
      setError("Enter your Resend API key to continue.");
      return false;
    }

    setSaving(true);
    setError(null);

    const apiFetch = createBridgeFetch(bridge.appToken);

    try {
      const res = await apiFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resendApiKey }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to save settings");
        return false;
      }

      const data = await res.json();
      setHasApiKey(Boolean(data.hasApiKey));
      setResendApiKey("");
      setStep("overview");
      return true;
    } catch {
      setError("Failed to save settings");
      return false;
    } finally {
      setSaving(false);
    }
  }, [bridge, resendApiKey]);

  const saveSyncSettings = useCallback(
    async (patch: { customerSyncEnabled?: boolean }) => {
      if (!bridge) return;
      if ("customerSyncEnabled" in patch) setSyncEnabled(patch.customerSyncEnabled!);
      const apiFetch = createBridgeFetch(bridge.appToken);
      await apiFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    },
    [bridge]
  );

  const saveTemplateIds = useCallback(
    async (patch: Partial<TemplateIds>) => {
      if (!bridge) return;
      setTemplateIds((prev) => ({ ...prev, ...patch }));
      const apiFetch = createBridgeFetch(bridge.appToken);
      await apiFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    },
    [bridge]
  );

  if (!bridge) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  return (
    <ResendAppContext.Provider
      value={{
        bridge,
        step,
        hasApiKey,
        resendApiKey,
        customerSyncEnabled,
        templateIds,
        error,
        saving,
        setResendApiKey: handleSetResendApiKey,
        saveConnectStep,
        saveSyncSettings,
        saveTemplateIds,
      }}
    >
      {children}
    </ResendAppContext.Provider>
  );
}

export function useResendApp() {
  const ctx = useContext(ResendAppContext);
  if (!ctx) throw new Error("useResendApp must be used within ResendAppProvider");
  return ctx;
}
