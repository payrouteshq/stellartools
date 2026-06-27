import { Checkout, Customer, Subscription } from "@stellartools/core";

export interface BillingConfig {
  /**
   * The API key for the Stellar Tools API.
   */
  api_key: string;

  /**
   * Whether to automatically create a customer when a user is created.
   * @default false
   */
  create_customer_on_sign_up?: boolean;

  /**
   * The function to call when a customer is created.
   */
  on_customer_created?: (customer: Customer) => Promise<void>;

  /**
   * The function to call when a checkout is completed.
   */
  on_checkout_complete?: (data: Checkout) => Promise<void>;

  /**
   * The function to call when a subscription is created.
   */
  on_subscription_created?: (data: Subscription) => Promise<void>;

  /**
   * The function to call when a subscription is canceled.
   */
  on_subscription_canceled?: (data: Subscription) => Promise<void>;

  /**
   * The function to call when a subscription is updated.
   */
  on_subscription_updated?: (data: Subscription) => Promise<void>;
}
