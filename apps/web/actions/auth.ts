"use server";

import { postAccount, putAccount, retrieveAccount } from "@/actions/account";
import { AuthProvider } from "@/constant/schema.client";
import { Account, Auth, PasswordReset, auth, db, passwordReset } from "@/db";
import { deleteCookies, getCookie, setCookies } from "@/integrations/cookie-manager";
import { sendEmail } from "@/integrations/email";
import { AppError, safeAction } from "@/lib/action-handler";
import { STELLARTOOLS_ID, signJwt, verifyJwt } from "@stellartools/core";
import bcrypt from "bcryptjs";
import { desc, eq } from "drizzle-orm";
import moment from "moment";
import { nanoid } from "nanoid";

const BCRYPT_SALT_ROUNDS = 10;

// -- Auth --

export const postAuth = async (params: Partial<Auth>): Promise<Auth> => {
  const [response] = await db
    .insert(auth)
    .values({ id: `au_${nanoid(25)}`, ...params } as Auth)
    .returning();

  if (!response) throw new AppError("INTERNAL_ERROR", "Failed to create auth");

  return response;
};

export const retrieveAuth = async (
  params: { id: string } | { accountId: string },
  filter?: { lastActive?: boolean }
) => {
  const whereClause = "id" in params ? eq(auth.id, params.id) : eq(auth.accountId, params.accountId);

  const query = db.select().from(auth).where(whereClause);

  const [response] = await (filter?.lastActive ? query.orderBy(desc(auth.createdAt)).limit(1) : query.limit(1));

  if (!response) return null;

  return response;
};

export const putAuth = async (id: string, params: Partial<Auth>) => {
  const [response] = await db
    .update(auth)
    .set({ ...params, updatedAt: new Date() })
    .where(eq(auth.id, id))
    .returning();

  if (!response) throw new AppError("INTERNAL_ERROR", "Failed to update auth");

  return response;
};

export const deleteAuth = async (id: string) => {
  const [response] = await db.delete(auth).where(eq(auth.id, id)).returning();

  if (!response) throw new AppError("INTERNAL_ERROR", "Failed to delete auth");

  return response;
};

// -- Password Reset --

export const createPasswordResetToken = async (params: Partial<PasswordReset>) => {
  const [result] = await db
    .insert(passwordReset)
    .values({
      ...params,
      usedAt: null,
      id: `pr_${nanoid(25)}`,
      token: `pr+tok_${nanoid(64)}`,
    } as PasswordReset)
    .returning();

  if (!result) throw new AppError("INTERNAL_ERROR", "Failed to create password reset token");

  return result;
};

export const retrievePasswordReset = async (params: { id: string } | { token: string }) => {
  const whereClause = "id" in params ? eq(passwordReset.id, params.id) : eq(passwordReset.token, params.token);

  const [result] = await db.select().from(passwordReset).where(whereClause).limit(1);

  if (!result) throw new AppError("NOT_FOUND", "Password reset not found");

  return result;
};

export const putPasswordReset = async (id: string, params: Partial<PasswordReset>) => {
  const [result] = await db
    .update(passwordReset)
    .set({ ...params, updatedAt: new Date() })
    .where(eq(passwordReset.id, id))
    .returning();

  if (!result) throw new AppError("INTERNAL_ERROR", "Failed to update password reset");

  return result;
};

export const deletePasswordReset = async (id: string) => {
  const [result] = await db.delete(passwordReset).where(eq(passwordReset.id, id)).returning();

  if (!result) throw new AppError("INTERNAL_ERROR", "Failed to delete password reset");

  return result;
};

// -- Auth Internal --

export const createSession = async (account: Account, provider: string) => {
  const payload = { accountId: account.id, email: account.email };
  const accessToken = signJwt(payload, "6h", process.env.JWT_SECRET!, STELLARTOOLS_ID);
  const refreshToken = signJwt(payload, "30d", process.env.JWT_SECRET!, STELLARTOOLS_ID);

  // 1. Set Cookies
  await setCookies([
    { key: "accessToken", value: accessToken, maxAge: 21600 }, // 6h
    { key: "refreshToken", value: refreshToken, maxAge: 2592000 }, // 30d
  ]);

  // 2. Record in DB
  await db.insert(auth).values({
    id: `au_${nanoid(25)}`,
    accountId: account.id,
    provider: provider as any,
    accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + 2592000000), // 30d
    isRevoked: false,
  });

  return { accessToken, refreshToken };
};

export const generateAndSetSession = async (
  account: { id: string; email: string },
  provider: AuthProvider,
  sessionMetadata?: Record<string, unknown>
) => {
  const payload = { accountId: account.id, email: account.email };

  const [accessToken, refreshToken] = [
    signJwt(payload, "6h", process.env.JWT_SECRET!, STELLARTOOLS_ID),
    signJwt(payload, "30d", process.env.JWT_SECRET!, STELLARTOOLS_ID),
  ];

  await Promise.all([
    setCookies([
      { key: "accessToken", value: accessToken, maxAge: 6 * 60 * 60 }, // 6 hours
      { key: "refreshToken", value: refreshToken, maxAge: 30 * 24 * 60 * 60 }, // 30 days
    ]),

    db.insert(auth).values({
      id: `au_${nanoid(25)}`,
      accountId: account.id,
      provider,
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + 2592000000), // 30d
      isRevoked: false,
      ...(sessionMetadata && { metadata: sessionMetadata }),
    }),
  ]);

  return { accessToken, refreshToken };
};

export const accountValidator = safeAction(
  async (
    email: string,
    sso: Account["sso"]["values"][number],
    intent: "SIGN_IN" | "SIGN_UP",
    profile?: Account["profile"],
    sessionMetadata?: Record<string, unknown>
  ) => {
    const { provider, sub: rawSub } = sso;
    let account = await retrieveAccount({ email });
    const isNewUser = !account;

    if (!account) {
      if (intent === "SIGN_IN" && provider === "local") {
        throw new AppError("NOT_FOUND", "Account not found. Please sign up first.");
      }

      const sub = provider === "local" ? await bcrypt.hash(rawSub, BCRYPT_SALT_ROUNDS) : rawSub;

      account = await postAccount({
        email,
        sso: { values: [{ provider, sub }] },
        profile: profile ?? null,
      });
    } else {
      const existingSso = account.sso?.values?.find((s) => s.provider === provider);

      if (provider === "local") {
        if (intent === "SIGN_UP") {
          throw new AppError("CONFLICT", "An account with this email already exists.");
        }

        if (!existingSso) {
          throw new AppError("VALIDATION_ERROR", "This account was created using social login");
        }

        const isValid = await bcrypt.compare(rawSub, existingSso.sub);
        if (!isValid) throw new AppError("VALIDATION_ERROR", "Invalid email or password.");
      } else {
        // SSO Provider (Google, GitHub, etc.)
        // We trust SSO providers to verify email. If account exists but this SSO isn't linked, link it.
        if (!existingSso) {
          await putAccount(account.id, {
            sso: { values: [...account.sso.values, { provider, sub: rawSub }] },
            ...(profile?.avatarUrl && { profile: { ...account.profile, avatarUrl: profile.avatarUrl } }),
          });
        }
      }
    }

    if (account.$2faSecret) {
      const pendingToken = signJwt({ accountId: account.id, provider }, "5m", process.env.JWT_SECRET!, STELLARTOOLS_ID);
      await setCookies([{ key: "2fa_pending", value: pendingToken, maxAge: 5 * 60 }]);
      return { requires2fa: true as const };
    }

    const { accessToken, refreshToken } = await generateAndSetSession(account, provider, sessionMetadata);

    return { accountId: account.id, accessToken, refreshToken, isNewUser };
  }
);

export const forgotPassword = safeAction(async (email: string) => {
  const account = await retrieveAccount({ email });

  if (!account) return { success: true };

  const resetToken = await createPasswordResetToken({
    accountId: account.id,
    expiresAt: moment().add(1, "hours").toDate(),
  });

  const resetLink = `${process.env.NEXT_PUBLIC_DASHBOARD_URL}/reset-password?token=${resetToken.token}`;

  await sendEmail(email, "Reset Password", `<a href="${resetLink}">Reset Password</a>`);

  return { success: true };
});

export const resetPassword = safeAction(async (token: string, newPassword: string) => {
  const resetTokenRecord = await retrievePasswordReset({ token });

  if (!resetTokenRecord) {
    throw new AppError("VALIDATION_ERROR", "Invalid or expired reset token");
  }

  const account = await retrieveAccount({ id: resetTokenRecord.accountId });

  if (!account) throw new AppError("NOT_FOUND", "Account not found");

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

  await putAccount(account.id, {
    sso: {
      values: [...account.sso.values.filter((s) => s.provider !== "local"), { provider: "local", sub: passwordHash }],
    },
  });

  await putPasswordReset(resetTokenRecord.id, { usedAt: new Date() });

  return { success: true };
});

interface CurrentUserPayload {
  accountId: string;
  email: string;
  iat: number;
  exp: number;
}

export const getCurrentUser = async () => {
  const accessToken = await getCookie("accessToken");

  if (!accessToken) return null;

  let payload: CurrentUserPayload;
  try {
    payload = verifyJwt<CurrentUserPayload>(accessToken, process.env.JWT_SECRET!, STELLARTOOLS_ID);
  } catch {
    return null;
  }

  const authRecord = await retrieveAuth({ accountId: payload.accountId }, { lastActive: true });

  if (!authRecord) return null;

  if (authRecord.isRevoked || new Date() > authRecord.expiresAt) {
    return null;
  }

  const account = await retrieveAccount({ id: payload.accountId });

  if (!account) {
    return null;
  }

  return {
    id: account.id,
    email: account.email,
    profile: {
      firstName: account.profile?.firstName || null,
      lastName: account.profile?.lastName || null,
      avatarUrl: account.profile?.avatarUrl || null,
    },
    createdAt: account.createdAt,
    $2faSecret: account.$2faSecret,
  };
};

export const signOut = async () => {
  const accessToken = await getCookie("accessToken");

  if (accessToken) {
    try {
      const payload = verifyJwt<CurrentUserPayload>(accessToken, process.env.JWT_SECRET!, STELLARTOOLS_ID);

      const authRecord = await retrieveAuth({ accountId: payload.accountId }, { lastActive: true });

      if (authRecord) await putAuth(authRecord.id, { isRevoked: true });
    } catch (error) {
      console.error("Error revoking token:", error);
    }
  }

  await deleteCookies(["accessToken", "refreshToken", "selectedOrg"]);

  return { success: true };
};
