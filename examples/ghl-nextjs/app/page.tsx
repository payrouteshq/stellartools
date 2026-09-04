"use client";

import React from "react";

export default function GhlSimulatorPage() {
  const [publishableKey, setPublishableKey] = React.useState("pk_test_test-location");
  const [amount, setAmount] = React.useState("10.00");
  const [currency, setCurrency] = React.useState("USD");
  const [mode, setMode] = React.useState<"payment" | "subscription">("payment");
  const [locationId, setLocationId] = React.useState("test-location");
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const iframeUrl = "http://localhost:3000/ghl/checkout";

  const handleSendInitProps = () => {
    if (!iframeRef.current?.contentWindow) return;
    const props = {
      type: "payment_initiate_props",
      publishableKey,
      amount: Number(amount),
      currency,
      mode,
      contact: { id: "c1", name: "Test Customer", email: "test@example.com" },
      transactionId: `tx_${Date.now()}`,
      locationId,
      ...(mode === "subscription" ? { subscriptionId: `sub_${Date.now()}` } : {}),
    };

    iframeRef.current.contentWindow.postMessage(props, "*");
  };

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: "900px", margin: "0 auto" }}>
      <h1>GoHighLevel Payment Simulator</h1>
      <p style={{ color: "#666" }}>
        Simulates HighLevel launching the StellarTools checkout iframe and posting initial checkout properties.
      </p>

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1fr 1fr", marginBottom: "2rem" }}>
        <label>
          Publishable Key:
          <input
            type="text"
            value={publishableKey}
            onChange={(e) => setPublishableKey(e.target.value)}
            style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
          />
        </label>

        <label>
          Location ID:
          <input
            type="text"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
          />
        </label>

        <label>
          Amount:
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
          />
        </label>

        <label>
          Currency:
          <input
            type="text"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
          />
        </label>

        <label>
          Mode:
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
            style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
          >
            <option value="payment">One-Time Payment</option>
            <option value="subscription">Recurring Subscription</option>
          </select>
        </label>
      </div>

      <button
        onClick={handleSendInitProps}
        style={{
          padding: "0.75rem 1.5rem",
          background: "#000",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          marginBottom: "2rem",
        }}
      >
        Simulate GHL PostMessage Init Props
      </button>

      <h2>Embedded StellarTools Checkout Iframe</h2>
      <iframe
        ref={iframeRef}
        src={iframeUrl}
        style={{
          width: "100%",
          height: "600px",
          border: "1px solid #ccc",
          borderRadius: "8px",
        }}
      />
    </div>
  );
}
