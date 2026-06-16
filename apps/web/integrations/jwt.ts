import jwt from "jsonwebtoken";

export const signJwt = (
  payload: string | object | Buffer<ArrayBufferLike>,
  expiresIn: Parameters<typeof jwt.sign>[2]["expiresIn"],
  appSecretKey?: string,
  issuer?: string
) => {
  return jwt.sign(payload, appSecretKey ?? process.env.JWT_SECRET!, {
    expiresIn,
    issuer: issuer ?? process.env.JWT_ISSUER!,
    ...(appSecretKey ? {} : { audience: process.env.JWT_AUDIENCE! }),
  });
};

export const verifyJwt = <T>(token: string, appSecretKey?: string, issuer?: string): T => {
  return jwt.verify(token, appSecretKey ?? process.env.JWT_SECRET!, {
    issuer: issuer ?? process.env.JWT_ISSUER!,
    ...(appSecretKey ? {} : { audience: process.env.JWT_AUDIENCE! }),
  }) as T;
};
