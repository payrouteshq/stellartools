import jwt from "jsonwebtoken";

export const signJwt = (
  payload: string | object | Buffer<ArrayBufferLike>,
  expiresIn: Parameters<typeof jwt.sign>[2]["expiresIn"],
  secretKey?: string,
  issuer?: string
) => {
  return jwt.sign(payload, secretKey ?? process.env.JWT_SECRET!, {
    expiresIn,
    issuer: issuer ?? process.env.JWT_ISSUER!,
    audience: process.env.JWT_AUDIENCE!,
  });
};

export const verifyJwt = <T>(token: string, secretKey?: string, issuer?: string): T => {
  return jwt.verify(token, secretKey ?? process.env.JWT_SECRET!, {
    issuer: issuer ?? process.env.JWT_ISSUER!,
    audience: process.env.JWT_AUDIENCE!,
  }) as T;
};

export const decodeJwt = <T>(token: string): T | null => {
  return jwt.decode(token) as T | null;
};
