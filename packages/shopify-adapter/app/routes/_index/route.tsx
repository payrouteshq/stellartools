import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return { showForm: Boolean(login) };
};

export default function LandingPage() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>StellarTools Payments</h1>
        <p className={styles.text}>
          Accept USDC, XLM, EURC and any Stellar asset directly in your Shopify
          storeno bank account required.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Connect store
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Crypto-native checkout.</strong> Shoppers pay with any
            Stellar asset. Funds settle directly to your walletno
            intermediaries.
          </li>
          <li>
            <strong>Instant settlement.</strong> Stellar transactions confirm in
            under 5 seconds. No chargebacks, no holds.
          </li>
          <li>
            <strong>Global by default.</strong> Accept payments from anywhere in
            the world without currency conversion fees.
          </li>
        </ul>
      </div>
    </div>
  );
}
