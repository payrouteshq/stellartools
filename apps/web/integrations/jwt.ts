import jwt from "jsonwebtoken";

export const signJwt = (
  payload: string | object | Buffer<ArrayBufferLike>,
  expiresIn: Parameters<typeof jwt.sign>[2]["expiresIn"]
) => {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn,
    issuer: process.env.JWT_ISSUER!,
    audience: process.env.JWT_AUDIENCE!,
  });
};

export const verifyJwt = <T>(token: string): T => {
  return jwt.verify(token, process.env.JWT_SECRET!, {
    issuer: process.env.JWT_ISSUER!,
    audience: process.env.JWT_AUDIENCE!,
  }) as T;
};
