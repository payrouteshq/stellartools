"use client"

import { isManual, isStellar, isStripeLike } from "@lib/constants"
import { placeOrder } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@modules/common/components/ui"
import { useElements, useStripe } from "@stripe/react-stripe-js"
import React, { useEffect, useState } from "react"
import ErrorMessage from "../error-message"

type PaymentButtonProps = {
  cart: HttpTypes.StoreCart
  "data-testid": string
}

const PaymentButton: React.FC<PaymentButtonProps> = ({
  cart,
  "data-testid": dataTestId,
}) => {
  const notReady =
    !cart ||
    !cart.shipping_address ||
    !cart.billing_address ||
    !cart.email ||
    (cart.shipping_methods?.length ?? 0) < 1

  const paymentSession = cart.payment_collection?.payment_sessions?.[0]

  switch (true) {
    case isStripeLike(paymentSession?.provider_id):
      return (
        <StripePaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    case isManual(paymentSession?.provider_id):
      return (
        <ManualTestPaymentButton notReady={notReady} data-testid={dataTestId} />
      )
    case isStellar(paymentSession?.provider_id):
      return (
        <StellarPaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    default:
      return <Button disabled>Select a payment method</Button>
  }
}

const StripePaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const stripe = useStripe()
  const elements = useElements()
  const card = elements?.getElement("card")

  const session = cart.payment_collection?.payment_sessions?.find(
    (s) => s.status === "pending",
  )

  const disabled = !stripe || !elements ? true : false

  const handlePayment = async () => {
    setSubmitting(true)

    if (!stripe || !elements || !card || !cart) {
      setSubmitting(false)
      return
    }

    await stripe
      .confirmCardPayment(session?.data.client_secret as string, {
        payment_method: {
          card: card,
          billing_details: {
            name:
              cart.billing_address?.first_name +
              " " +
              cart.billing_address?.last_name,
            address: {
              city: cart.billing_address?.city ?? undefined,
              country: cart.billing_address?.country_code ?? undefined,
              line1: cart.billing_address?.address_1 ?? undefined,
              line2: cart.billing_address?.address_2 ?? undefined,
              postal_code: cart.billing_address?.postal_code ?? undefined,
              state: cart.billing_address?.province ?? undefined,
            },
            email: cart.email,
            phone: cart.billing_address?.phone ?? undefined,
          },
        },
      })
      .then(({ error, paymentIntent }) => {
        if (error) {
          const pi = error.payment_intent

          if (
            (pi && pi.status === "requires_capture") ||
            (pi && pi.status === "succeeded")
          ) {
            onPaymentCompleted()
          }

          setErrorMessage(error.message || null)
          return
        }

        if (
          (paymentIntent && paymentIntent.status === "requires_capture") ||
          paymentIntent.status === "succeeded"
        ) {
          return onPaymentCompleted()
        }

        return
      })
  }

  return (
    <>
      <Button
        disabled={disabled || notReady}
        onClick={handlePayment}
        size="large"
        isLoading={submitting}
        data-testid={dataTestId}
      >
        Place order
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="stripe-payment-error-message"
      />
    </>
  )
}

const ManualTestPaymentButton = ({ notReady }: { notReady: boolean }) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const handlePayment = () => {
    setSubmitting(true)

    onPaymentCompleted()
  }

  return (
    <>
      <Button
        disabled={notReady}
        isLoading={submitting}
        onClick={handlePayment}
        size="large"
        data-testid="submit-order-button"
      >
        Place order
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="manual-payment-error-message"
      />
    </>
  )
}

const StellarPaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const session = cart.payment_collection?.payment_sessions?.find(
    (s) => s.provider_id === "pp_stellar_stellar",
  )
  const paymentUrl = session?.data?.payment_url as string | undefined

  // Track whether the user has been redirected to the Stellar portal
  const storageKey = `stellar_paying_${cart.id}`
  const [hasPaid, setHasPaid] = useState(false)
  useEffect(() => {
    setHasPaid(localStorage.getItem(storageKey) === "true")
  }, [storageKey])

  const handleOpenPortal = () => {
    if (!paymentUrl) {
      setErrorMessage(
        "Payment URL not available. Please refresh and try again.",
      )
      return
    }
    localStorage.setItem(storageKey, "true")
    window.location.href = paymentUrl
  }

  const handlePlaceOrder = async () => {
    setSubmitting(true)
    try {
      await placeOrder()
      localStorage.removeItem(storageKey)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
    }
  }

  if (hasPaid) {
    return (
      <>
        <Button
          disabled={notReady}
          isLoading={submitting}
          onClick={handlePlaceOrder}
          size="large"
          data-testid={dataTestId}
        >
          Complete Order
        </Button>
        <p className="text-sm text-ui-fg-subtle mt-2">
          Already paid?{" "}
          <button
            className="underline"
            onClick={() => {
              localStorage.removeItem(storageKey)
              window.location.reload()
            }}
          >
            Go back
          </button>
        </p>
        <ErrorMessage
          error={errorMessage}
          data-testid="stellar-payment-error-message"
        />
      </>
    )
  }

  return (
    <>
      <Button
        disabled={notReady || !paymentUrl}
        isLoading={submitting}
        onClick={handleOpenPortal}
        size="large"
        data-testid={dataTestId}
        className="flex items-center gap-2"
      >
        <img
          src="/images/stellartools-logo.svg"
          alt="StellarTools"
          className="size-6 brightness-0 invert"
        />
        <span>Pay with Stellar (Crypto)</span>
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="stellar-payment-error-message"
      />
    </>
  )
}

export default PaymentButton
