"use client";

import React from "react";

import { COUNTRIES, FIAT_CURRENCIES, PAYOUT_RAILS } from "@/constant/countries";

export default function TestPayoutPage() {
  const [assetCode, setAssetCode] = React.useState("USDC");
  const [amount, setAmount] = React.useState("1");
  const [currency, setCurrency] = React.useState("NGN");
  const [country, setCountry] = React.useState("NG");
  const [payoutRail, setPayoutRail] = React.useState("bank_account");

  const [loading, setLoading] = React.useState(false);
  const [fundingLoading, setFundingLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [transactionId, setTransactionId] = React.useState<string | null>(null);
  const [interactiveUrl, setInteractiveUrl] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [requiresFunding, setRequiresFunding] = React.useState<boolean>(false);
  const [txHash, setTxHash] = React.useState<string | null>(null);

  const handleCountryChange = (selectedCode: string) => {
    setCountry(selectedCode);
    const countryObj = COUNTRIES.find((c) => c.code === selectedCode);
    if (countryObj?.currency) {
      setCurrency(countryObj.currency);
    }
  };

  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setTransactionId(null);
    setInteractiveUrl(null);
    setStatus(null);
    setRequiresFunding(false);
    setTxHash(null);

    try {
      const res = await fetch("/api/offramp-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "initiate",
          assetCode,
          amount,
          destinationCurrency: currency,
          destinationCountry: country,
          payoutRail,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Initiation failed");

      setTransactionId(data.transactionId);
      setInteractiveUrl(data.interactiveUrl);
      setStatus("incomplete");

      window.open(data.interactiveUrl, "_blank");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!transactionId) return;
    setError(null);
    try {
      const res = await fetch(`/api/offramp-test?id=${encodeURIComponent(transactionId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Status check failed");

      setStatus(data.status);
      setRequiresFunding(data.requiresFunding);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to check status");
    }
  };

  const handleFundOnChain = async () => {
    if (!transactionId) return;
    setFundingLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/offramp-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fund",
          transactionId,
          assetCode,
          requestedAmount: amount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Funding failed");

      setTxHash(data.hash);
      setStatus(data.status);
      setRequiresFunding(false);
      await handleCheckStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Funding payment failed");
    } finally {
      setFundingLoading(false);
    }
  };

  React.useEffect(() => {
    if (!transactionId || status === "completed" || status === "failed") return;
    const interval = setInterval(() => {
      handleCheckStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, [transactionId, status]);

  return (
    <main style={{ maxWidth: 480, margin: "40px auto", fontFamily: "system-ui", padding: "0 16px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>SEP-38 / SEP-24 Payout Test</h1>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 24 }}>
        Test page for end-to-end offramp: Initiates quote + withdrawal, opens reference UI, polls status, and submits
        on-chain funding payment.
      </p>

      <form onSubmit={handleInitiate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label style={{ fontSize: 13 }}>
          Asset
          <select
            value={assetCode}
            onChange={(e) => setAssetCode(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              marginTop: 4,
              padding: 8,
              borderRadius: 6,
              border: "1px solid #ccc",
            }}
          >
            <option value="USDC">USDC</option>
            <option value="XLM">XLM (native)</option>
            <option value="SRT">SRT</option>
          </select>
        </label>

        <label style={{ fontSize: 13 }}>
          Amount
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              marginTop: 4,
              padding: 8,
              borderRadius: 6,
              border: "1px solid #ccc",
            }}
          />
        </label>

        <label style={{ fontSize: 13 }}>
          Destination Country
          <select
            value={country}
            onChange={(e) => handleCountryChange(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              marginTop: 4,
              padding: 8,
              borderRadius: 6,
              border: "1px solid #ccc",
            }}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: 13 }}>
          Destination Currency
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              marginTop: 4,
              padding: 8,
              borderRadius: 6,
              border: "1px solid #ccc",
            }}
          >
            {FIAT_CURRENCIES.map((f) => (
              <option key={f.code} value={f.code}>
                {f.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: 13 }}>
          Receive Money Via (Payout Rail)
          <select
            value={payoutRail}
            onChange={(e) => setPayoutRail(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              marginTop: 4,
              padding: 8,
              borderRadius: 6,
              border: "1px solid #ccc",
            }}
          >
            {PAYOUT_RAILS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px 0",
            fontSize: 15,
            fontWeight: "bold",
            background: "#0066ff",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Initiating..." : "1. Start Withdrawal & Open Reference UI"}
        </button>
      </form>

      {transactionId && (
        <div style={{ marginTop: 24, padding: 16, border: "1px solid #ddd", borderRadius: 8, background: "#fafafa" }}>
          <h3 style={{ margin: "0 0 8px 0", fontSize: 15 }}>Active Transaction Session</h3>
          <p style={{ margin: "4px 0", fontSize: 13, wordBreak: "break-all" }}>
            <strong>Transaction ID:</strong> {transactionId}
          </p>
          <p style={{ margin: "4px 0", fontSize: 13 }}>
            <strong>Selected Country Code:</strong>{" "}
            <code style={{ background: "#eee", padding: "2px 6px", borderRadius: 4 }}>{country}</code>
          </p>
          <p style={{ margin: "4px 0", fontSize: 13 }}>
            <strong>Current Status:</strong>{" "}
            <span style={{ padding: "2px 6px", borderRadius: 4, background: "#eee", fontWeight: 600 }}>
              {status ?? "Checking..."}
            </span>
          </p>

          {interactiveUrl && (
            <p style={{ margin: "8px 0", fontSize: 13 }}>
              <a href={interactiveUrl} target="_blank" rel="noreferrer" style={{ color: "#0066ff" }}>
                ↗ Re-open SEP-24 Interactive UI
              </a>
            </p>
          )}

          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button onClick={handleCheckStatus} style={{ padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>
              Refresh Status
            </button>

            {(requiresFunding || status === "pending_user_transfer_start") && (
              <button
                onClick={handleFundOnChain}
                disabled={fundingLoading}
                style={{
                  padding: "6px 14px",
                  fontSize: 13,
                  fontWeight: "bold",
                  background: "#10b981",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: fundingLoading ? "wait" : "pointer",
                }}
              >
                {fundingLoading ? "Funding On-Chain..." : "2. Fund Payment On-Chain Now"}
              </button>
            )}
          </div>

          {txHash && (
            <p style={{ marginTop: 12, fontSize: 12, color: "#047857", wordBreak: "break-all" }}>
              ✔ <strong>Funded On-Chain!</strong> Hash: {txHash}
            </p>
          )}
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: 16,
            background: "#fee",
            border: "1px solid #fcc",
            borderRadius: 6,
            padding: 12,
            fontSize: 13,
            color: "#c00",
          }}
        >
          {error}
        </div>
      )}
    </main>
  );
}
