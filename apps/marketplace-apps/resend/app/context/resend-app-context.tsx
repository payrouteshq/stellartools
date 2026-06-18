/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";

import { type BridgeContext, stellar } from "@stellartools/app-embed-bridge";

type AppStep = "connect" | "overview";

export type NotificationRuleSettings = Record<string, { sendReceipt: boolean; template: string; enabled: boolean }>;

type ResendAppContextValue = {
  bridge: BridgeContext;
  step: AppStep;
  hasApiKey: boolean;
  resendApiKey: string;
  syncEnabled: boolean;
  notificationRules: NotificationRuleSettings;
  error: string | null;
  saving: boolean;
  setResendApiKey: (value: string) => void;
  saveConnectStep: () => Promise<boolean>;
  saveSyncSettings: (patch: { syncEnabled?: boolean }) => Promise<void>;
  saveNotificationRules: (rules: NotificationRuleSettings) => Promise<void>;
};

const ResendAppContext = createContext<ResendAppContextValue | null>(null);

export function ResendAppProvider({ children }: { children: ReactNode }) {
  const [bridge, setBridge] = useState<BridgeContext | null>(null);
  const [step, setStep] = useState<AppStep>("connect");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [resendApiKey, setResendApiKey] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [notificationRules, setNotificationRules] = useState<NotificationRuleSettings>({});
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
    fetch("/api/settings", { headers: { Authorization: `Bearer ${bridge.appToken}` } })
      .then((r) => r.json())
      .then((data) => {
        const hasKey = Boolean(data.hasApiKey);
        setHasApiKey(hasKey);
        setStep(hasKey ? "overview" : "connect");
        setSyncEnabled(Boolean(data.syncEnabled));
        if (data.notificationRules) setNotificationRules(data.notificationRules);
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${bridge.appToken}` },
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

  const saveNotificationRules = useCallback(async (rules: NotificationRuleSettings) => {
    if (!bridge) return;
    setNotificationRules(rules);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bridge.appToken}` },
      body: JSON.stringify({ notificationRules: rules }),
    });
  }, [bridge]);

  const saveSyncSettings = useCallback(async (patch: { syncEnabled?: boolean }) => {
    if (!bridge) return;
    if ("syncEnabled" in patch) setSyncEnabled(patch.syncEnabled!);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bridge.appToken}` },
      body: JSON.stringify(patch),
    });
  }, [bridge]);

  if (!bridge) {
    return <div className="text-muted-foreground p-4 text-sm">Loading…</div>;
  }

  return (
    <ResendAppContext.Provider
      value={{ bridge, step, hasApiKey, resendApiKey, syncEnabled, notificationRules, error, saving, setResendApiKey: handleSetResendApiKey, saveConnectStep, saveSyncSettings, saveNotificationRules }}
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
