"use server";

import { postAccount, putAccount, retrieveAccount } from "@/actions/account";
import { Account, Auth, PasswordReset, auth, db, passwordReset } from "@/db";
import { deleteCookies, getCookie, setCookies } from "@/integrations/cookie-manager";
import { sendEmail } from "@/integrations/email";
import { signJwt, verifyJwt } from "@/integrations/jwt";
import { AppError } from "@/lib/error-handler";
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

  if (!response) throw new AppError("Failed to create auth");

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

  if (!response) throw new AppError("Failed to update auth");

  return response;
};

export const deleteAuth = async (id: string) => {
  const [response] = await db.delete(auth).where(eq(auth.id, id)).returning();

  if (!response) throw new AppError("Failed to delete auth");

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

  if (!result) throw new AppError("Failed to create password reset token");

  return result;
};

export const retrievePasswordReset = async (params: { id: string } | { token: string }) => {
  const whereClause = "id" in params ? eq(passwordReset.id, params.id) : eq(passwordReset.token, params.token);

  const [result] = await db.select().from(passwordReset).where(whereClause).limit(1);

  if (!result) throw new AppError("Password reset not found");

  return result;
};

export const putPasswordReset = async (id: string, params: Partial<PasswordReset>) => {
  const [result] = await db
    .update(passwordReset)
    .set({ ...params, updatedAt: new Date() })
    .where(eq(passwordReset.id, id))
    .returning();

  if (!result) throw new AppError("Failed to update password reset");

  return result;
};

export const deletePasswordReset = async (id: string) => {
  const [result] = await db.delete(passwordReset).where(eq(passwordReset.id, id)).returning();

  if (!result) throw new AppError("Failed to delete password reset");

  return result;
};

// -- Auth Internal --

const generateAndSetSession = async (account: { id: string; email: string }) => {
  const payload = { accountId: account.id, email: account.email };

  const accessToken = signJwt(payload, "6h");
  const refreshToken = signJwt(payload, "30d");

  await setCookies([
    { key: "accessToken", value: accessToken, maxAge: 6 * 60 * 60 }, // 6 hours
    { key: "refreshToken", value: refreshToken, maxAge: 30 * 24 * 60 * 60 }, // 30 days
  ]);

  return { accessToken, refreshToken };
};

export const accountValidator = async (
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
      throw new AppError("Account not found. Please sign up first.");
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
        throw new AppError("An account with this email already exists.");
      }

      if (!existingSso) {
        throw new AppError("This account was created using social login");
      }

      const isValid = await bcrypt.compare(rawSub, existingSso.sub);
      if (!isValid) throw new AppError("Invalid email or password.");
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

  // 3. Session Generation
  const { accessToken, refreshToken } = await generateAndSetSession(account);
  await postAuth({
    accountId: account.id,
    provider,
    accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    isRevoked: false,
    ...(sessionMetadata && { metadata: sessionMetadata }),
  });

  return { accountId: account.id, accessToken, refreshToken, isNewUser };
};

export const forgotPassword = async (email: string) => {
  const account = await retrieveAccount({ email });

  if (!account) return { success: true };

  const resetToken = await createPasswordResetToken({
    accountId: account.id,
    expiresAt: moment().add(1, "hours").toDate(),
  });

  const resetLink = `${process.env.NEXT_PUBLIC_DASHBOARD_URL}/reset-password?token=${resetToken.token}`;

  await sendEmail(email, "Reset Password", `<a href="${resetLink}">Reset Password</a>`);

  return { success: true };
};

export const resetPassword = async (token: string, newPassword: string) => {
  const resetTokenRecord = await retrievePasswordReset({ token });

  if (!resetTokenRecord) {
    throw new AppError("Invalid or expired reset token");
  }

  const account = await retrieveAccount({ id: resetTokenRecord.accountId });

  if (!account) throw new AppError("Account not found");

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

  await putAccount(account.id, {
    sso: {
      values: [...account.sso.values.filter((s) => s.provider !== "local"), { provider: "local", sub: passwordHash }],
    },
  });

  await putPasswordReset(resetTokenRecord.id, { usedAt: new Date() });

  return { success: true };
};

interface CurrentUserPayload {
  accountId: string;
  email: string;
  iat: number;
  exp: number;
}

export const getCurrentUser = async () => {
  const accessToken = await getCookie("accessToken");

  if (!accessToken) return null;

  const payload = verifyJwt<CurrentUserPayload>(accessToken);

  const authRecord = await retrieveAuth({ accountId: payload.accountId }, { lastActive: true });

  if (!authRecord) return null;

  if (authRecord.isRevoked || new Date() > authRecord.expiresAt) {
    await deleteCookies(["accessToken", "refreshToken"]);
    return null;
  }

  const account = await retrieveAccount({ id: payload.accountId });
  if (!account) {
    await deleteCookies(["accessToken", "refreshToken"]);
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
  };
};

export const signOut = async () => {
  const accessToken = await getCookie("accessToken");

  if (accessToken) {
    try {
      const payload = verifyJwt<CurrentUserPayload>(accessToken);

      const authRecord = await retrieveAuth({ accountId: payload.accountId }, { lastActive: true });

      if (authRecord) await putAuth(authRecord.id, { isRevoked: true });
    } catch (error) {
      console.error("Error revoking token:", error);
    }
  }

  await deleteCookies(["accessToken", "refreshToken", "selectedOrg"]);

  return { success: true };
};
