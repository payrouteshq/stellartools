/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";

import { type BridgeContext, stellar } from "@stellartools/app-embed-bridge";

type AppStep = "connect" | "overview";

type ResendAppContextValue = {
  bridge: BridgeContext;
  step: AppStep;
  hasApiKey: boolean;
  resendApiKey: string;
  error: string | null;
  saving: boolean;
  setResendApiKey: (value: string) => void;
  saveConnectStep: () => Promise<boolean>;
};

const ResendAppContext = createContext<ResendAppContextValue | null>(null);

export function ResendAppProvider({ children }: { children: ReactNode }) {
  const [bridge, setBridge] = useState<BridgeContext | null>(null);
  const [step, setStep] = useState<AppStep>("connect");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [resendApiKey, setResendApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const context = stellar.init((update) => {
      setBridge((prev) => (prev ? { ...prev, ...update } : prev));
    });
    if (context?.installationId) setBridge(context);
  }, []);

  useEffect(() => {
    if (!bridge?.installationId) return;
    fetch(
      `/api/settings?installationId=${bridge.installationId}&organizationId=${bridge.organizationId}&environment=${bridge.environment}&scopes=${bridge.scopes.join(",")}`
    )
      .then((r) => r.json())
      .then((data) => {
        const hasKey = Boolean(data.hasApiKey);
        setHasApiKey(hasKey);
        setStep(hasKey ? "overview" : "connect");
      })
      .catch(() => setError("Failed to load settings"));
  }, [bridge?.installationId]); // eslint-disable-line react-hooks/exhaustive-deps

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

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installationId: bridge.installationId,
          organizationId: bridge.organizationId,
          environment: bridge.environment,
          scopes: bridge.scopes,
          resendApiKey,
        }),
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

  if (!bridge) {
    return <div className="text-muted-foreground p-4 text-sm">Loading…</div>;
  }

  return (
    <ResendAppContext.Provider
      value={{ bridge, step, hasApiKey, resendApiKey, error, saving, setResendApiKey: handleSetResendApiKey, saveConnectStep }}
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
