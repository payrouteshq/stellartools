import { defineMiddlewares } from "@medusajs/framework/http";

export default defineMiddlewares({
  routes: [
    {
      // Preserve raw body for HMAC signature verification
      matcher: "/hooks/payment/*",
      method: ["GET", "POST"],
      bodyParser: { preserveRawBody: true },
    },
  ],
});
