import jwt from "jsonwebtoken";

type StellarPayload = {
  orgId: string;
  instId: string;
  scopes: string[];
  env: string;
};


export const signJwt = (payload: object, expiresIn: Parameters<typeof jwt.sign>[2]["expiresIn"]) => {
  return jwt.sign(payload, process.env.STELLARTOOLS_APP_SECRET!, {
    expiresIn,
    issuer: process.env.STELLARTOOLS_APP_ID!,
  });
};

export function stellarFetch(path: string, payload: StellarPayload, init?: RequestInit) {
  const token = signJwt(
    { appId: process.env.STELLARTOOLS_APP_ID!, ...payload },
    "1h"
  );
  return fetch(`${process.env.STELLARTOOLS_API_URL!}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      "x-stellartools-app-token": token,
    },
  });
}
