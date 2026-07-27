import type { SparkPoint } from "@/components/stat-card";

// Deterministic PRNG (mulberry32) so charts are stable across server/client
// renders instead of drifting on every reload like Math.random() would.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildSeries(seed: number, points: number, baseline: number, spikeScale: number): SparkPoint[] {
  const rand = mulberry32(seed);
  let level = baseline * 0.3;
  const values: number[] = [];

  for (let i = 0; i < points; i++) {
    const isSpike = rand() < 0.22;
    level = isSpike
      ? baseline + spikeScale * (0.6 + rand() * 1.2)
      : Math.max(baseline * 0.15, level * 0.5 + baseline * 0.15 + (rand() - 0.5) * spikeScale * 0.15);
    values.push(Math.max(0, Math.round(level)));
  }

  return values.map((value, i) => ({ i: `d${i}`, value }));
}

export type MockOrg = {
  id: string;
  name: string;
  logoUrl?: string;
  stats: {
    activeTrials: number;
    activeSubscriptions: number;
    mrrCents: number;
    grossVolumeCents: number;
    newCustomers: number;
    totalCustomers: number;
  };
  charts: {
    trials: SparkPoint[];
    activeSubscriptions: SparkPoint[];
    mrr: SparkPoint[];
    grossVolume: SparkPoint[];
    customers: SparkPoint[];
  };
};

export const mockOrgs: MockOrg[] = [
  {
    id: "stellar-dev-foundation",
    name: "SDF",
    stats: {
      activeTrials: 16,
      activeSubscriptions: 45,
      mrrCents: 1063987,
      grossVolumeCents: 3843751,
      newCustomers: 78,
      totalCustomers: 223,
    },
    logoUrl: "https://8rcejvvfub.ufs.sh/f/PUZcIXo3ao8IUMMp30zElnS0qxHiJ6XFtLDYIBv12fdGTQgp",
    charts: {
      trials: buildSeries(1, 14, 4, 13),
      activeSubscriptions: buildSeries(2, 14, 10, 16),
      mrr: buildSeries(3, 14, 1800, 6800),
      grossVolume: buildSeries(4, 14, 5000, 21000),
      customers: buildSeries(5, 14, 35, 140),
    },
  },
  {
    id: "odii-inc",
    name: "Stellar Meridian",
    logoUrl: "https://8rcejvvfub.ufs.sh/f/PUZcIXo3ao8IJP9uAPqfEzD8FRHNolx7X5VhkTgrbjfAZPpS",
    stats: {
      activeTrials: 4,
      activeSubscriptions: 12,
      mrrCents: 214300,
      grossVolumeCents: 892100,
      newCustomers: 9,
      totalCustomers: 61,
    },
    charts: {
      trials: buildSeries(11, 14, 1, 4),
      activeSubscriptions: buildSeries(12, 14, 3, 6),
      mrr: buildSeries(13, 14, 400, 1600),
      grossVolume: buildSeries(14, 14, 1300, 5200),
      customers: buildSeries(15, 14, 10, 40),
    },
  },
];

export type MockInstalledApp = {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  iconUrl: string;
  accent: string;
  connectedSince: string;
  activity: { label: string; detail: string; time: string }[];
};

// Mirrors the real `apps` table entries for Loops and Resend (name, tagline,
// hosted iconUrl) so the demo dock looks like actually-installed marketplace
// apps rather than invented placeholders.
export const installedApps: MockInstalledApp[] = [
  {
    id: "resend",
    name: "Resend",
    slug: "resend",
    tagline: "Send transactional emails to your customers without leaving StellarTools.",
    iconUrl: "https://8rcejvvfub.ufs.sh/f/PUZcIXo3ao8IDnuauWFYzKwRMe0dbSGsfZNQBvlmITOtLkjF",
    accent: "#000000",
    connectedSince: "Connected 3 months ago",
    activity: [
      { label: "Payment receipt", detail: "sarah@acme.io", time: "2m ago" },
      { label: "Subscription renewed", detail: "j.moreno@vertex.co", time: "41m ago" },
      { label: "Refund confirmation", detail: "hello@nebula.dev", time: "3h ago" },
    ],
  },
  {
    id: "loops",
    name: "Loops",
    slug: "loops",
    tagline: "Trigger lifecycle email sequences from real-time payment and subscription events.",
    iconUrl: "https://8rcejvvfub.ufs.sh/f/PUZcIXo3ao8IAZDxDCKLFrwdU65KkJi9NqmajuMtEnDOx1cT",
    accent: "#4F46E5",
    connectedSince: "Connected 3 months ago",
    activity: [
      { label: "Payment received", detail: "→ Welcome sequence", time: "5m ago" },
      { label: "Subscription renewed", detail: "→ Upsell sequence", time: "1h ago" },
      { label: "Trial expiring in 3 days", detail: "→ Win-back sequence", time: "5h ago" },
    ],
  },
];

export const mockUser = {
  name: "Denelle Dixon",
  email: "denelle@stellar.org",
  initials: "DD",
  // Illustrated placeholder (DiceBear), not a photo of a real person —
  // swap for a real profile.avatarUrl the same way the real sidebar does.
  avatarUrl: "https://api.dicebear.com/9.x/notionists/svg?seed=denelle-dixon",
};

export function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
