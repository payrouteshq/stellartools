export const calculateUsageToCredits = (rawUsage: number, unitsPerCredit: bigint): bigint => {
  const usage = BigInt(Math.floor(rawUsage));
  const factor = unitsPerCredit > BigInt(0) ? unitsPerCredit : BigInt(1);

  const credits = usage / factor;
  const remainder = usage % factor;

  return remainder > BigInt(0) ? credits + BigInt(1) : credits;
};
