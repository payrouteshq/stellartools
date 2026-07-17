import { Checkout, Customer, Subscription } from "@stellartools/core";

export interface BillingConfig {
  /** Your StellarTools API key. */
  apiKey: string;

  /** Automatically create a Stellar customer when a user signs up. Defaults to `false`. */
  createCustomerOnSignUp?: boolean;

  /** Called after a customer is created or linked. */
  onCustomerCreated?: (customer: Customer) => Promise<void>;

  /** Called when a checkout is completed. */
  onCheckoutComplete?: (data: Checkout) => Promise<void>;

  /** Called when a subscription is created. */
  onSubscriptionCreated?: (data: Subscription) => Promise<void>;

  /** Called when a subscription is canceled. */
  onSubscriptionCanceled?: (data: Subscription) => Promise<void>;

  /** Called when a subscription is updated. */
  onSubscriptionUpdated?: (data: Subscription) => Promise<void>;
}
