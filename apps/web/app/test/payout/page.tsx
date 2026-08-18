"use client";

import React from "react";

export default function TestPayoutPage() {
  const [assetCode, setAssetCode] = React.useState("USDC");
  const [amount, setAmount] = React.useState("1");
  const [currency, setCurrency] = React.useState("NGN");
  const [country, setCountry] = React.useState("NG");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/offramp-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetCode,
          amount,
          destinationCurrency: currency,
          destinationCountry: country,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      window.open(data.interactiveUrl, "_blank");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 420, margin: "60px auto", fontFamily: "system-ui", padding: "0 16px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>SEP-38 Payout Test</h1>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 24 }}>
        Unauthenticated test page. Submitting triggers the full SEP-38 quote + SEP-24 withdrawal flow
        and opens the anchor reference UI in a new tab.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label style={{ fontSize: 13 }}>
          Asset
          <select
            value={assetCode}
            onChange={(e) => setAssetCode(e.target.value)}
            style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
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
            style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
          />
        </label>

        <label style={{ fontSize: 13 }}>
          Destination Currency
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
          >
            <option value="NGN">NGN</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
            <option value="EUR">EUR</option>
          </select>
        </label>

        <label style={{ fontSize: 13 }}>
          Country (2-letter code)
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value.toUpperCase())}
            maxLength={2}
            style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{ padding: "10px 0", fontSize: 15, cursor: loading ? "wait" : "pointer" }}
        >
          {loading ? "Initiating..." : "Submit & Open Reference UI"}
        </button>

        {error && (
          <div style={{ background: "#fee", border: "1px solid #fcc", borderRadius: 6, padding: 12, fontSize: 13 }}>
            {error}
          </div>
        )}
      </form>
    </main>
  );
}
