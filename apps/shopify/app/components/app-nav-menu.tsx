import { useLocation } from "@remix-run/react";

export function AppNavMenu() {
  const { search } = useLocation();
  const href = (path: string) => `${path}${search}`;

  return (
    <s-app-nav>
      <s-link href={href("/app")} rel="home">
        Dashboard
      </s-link>
      <s-link href={href("/app/transactions")}>Transactions</s-link>
      <s-link href={href("/app/subscriptions")}>Subscriptions</s-link>
      <s-link href={href("/app/products")}>Products</s-link>
      <s-link href={href("/app/settings")}>Settings</s-link>
    </s-app-nav>
  );
}
