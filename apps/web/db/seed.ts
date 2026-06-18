import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { nanoid } from "nanoid";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle({ client, schema });

const ORG_ID = "org_b5RGM5fKf9YjJzWD37ZPe0MAxocjs";
const ENV = "testnet" as const;

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const fake = {
  txHash: () => [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join(""),
  wallet: () => "G" + [...Array(55)].map(() => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"[Math.floor(Math.random() * 32)]).join(""),
};

async function seed() {
  console.log("Seeding database…");

  // ── Products ─────────────────────────────────────────────────────────────
  const productIds = {
    starter:  `prod_${nanoid(25)}`,
    pro:      `prod_${nanoid(25)}`,
    oneTime:  `prod_${nanoid(25)}`,
  };

  await db.insert(schema.products).values([
    {
      id: productIds.starter,
      organizationId: ORG_ID,
      name: "Starter",
      description: "Perfect for small teams",
      priceCents: 1900,
      currencyCode: "USD",
      type: "subscription",
      recurringPeriod: "month",
      status: "active",
      environment: ENV,
    },
    {
      id: productIds.pro,
      organizationId: ORG_ID,
      name: "Pro",
      description: "For growing businesses",
      priceCents: 4900,
      currencyCode: "USD",
      type: "subscription",
      recurringPeriod: "month",
      status: "active",
      environment: ENV,
    },
    {
      id: productIds.oneTime,
      organizationId: ORG_ID,
      name: "One-time setup",
      description: "One-time onboarding fee",
      priceCents: 9900,
      currencyCode: "USD",
      type: "one_time",
      status: "active",
      environment: ENV,
    },
  ]).onConflictDoNothing();

  // ── Customers ────────────────────────────────────────────────────────────
  const customerData = [
    { name: "Alice Mercer",    email: "alice@acme.io"      },
    { name: "Bob Hartley",     email: "bob@hartleyco.com"  },
    { name: "Carol Nguyen",    email: "carol@brickyard.dev"},
    { name: "Dan Okafor",      email: "dan@okafor.tech"    },
    { name: "Eve Strauss",     email: "eve@strauss.co"     },
    { name: "Frank Lim",       email: "frank@limworks.io"  },
    { name: "Grace Petrov",    email: "grace@petrovdesign.com"},
    { name: "Henry Wu",        email: "henry@wuventures.io"},
    { name: "Isla Brennan",    email: "isla@brennanmedia.co"},
    { name: "Jake Monroe",     email: "jake@monroestudio.dev"},
    { name: "Kim Park",        email: "kim@parkanalytics.io"},
    { name: "Leo Santos",      email: "leo@santosdigital.co"},
  ].map((c, i) => ({
    ...c,
    id: `cust_${nanoid(25)}`,
    organizationId: ORG_ID,
    environment: ENV,
    createdAt: daysAgo(i * 2 + 1),
    updatedAt: daysAgo(i * 2 + 1),
  }));

  await db.insert(schema.customers).values(customerData).onConflictDoNothing();

  // ── Customer wallets ─────────────────────────────────────────────────────
  const wallets = customerData.map((c) => ({
    id: `wallet_${nanoid(25)}`,
    customerId: c.id,
    organizationId: ORG_ID,
    address: fake.wallet(),
    environment: ENV,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));

  await db.insert(schema.customerWallets).values(wallets).onConflictDoNothing();

  // ── Subscriptions ────────────────────────────────────────────────────────
  // 7 active, 2 trial, 1 canceled
  type SubRow = typeof schema.subscriptions.$inferInsert;
  const subscriptions: SubRow[] = [
    // active subscriptions (pro)
    ...customerData.slice(0, 5).map((c, i) => ({
      id: `sub_${nanoid(25)}`,
      customerId: c.id,
      productId: productIds.pro,
      organizationId: ORG_ID,
      status: "active" as const,
      currentPeriodStart: daysAgo(15 + i),
      currentPeriodEnd: daysAgo(-15 + i),
      environment: ENV,
      trialDays: 0,
      customerWalletId: wallets[i].id,
      createdAt: daysAgo(15 + i),
      updatedAt: daysAgo(1),
    })),
    // active subscriptions (starter)
    ...customerData.slice(5, 7).map((c, i) => ({
      id: `sub_${nanoid(25)}`,
      customerId: c.id,
      productId: productIds.starter,
      organizationId: ORG_ID,
      status: "active" as const,
      currentPeriodStart: daysAgo(10 + i),
      currentPeriodEnd: daysAgo(-20 + i),
      environment: ENV,
      trialDays: 0,
      customerWalletId: wallets[5 + i].id,
      createdAt: daysAgo(10 + i),
      updatedAt: daysAgo(1),
    })),
    // trialing
    ...customerData.slice(7, 9).map((c, i) => ({
      id: `sub_${nanoid(25)}`,
      customerId: c.id,
      productId: productIds.pro,
      organizationId: ORG_ID,
      status: "trialing" as const,
      currentPeriodStart: daysAgo(3 + i),
      currentPeriodEnd: daysAgo(-11 + i),
      environment: ENV,
      trialDays: 14,
      customerWalletId: wallets[7 + i].id,
      createdAt: daysAgo(3 + i),
      updatedAt: daysAgo(1),
    })),
    // canceled
    {
      id: `sub_${nanoid(25)}`,
      customerId: customerData[9].id,
      productId: productIds.starter,
      organizationId: ORG_ID,
      status: "canceled" as const,
      currentPeriodStart: daysAgo(35),
      currentPeriodEnd: daysAgo(5),
      canceledAt: daysAgo(5),
      environment: ENV,
      trialDays: 0,
      customerWalletId: wallets[9].id,
      createdAt: daysAgo(35),
      updatedAt: daysAgo(5),
    },
  ];

  await db.insert(schema.subscriptions).values(subscriptions).onConflictDoNothing();

  // ── Checkouts ─────────────────────────────────────────────────────────────
  type CheckoutRow = typeof schema.checkouts.$inferInsert;
  const checkouts: CheckoutRow[] = subscriptions.slice(0, 7).map((sub, i) => ({
    id: `chk_${nanoid(25)}`,
    organizationId: ORG_ID,
    customerId: sub.customerId,
    productId: sub.productId,
    status: "completed" as const,
    expiresAt: daysAgo(-30),
    environment: ENV,
    createdAt: daysAgo(16 + i),
    updatedAt: daysAgo(15 + i),
  }));

  // one-time checkout
  checkouts.push({
    id: `chk_${nanoid(25)}`,
    organizationId: ORG_ID,
    customerId: customerData[10].id,
    productId: productIds.oneTime,
    status: "completed" as const,
    expiresAt: daysAgo(-30),
    environment: ENV,
    createdAt: daysAgo(8),
    updatedAt: daysAgo(8),
  });

  await db.insert(schema.checkouts).values(checkouts).onConflictDoNothing();

  // ── Payments ──────────────────────────────────────────────────────────────
  type PaymentRow = typeof schema.payments.$inferInsert;
  const payments: PaymentRow[] = checkouts.slice(0, 7).map((chk, i) => ({
    id: `pay_${nanoid(25)}`,
    organizationId: ORG_ID,
    checkoutId: chk.id,
    customerId: chk.customerId,
    subscriptionId: subscriptions[i].id,
    productId: chk.productId,
    amountCents: [4900, 4900, 4900, 4900, 4900, 1900, 1900][i],
    currencyCode: "USD",
    cryptoAmount: "49.0000000",
    selectedAssetCode: "USDC",
    selectedAssetIssuer: "GA5OJOBKLD4MJEZ6SE7FCNDXKHUQAEOKPDXAZTURGNTXL6BJHPMIC6BW",
    transactionHash: fake.txHash(),
    status: "confirmed" as const,
    environment: ENV,
    createdAt: daysAgo(14 - i),
    updatedAt: daysAgo(14 - i),
  }));

  // one-time payment
  payments.push({
    id: `pay_${nanoid(25)}`,
    organizationId: ORG_ID,
    checkoutId: checkouts[7].id,
    customerId: customerData[10].id,
    productId: productIds.oneTime,
    amountCents: 9900,
    currencyCode: "USD",
    cryptoAmount: "99.0000000",
    selectedAssetCode: "USDC",
    selectedAssetIssuer: "GA5OJOBKLD4MJEZ6SE7FCNDXKHUQAEOKPDXAZTURGNTXL6BJHPMIC6BW",
    transactionHash: fake.txHash(),
    status: "confirmed" as const,
    environment: ENV,
    createdAt: daysAgo(8),
    updatedAt: daysAgo(8),
  });

  await db.insert(schema.payments).values(payments).onConflictDoNothing();

  console.log(`✓ ${customerData.length} customers`);
  console.log(`✓ ${subscriptions.length} subscriptions (7 active, 2 trial, 1 canceled)`);
  console.log(`✓ ${payments.length} payments`);
  console.log("Done.");
  await client.end();
}

seed().catch((err) => { console.error(err); process.exit(1); });
