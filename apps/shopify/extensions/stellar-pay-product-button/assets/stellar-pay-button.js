(function () {
  function initStellarPay(wrapper) {
    var btn = wrapper.querySelector(".stellar-pay-btn");
    var label = wrapper.querySelector(".stellar-pay-label");
    var spinner = wrapper.querySelector(".stellar-pay-spinner");
    var errorEl = wrapper.querySelector(".stellar-pay-error");

    var appUrl = (wrapper.dataset.appUrl || "").replace(/\/$/, "");
    var shop = wrapper.dataset.shop;
    var currency = wrapper.dataset.currency;
    var defaultPriceCents = parseInt(wrapper.dataset.defaultPrice, 10) || 0;

    btn.addEventListener("click", async function () {
      errorEl.style.display = "none";

      if (!appUrl) {
        showError("App URL not set — add it in the theme editor block settings.");
        return;
      }

      setLoading(true);

      try {
        // Read the currently selected variant from the add-to-cart form
        var form = document.querySelector('form[action*="/cart/add"]') || document.querySelector(".product-form");
        var variantId = form && form.querySelector('[name="id"]') ? form.querySelector('[name="id"]').value : null;

        var amountCents = defaultPriceCents;

        if (variantId) {
          // Shopify's variants JSON endpoint — price is always in cents
          var varRes = await fetch("/variants/" + variantId + ".json");
          if (varRes.ok) {
            var varData = await varRes.json();
            if (varData.variant && varData.variant.price) {
              amountCents = varData.variant.price;
            }
          }
        }

        var amount = (amountCents / 100).toFixed(2);

        console.log({ shop, amount, currency });

        var res = await fetch(appUrl + "/unstable/checkout/create-stellar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shop_domain: shop,
            amount: amount,
            currency: currency,
          }),
        });

        if (!res.ok) throw new Error("Could not initialise Stellar checkout.");

        var data = await res.json();
        if (data.error) throw new Error(data.error);
        if (!data.payment_url) throw new Error("No payment URL returned.");

        window.location.href = data.payment_url;
      } catch (err) {
        showError(err.message || "Something went wrong. Please try again.");
        setLoading(false);
      }
    });

    function setLoading(on) {
      btn.disabled = on;
      label.style.display = on ? "none" : "";
      spinner.style.display = on ? "inline" : "none";
    }

    function showError(msg) {
      errorEl.textContent = msg;
      errorEl.style.display = "block";
    }
  }

  document.querySelectorAll(".stellar-pay-wrapper").forEach(initStellarPay);
})();
