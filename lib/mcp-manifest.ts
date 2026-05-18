import * as balance from "../app/api/balance/route";
import * as checkoutId from "../app/api/checkout/[id]/route";
import * as customersId from "../app/api/customers/[customerId]/route";
import * as customers from "../app/api/customers/route";
import * as paymentId from "../app/api/payment/[id]/route";
import * as payment from "../app/api/payment/route";
import * as productId from "../app/api/product/[id]/route";
import * as product from "../app/api/product/route";
import * as refunds from "../app/api/refunds/route";
import * as subscriptionsId from "../app/api/subscriptions/[id]/route";
import * as subscriptions from "../app/api/subscriptions/route";

export const forceLoad = [
  customers,
  customersId,
  balance,
  checkoutId,
  productId,
  product,
  payment,
  paymentId,
  subscriptions,
  subscriptionsId,
  refunds,
];
