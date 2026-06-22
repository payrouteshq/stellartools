import jwt from "jsonwebtoken";

const ISSUER = "STELLARTOOLS";

/**
 * Sign a JWT with your app secret. Use this in your BFF routes to authenticate
 * server-to-server requests to the StellarTools API.
 *
 * Required env vars: STELLARTOOLS_APP_SECRET
 */
export const signJwt = (payload: object, expiresIn: Parameters<typeof jwt.sign>[2]["expiresIn"]) => {
  return jwt.sign(payload, process.env.STELLARTOOLS_APP_SECRET!, { expiresIn, issuer: ISSUER });
};

/**
 * Verify and decode an appToken signed by the StellarTools platform.
 * Use this in BFF routes to extract the verified installation context.
 *
 * Required env vars: STELLARTOOLS_APP_SECRET
 */
export const verifyJwt = <T>(token: string): T => {
  return jwt.verify(token, process.env.STELLARTOOLS_APP_SECRET!, { issuer: ISSUER }) as T;
};
