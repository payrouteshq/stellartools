/**
 * UNSTABLE — demo-only. Delete when Shopify grants Payments Partner access.
 *
 * Files to remove together:
 *   - app/routes/unstable.checkout.create-stellar.tsx
 *   - app/routes/unstable.checkout.return.tsx  (this file)
 *   - extensions/stellar-pay-checkout-ui/
 *
 * Route: GET /unstable/checkout/return
 * Customers land here after paying via the demo checkout UI extension flow.
 */
import type { LoaderFunctionArgs } from "@remix-run/node";

const STELLAR_PATHS = [
  "M211.019 0C235.091 0 258.448 4.73015 280.44 14.0644C292.191 19.0466 303.41 25.3083 313.826 32.704L311.601 33.8477L283.003 48.4647C261.165 36.3 236.3 29.8736 211.019 29.8736C210.632 29.8736 210.255 29.8736 209.868 29.8736C190.439 30.019 171.512 33.9059 153.629 41.4179C135.747 48.9299 119.712 59.7376 105.969 73.5306C77.9124 101.689 62.4576 139.123 62.4576 178.941C62.4576 185.426 62.8831 191.978 63.7149 198.414L63.9857 200.469L65.8329 199.529L422.048 17.4085V50.9267L72.6028 229.587L71.4326 230.246L44.6043 243.971L44.5753 243.923L43.3663 244.543L0 266.701V233.183L14.6521 225.69C26.9541 219.4 34.2366 206.401 33.2018 192.57C32.8633 188.062 32.6988 183.478 32.6988 178.941C32.6988 154.786 37.4185 131.349 46.7126 109.288C55.6973 87.9828 68.5505 68.8489 84.9241 52.4194C101.298 35.9899 120.37 23.0886 141.608 14.0741C163.601 4.73015 186.957 0 211.019 0Z",
  "M114.567 252.918C121.762 260.246 126.443 269.541 128.116 279.515L356.196 162.909L358.043 161.969L358.314 164.034C359.155 170.538 359.581 177.138 359.581 183.633C359.581 223.451 344.126 260.885 316.069 289.043C302.317 302.846 286.262 313.654 268.361 321.166C250.459 328.687 231.523 332.565 212.073 332.7C211.725 332.7 211.377 332.7 211.029 332.7C201.599 332.7 192.228 331.799 183.05 330.054L188.978 334.28C197.18 341.24 199.626 352.406 195.622 361.905C200.719 362.341 205.855 362.574 211.029 362.574C235.091 362.574 258.448 357.844 280.45 348.51C301.678 339.495 320.75 326.594 337.134 310.164C353.507 293.735 366.361 274.591 375.345 253.286C384.649 231.225 389.369 207.788 389.369 183.633C389.369 179.087 389.195 174.463 388.846 169.888C387.802 156.056 395.075 143.048 407.396 136.748L422.058 129.255V95.7275L114.567 252.918Z",
  "M61.945 319.605L88.2608 298.494C91.5587 295.848 90.3788 290.749 88.019 288.055L74.7982 272.992C72.922 270.85 68.9567 270.016 66.6936 271.945L41.0936 293.686C40.6003 294.103 39.0336 293.114 38.9465 292.542C37.2347 281.27 40.4166 270.83 47.6024 262.145C60.9972 246.21 84.3632 243.283 101.549 255.176C114.702 264.278 121.153 280.252 117.797 296.022L166.492 330.733L182.402 342.044C187.866 346.687 189.027 354.577 184.8 360.587C181.135 365.792 172.875 368.167 167.005 363.941L104.673 319.101C92.5065 328.629 76.0362 330.267 62.6027 323.25C62.0998 322.988 61.3067 322.329 60.9876 322.028C60.591 321.66 61.3357 320.109 61.945 319.624V319.605ZM180.467 352.629C180.448 349.11 177.585 346.261 174.065 346.28C170.554 346.299 167.711 349.169 167.73 352.697C167.75 356.225 170.612 359.065 174.133 359.046C177.643 359.026 180.487 356.157 180.467 352.629Z",
];

const svgPaths = STELLAR_PATHS.map((d) => `<path d="${d}" fill="#6366f1"/>`).join("");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Payment received — Stellar Pay</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f6f7f8;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem}
    .card{background:#fff;border-radius:12px;padding:3rem 2.5rem;max-width:480px;width:100%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)}
    .logo{display:block;margin:0 auto 1.5rem;opacity:.85}
    .badge{display:inline-flex;align-items:center;gap:.4rem;background:#ecfdf5;color:#065f46;border-radius:999px;padding:.35rem 1rem;font-size:.85rem;font-weight:600;margin-bottom:1.75rem}
    h1{font-size:1.5rem;font-weight:700;color:#111;margin-bottom:.75rem}
    p{color:#555;font-size:.95rem;line-height:1.6;margin-bottom:1rem}
    .hint{font-size:.8rem;color:#999;margin-top:.5rem}
  </style>
</head>
<body>
  <div class="card">
    <svg class="logo" width="52" height="45" viewBox="0 0 423 367" xmlns="http://www.w3.org/2000/svg">
      ${svgPaths}
    </svg>
    <div class="badge">&#10003; Payment submitted on Stellar</div>
    <h1>Thank you!</h1>
    <p>Your Stellar payment was received. The merchant has been notified and will process your order shortly.</p>
    <p class="hint">You can close this tab and return to the store.</p>
  </div>
</body>
</html>`;

export const loader = async (_: LoaderFunctionArgs) => {
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};
