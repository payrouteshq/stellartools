export const FREE_THRESHOLD_USD = 10_000;
export const BPS_DENOMINATOR = 10_000;

export const TIER_RATE_BPS = {
  FREE: 0,
  STANDARD: 70, // 0.7%
  GROWTH: 50, // 0.5%
  SCALE: 40, // 0.4%
} as const;

export const getVolumeTierRateBps = (lifetimeVolumeUsd: number): number => {
  if (lifetimeVolumeUsd <= FREE_THRESHOLD_USD) return TIER_RATE_BPS.FREE;
  if (lifetimeVolumeUsd <= 1_000_000) return TIER_RATE_BPS.STANDARD;
  if (lifetimeVolumeUsd <= 5_000_000) return TIER_RATE_BPS.GROWTH;
  return TIER_RATE_BPS.SCALE;
};
