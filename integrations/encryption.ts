import "server-only";

import { AppError } from "@/lib/action-handler";
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

const getEncryptionKey = (): Buffer => {
  const key = process.env.MASTER_ENCRYPTION_KEY;
  const saltHex = process.env.ENCRYPTION_SALT;

  if (!key || !saltHex) {
    throw new AppError("Encryption configuration (KEY/SALT) not found in environment");
  }

  const salt = Buffer.from(saltHex, "hex");
  return crypto.pbkdf2Sync(key, salt, 100000, KEY_LENGTH, "sha512");
};

export const encrypt = (plaintext: string): string => {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return iv.toString("hex") + authTag.toString("hex") + encrypted;
};

export const decrypt = (encrypted: string): string => {
  const key = getEncryptionKey();

  // Extract components based on fixed lengths
  // 16 bytes = 32 hex characters
  const ivHex = encrypted.slice(0, IV_LENGTH * 2);
  const authTagHex = encrypted.slice(IV_LENGTH * 2, (IV_LENGTH + TAG_LENGTH) * 2);
  const encryptedHex = encrypted.slice((IV_LENGTH + TAG_LENGTH) * 2);

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
};

export const reencrypt = (encrypted: string): string => {
  return encrypt(decrypt(encrypted));
};
