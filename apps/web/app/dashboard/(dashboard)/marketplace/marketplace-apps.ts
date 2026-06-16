export type MarketplaceApp = {
  id: string;
  name: string;
  tagline: string;
  category: string;
  publisher: string;
  visibleOn: string;
  worksWith: string[];
  pricing: string;
  languages: string;
  supportEmail: string;
  supportSiteUrl: string;
  companyWebsiteUrl: string;
  status: "available" | "coming-soon";
  features: { title: string; description: string }[];
  iconUrl: string;
};

export const MARKETPLACE_APPS: MarketplaceApp[] = [
  {
    id: "resend",
    name: "Resend",
    tagline: "Send transactional emails to your customers without leaving StellarTools.",
    category: "Email",
    publisher: "Resend",
    visibleOn: "StellarTools Dashboard",
    worksWith: ["Customers", "Payments", "Subscriptions"],
    pricing: "Free up to 3,000 emails/mo, then $20/mo",
    languages: "English (United States)",
    supportEmail: "support@resend.com",
    supportSiteUrl: "https://resend.com/docs",
    companyWebsiteUrl: "https://resend.com",
    status: "available",
    iconUrl: "https://8rcejvvfub.ufs.sh/f/PUZcIXo3ao8IDnuauWFYzKwRMe0dbSGsfZNQBvlmITOtLkjF",
    features: [
      {
        title: "Payment receipts and invoices, automatically",
        description:
          "Every successful payment triggers a branded email receipt via Resend. Configure your template once — StellarTools handles delivery, retries, and logging so nothing slips through.",
      },
      {
        title: "Full delivery visibility inside your dashboard",
        description:
          "Track opens, bounces, and click-throughs without leaving StellarTools so your support team always knows exactly what a customer received and when.",
      },
    ],
  },
  {
    id: "loops",
    name: "Loops",
    tagline: "Trigger lifecycle email sequences from real-time payment and subscription events.",
    category: "Email automation",
    publisher: "Loops",
    visibleOn: "StellarTools Dashboard",
    worksWith: ["Customers", "Subscriptions", "Payments"],
    pricing: "Free up to 2,000 contacts, then $49/mo",
    languages: "English (United States)",
    supportEmail: "help@loops.so",
    supportSiteUrl: "https://loops.so/docs",
    companyWebsiteUrl: "https://loops.so",
    status: "coming-soon",
    iconUrl: "https://8rcejvvfub.ufs.sh/f/PUZcIXo3ao8IAZDxDCKLFrwdU65KkJi9NqmajuMtEnDOx1cT",
    features: [
      {
        title: "Sync customers the moment they pay",
        description:
          "When a customer completes their first payment in StellarTools, Loops automatically adds them to your audience and fires your onboarding sequence. No webhooks to wire up, no CSVs to export.",
      },
      {
        title: "Automate every subscription milestone",
        description:
          "Cancellations, upgrades, failed payments, trial expirations — map any StellarTools event to a Loop and keep users engaged at every stage of the lifecycle.",
      },
    ],
  },
  {
    id: "firstpromoter",
    name: "FirstPromoter",
    tagline: "Launch a referral or affiliate program that tracks commissions directly from your StellarTools revenue.",
    category: "Growth",
    publisher: "FirstPromoter",
    visibleOn: "StellarTools Dashboard",
    worksWith: ["Payments", "Customers", "Subscriptions", "Payout"],
    pricing: "Starts at $49/mo",
    languages: "English (United States)",
    supportEmail: "support@firstpromoter.com",
    supportSiteUrl: "https://docs.firstpromoter.com",
    companyWebsiteUrl: "https://firstpromoter.com",
    status: "coming-soon",
    iconUrl: "https://8rcejvvfub.ufs.sh/f/PUZcIXo3ao8IJBKCsNfEzD8FRHNolx7X5VhkTgrbjfAZPpSa",
    features: [
      {
        title: "Commissions tied to real revenue",
        description:
          "FirstPromoter reads your StellarTools payments to calculate affiliate commissions automatically. Every successful charge is attributed to the right promoter — no manual tracking, no disputes.",
      },
      {
        title: "Manage your affiliate program without switching tabs",
        description:
          "Approve applications, set commission tiers, view leaderboards, and trigger payouts directly from your StellarTools dashboard.",
      },
    ],
  },
  {
    id: "posthog",
    name: "PostHog",
    tagline:
      "Connect your revenue data to PostHog's product analytics — see which features drive conversions and retention.",
    category: "Analytics",
    publisher: "PostHog",
    visibleOn: "StellarTools Dashboard",
    worksWith: ["Dashboard home", "Subscriptions", "Customers", "Products", "Usage"],
    pricing: "Free up to 1M events/mo, then usage-based",
    languages: "English (United States)",
    supportEmail: "hey@posthog.com",
    supportSiteUrl: "https://posthog.com/docs",
    companyWebsiteUrl: "https://posthog.com",
    status: "coming-soon",
    features: [
      {
        title: "Revenue events in your product funnels",
        description:
          "Pipe payment, subscription, and churn events from StellarTools into PostHog as custom events. Build funnels that show the full journey from first visit to paid customer.",
      },
      {
        title: "Segment product analytics by revenue tier",
        description:
          "StellarTools enriches PostHog person profiles with plan, MRR, and payment status so you can filter session recordings, feature flags, and experiments by what customers actually pay.",
      },
    ],
    iconUrl: "https://8rcejvvfub.ufs.sh/f/PUZcIXo3ao8InYN939nBaHU7t1CPbms8dX3phBTJclYyExAK",
  },
];

export function getMarketplaceApp(id: string) {
  return MARKETPLACE_APPS.find((a) => a.id === id);
}
