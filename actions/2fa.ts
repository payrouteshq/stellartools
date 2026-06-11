"use server";

import { retrieveAccount } from "@/actions/account";
import { generateAndSetSession } from "@/actions/auth";
import { AuthProvider } from "@/constant/schema.client";
import { accounts, db } from "@/db";
import { TwoFaDisableVerificationEmail } from "@/emails/2fa-disable-verification";
import { deleteCookies, getCookie } from "@/integrations/cookie-manager";
import { sendEmail } from "@/integrations/email";
import { decrypt, encrypt } from "@/integrations/encryption";
import { signJwt, verifyJwt } from "@/integrations/jwt";
import { AppError, safeAction } from "@/lib/action-handler";
import { randomInt } from "crypto";
import { eq } from "drizzle-orm";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";

interface Pending2faPayload {
  accountId: string;
  provider: AuthProvider;
  iat: number;
  exp: number;
}

export const setup2fa = safeAction(async (accountId: string) => {
  const account = await retrieveAccount({ id: accountId });
  if (!account) throw new AppError("Account not found");

  const secret = generateSecret();
  const otpauthUrl = generateURI({ issuer: "StellarTools", label: account.email, secret });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  return { secret, qrCodeDataUrl };
});

interface Reset2faPayload {
  accountId: string;
  code: string;
}

export const initiate2faReset = safeAction(async (accountId: string) => {
  const account = await retrieveAccount({ id: accountId });
  if (!account) throw new AppError("Account not found");
  if (!account.$2faSecret) throw new AppError("2FA is not enabled on this account");

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const resetToken = signJwt({ accountId, code }, "10m");

  await sendEmail(account.email, "Your 2FA disable verification code", TwoFaDisableVerificationEmail({ code }));

  return { success: true, resetToken };
});

export const toggle2fa = safeAction(
  async (
    accountId: string,
    code: string,
    setupSecret?: string, // Only provided when enabling
    resetToken?: string // Only provided when disabling via email code
  ) => {
    const account = await retrieveAccount({ id: accountId });

    if (!account) throw new AppError("Account not found");

    const isEnabling = !!setupSecret;

    if (isEnabling) {
      const { valid } = verifySync({ token: code, secret: setupSecret });
      if (!valid) throw new AppError("Invalid verification code");

      await db
        .update(accounts)
        .set({ $2faSecret: encrypt(setupSecret), updatedAt: new Date() })
        .where(eq(accounts.id, accountId));

      return { success: true, enabled: true };
    }

    if (resetToken) {
      const payload = verifyJwt<Reset2faPayload>(resetToken);
      if (payload.accountId !== accountId) throw new AppError("Invalid verification token");
      if (payload.code !== code) throw new AppError("Invalid email verification code");
    } else {
      if (!account.$2faSecret) throw new AppError("2FA configuration not found");

      const { valid } = verifySync({ token: code, secret: decrypt(account.$2faSecret) });
      if (!valid) throw new AppError("Invalid verification code");
    }

    await db.update(accounts).set({ $2faSecret: null, updatedAt: new Date() }).where(eq(accounts.id, accountId));

    return { success: true, enabled: false };
  }
);

export const complete2fa = safeAction(async (code: string) => {
  const pendingToken = await getCookie("2fa_pending");

  if (!pendingToken) throw new AppError("Session expired. Please sign in again.");

  const payload = verifyJwt<Pending2faPayload>(pendingToken);

  const account = await retrieveAccount({ id: payload.accountId });
  if (!account) throw new AppError("Account not found");
  if (!account.$2faSecret) throw new AppError("2FA not configured");

  const { valid } = verifySync({ token: code, secret: decrypt(account.$2faSecret) });

  if (!valid) throw new AppError("Invalid verification code");

  await Promise.all([generateAndSetSession(account, payload.provider), deleteCookies(["2fa_pending"])]);

  return { success: true };
});
