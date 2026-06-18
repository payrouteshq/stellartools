export function stellarFetch(path: string, appToken: string, init?: RequestInit) {
  return fetch(`${process.env.STELLARTOOLS_API_URL!}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      "x-stellartools-app-token": appToken,
    },
  });
}
