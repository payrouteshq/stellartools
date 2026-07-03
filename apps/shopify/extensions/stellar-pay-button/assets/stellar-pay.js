(function () {
  const btn = document.getElementById("stellar-pay-btn");
  const errEl = document.getElementById("stellar-pay-error");
  if (!btn) return;

  // Store original label before any mutations
  const originalText = btn.textContent.trim();

  btn.addEventListener("click", async function () {
    btn.disabled = true;
    btn.textContent = "Creating checkout…";
    errEl.style.display = "none";

    try {
      const cartRes = await fetch("/cart.js");
      const cart = await cartRes.json();

      if (!cart.total_price || cart.item_count === 0) {
        throw new Error("Your cart is empty.");
      }

      const shopDomain = btn.dataset.shop || window.Shopify?.shop;
      const currency = window.Shopify?.currency?.active || cart.currency || "USD";
      const returnUrl = window.location.origin + "/cart?stellar_paid=1";

      const res = await fetch("/apps/stellar-pay/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_cents: cart.total_price,
          currency_code: currency,
          customer_email: window.__st?.cid || undefined,
          shop_domain: shopDomain,
          return_url: returnUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.checkout_url) {
        throw new Error(data.error || "Failed to create checkout");
      }

      window.location.href = data.checkout_url;
    } catch (err) {
      errEl.textContent = err.message || "Something went wrong. Please try again.";
      errEl.style.display = "block";
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
})();
