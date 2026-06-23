import jwt from "jsonwebtoken";

export const signJwt = (
  payload: string | object | Buffer<ArrayBufferLike>,
  expiresIn: Parameters<typeof jwt.sign>[2]["expiresIn"],
  secretKey: string,
  issuer: string,
  audience?: string
) => {
  return jwt.sign(payload, secretKey, {
    expiresIn,
    issuer,
    ...(audience ? { audience } : {}),
  });
};

export const verifyJwt = <T>(token: string, secretKey: string, issuer: string, audience?: string): T => {
  return jwt.verify(token, secretKey, { issuer, ...(audience ? { audience } : {}) }) as T;
};

export const decodeJwt = <T>(token: string): T | null => {
  return jwt.decode(token) as T | null;
};
