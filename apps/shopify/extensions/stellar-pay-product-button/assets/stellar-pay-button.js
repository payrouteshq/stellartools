(function () {
  var CHECKOUT_PATH = "/apps/stellartools/checkout/create-stellar";

  function matchBuyButtonsWidth(wrapper) {
    var anchor =
      document.querySelector(".product-form__buttons") ||
      document.querySelector(".product-form__submit") ||
      document.querySelector(".shopify-payment-button");

    if (!anchor) return;

    var target = anchor.closest(".product-form__buttons") || anchor;
    var width = target.getBoundingClientRect().width;
    if (width <= 0) return;

    wrapper.style.width = width + "px";
    wrapper.style.maxWidth = "100%";
  }

  function scheduleWidthMatch(wrapper) {
    matchBuyButtonsWidth(wrapper);
    requestAnimationFrame(function () {
      matchBuyButtonsWidth(wrapper);
    });
    setTimeout(function () {
      matchBuyButtonsWidth(wrapper);
    }, 150);
  }

  function initStellarPay(wrapper) {
    scheduleWidthMatch(wrapper);
    window.addEventListener("resize", function () {
      matchBuyButtonsWidth(wrapper);
    });

    var btn = wrapper.querySelector(".stellar-pay-btn");
    var errorEl = wrapper.querySelector(".stellar-pay-error");

    var shop = wrapper.dataset.shop;
    var currency = wrapper.dataset.currency;
    var defaultPriceCents = parseInt(wrapper.dataset.defaultPrice, 10) || 0;

    btn.addEventListener("click", async function () {
      errorEl.style.display = "none";
      setLoading(true);

      try {
        var form = document.querySelector('form[action*="/cart/add"]') || document.querySelector(".product-form");
        var variantId = form && form.querySelector('[name="id"]') ? form.querySelector('[name="id"]').value : null;

        var amountCents = defaultPriceCents;

        if (variantId) {
          var varRes = await fetch("/variants/" + variantId + ".json");
          if (varRes.ok) {
            var varData = await varRes.json();
            if (varData.variant && varData.variant.price) {
              amountCents = varData.variant.price;
            }
          }
        }

        var amount = (amountCents / 100).toFixed(2);

        var res = await fetch(CHECKOUT_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shop_domain: shop,
            amount: amount,
            currency: currency,
          }),
        });

        if (!res.ok) {
          var errBody = await res.json().catch(function () {
            return {};
          });
          throw new Error(errBody.error || "Could not initialise Stellar checkout.");
        }

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
    }

    function showError(msg) {
      errorEl.textContent = msg;
      errorEl.style.display = "block";
    }
  }

  document.querySelectorAll(".stellar-pay-wrapper").forEach(initStellarPay);
})();
