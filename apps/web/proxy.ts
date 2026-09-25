import { NextRequest, NextResponse } from "next/server";

export default async function middleware(req: NextRequest): Promise<NextResponse> {
  const host = req.headers.get("host");

  if (!host) return new NextResponse("Missing Host header", { status: 400 });

  const url = req.nextUrl.clone();

  if (url.pathname.startsWith("/.well-known/")) {
    url.pathname = `/api/well-known/${url.pathname.slice("/.well-known/".length)}`;
    return NextResponse.rewrite(url);
  }

  // Vercel Cron (see vercel.json) always hits the app's primary domain with
  // the route's real, already-prefixed path — serve it as-is before any
  // host-based prefixing below gets a chance to prepend or override it.
  if (url.pathname.startsWith("/dashboard/~api/cron/")) {
    return NextResponse.rewrite(url);
  }

  let prefix = "/api";

  const apiHosts = process.env.NEXT_PUBLIC_API_URL?.split(",").map((url) => new URL(url.trim()).host) ?? [];

  if (apiHosts.includes(host)) {
    prefix = "/api";
  } else if (process.env.NEXT_PUBLIC_INVOICE_URL && host === new URL(process.env.NEXT_PUBLIC_INVOICE_URL).host) {
    prefix = "/invoice";
  } else if (host == new URL(process.env.NEXT_PUBLIC_DASHBOARD_URL!).host) {
    prefix = "/dashboard";
  } else if (host == new URL(process.env.NEXT_PUBLIC_CHECKOUT_URL!).host) {
    prefix = "/checkout";
  } else if (host == new URL(process.env.NEXT_PUBLIC_PORTAL_URL!).host) {
    prefix = "/portal";
  } else if (host == new URL(process.env.NEXT_PUBLIC_APP_URL!).host) {
    prefix = "/landing";
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-url", `${req.nextUrl.pathname}${req.nextUrl.search}`);

  url.pathname = `${prefix}${url.pathname}`;

  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /_next (Next.js internals)
     * 2. /_static (inside /public)
     * 3. all root files inside /public (e.g. /favicon.ico)
     */
    "/((?!_next/|_static/|images/|_vercel|[\\w-]+\\.\\w+).*)",
  ],
};
