import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form } from "@remix-run/react";
import { login } from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return login(request);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  return login(request);
};

export default function AuthLogin() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>StellarTools Payments</h1>
        <p style={{ color: "#666", marginBottom: 24 }}>Enter your Shopify store domain to install the app.</p>
        <Form method="post">
          <input
            name="shop"
            placeholder="your-store.myshopify.com"
            style={{
              width: "100%",
              padding: "10px 14px",
              fontSize: 14,
              border: "1px solid #ddd",
              borderRadius: 6,
              marginBottom: 12,
              boxSizing: "border-box",
            }}
          />
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "10px 14px",
              background: "#fdda24",
              color: "#0f0f0f",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Install app
          </button>
        </Form>
      </div>
    </div>
  );
}
