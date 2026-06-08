<?php
defined( 'ABSPATH' ) || exit;

class WC_Gateway_StellarTools extends WC_Payment_Gateway {

	private string $api_key;
	private string $webhook_secret;
	private string $asset_code;
	private string $api_base_url;
	private bool   $debug_mode;

	public function __construct() {
		$this->id                 = 'stellartools';
		$this->icon               = plugins_url( 'assets/logo.svg', dirname( __FILE__, 2 ) . '/stellartools_woocommerce.php' );
		$this->has_fields         = false;
		$this->method_title       = 'StellarTools';
		$this->method_description = 'Accept payments on the Stellar blockchain via StellarTools hosted checkout. Supports USDC, XLM, EURC and any other Stellar asset.';
		$this->supports           = [ 'products' ];

		$this->init_form_fields();
		$this->init_settings();

		$this->title          = $this->get_option( 'title' );
		$this->description    = $this->get_option( 'description' );
		$this->api_key        = $this->get_option( 'api_key', '' );
		$this->webhook_secret = $this->get_option( 'webhook_secret', '' );
		$this->currency_code     = $this->get_option( 'currency_code', 'USDC' );
		$this->api_base_url   = untrailingslashit( $this->get_option( 'api_base_url', 'https://api.stellartools.dev' ) );
		$this->debug_mode     = 'yes' === $this->get_option( 'debug_mode', 'no' );
		$this->enabled        = $this->get_option( 'enabled' );

		add_action(
			'woocommerce_update_options_payment_gateways_' . $this->id,
			[ $this, 'process_admin_options' ]
		);
	}

	private function get_supported_assets(): array {
		$transient_key = 'stellartools_supported_assets_' . md5( $this->api_key );
		$cached        = get_transient( $transient_key );

		if ( false !== $cached && is_array( $cached ) ) {
			return $cached;
		}

		$fallback = [
			'USDC' => 'USDC (USD Coin)',
			'EURC' => 'EURC (Euro Coin)',
			'XLM'  => 'XLM (Stellar Lumens)',
		];

		if ( empty( $this->api_key ) || empty( $this->api_base_url ) ) {
			return $fallback;
		}

		$response = wp_remote_get(
			$this->api_base_url . '/assets',
			[
				'timeout'     => 10,
				'httpversion' => '1.1',
				'headers'     => [
					'x-api-key'  => $this->api_key,
					'User-Agent' => 'StellarTools-WooCommerce/1.0',
				],
			]
		);

		if ( is_wp_error( $response ) ) {
			return $fallback;
		}

		$http_code = wp_remote_retrieve_response_code( $response );
		$body      = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( 200 !== $http_code || ! is_array( $body['data'] ?? null ) ) {
			return $fallback;
		}

		$options = [];
		foreach ( $body['data'] as $asset ) {
			$code        = sanitize_text_field( $asset['code'] ?? '' );
			$description = sanitize_text_field( $asset['description'] ?? $code );
			if ( $code ) {
				$options[ $code ] = $description ? "{$code} ({$description})" : $code;
			}
		}

		if ( empty( $options ) ) {
			return $fallback;
		}

		set_transient( $transient_key, $options, 5 * MINUTE_IN_SECONDS );

		return $options;
	}

	public function init_form_fields(): void {
		$webhook_url    = rest_url( 'stellartools/v1/webhook' );
		$currency_opts  = $this->get_supported_assets();

		$this->form_fields = [

			'enabled' => [
				'title'   => 'Enable / Disable',
				'type'    => 'checkbox',
				'label'   => 'Enable StellarTools payment gateway',
				'default' => 'no',
			],

			'title' => [
				'title'    => 'Payment Method Title',
				'type'     => 'text',
				'default'  => 'Pay with Stellar (Crypto)',
				'desc_tip' => 'Label the customer sees on the checkout page.',
			],

			'description' => [
				'title'   => 'Payment Method Description',
				'type'    => 'textarea',
				'default' => 'Complete your payment securely via the Stellar blockchain. You will be redirected to a hosted payment page.',
			],

			'api_key' => [
				'title'             => 'API Key',
				'type'              => 'password',
				'description'       => 'Find your API key in the <a href="https://dashboard.stellartools.dev/api-keys" target="_blank">StellarTools dashboard</a>. Test keys begin with <code>sk_test_</code>; live keys begin with <code>sk_live_</code>.',
				'default'           => '',
				'custom_attributes' => [ 'required' => 'required', 'autocomplete' => 'off' ],
			],

			'api_base_url' => [
				'title'       => 'StellarTools API URL',
				'type'        => 'text',
				'desc_tip'    => 'Base URL of your StellarTools instance. No trailing slash.',
				'default'     => 'https://api.stellartools.dev',
				'placeholder' => 'https://api.stellartools.dev',
			],

			'webhook_secret' => [
				'title'             => 'Webhook Signing Secret',
				'type'              => 'password',
				'description'       => sprintf(
					'Copy the signing secret from your webhook endpoint in the <a href="%1$s" target="_blank">StellarTools dashboard</a>. Your webhook URL to register there is:<br><code>%2$s</code>',
					'https://dashboard.stellartools.dev/webhooks',
					esc_html( $webhook_url )
				),
				'default'           => '',
				'custom_attributes' => [ 'required' => 'required', 'autocomplete' => 'off' ],
			],

			'currency_code' => [
				'title'    => 'Payment Currency',
				'type'     => 'select',
				'desc_tip' => 'The Stellar asset customers will pay in.',
				'default'  => 'USDC',
				'options'  => $currency_opts,
			],

			'order_status_on_payment' => [
				'title'    => 'Order Status on Payment Confirmed',
				'type'     => 'select',
				'desc_tip' => 'Use "Processing" for physical goods, "Completed" for digital/virtual products.',
				'default'  => 'processing',
				'options'  => [
					'processing' => 'Processing',
					'completed'  => 'Completed',
				],
			],

			'debug_mode' => [
				'title'       => 'Debug Logging',
				'type'        => 'checkbox',
				'label'       => 'Write gateway events to the WooCommerce log',
				'description' => 'Logs API requests and webhook events. Disable in production once confirmed working.',
				'default'     => 'no',
			],

		];
	}

	public function process_payment( $order_id ): array {
		$order = wc_get_order( $order_id );

		if ( ! $order ) {
			wc_add_notice( 'Order not found. Please try again.', 'error' );
			return [ 'result' => 'failure' ];
		}

		if ( ! $order->needs_payment() ) {
			return [
				'result'   => 'success',
				'redirect' => $this->get_return_url( $order ),
			];
		}

		$order->update_status( 'pending', 'Awaiting StellarTools payment.' );

		$body = [
			'amount'       => (float) $order->get_total(),
			'asset_code'   => $this->asset_code,
			'redirect_url' => $this->get_return_url( $order ),
			'description'  => "Order #{$order->get_order_number()}",
			'metadata'     => [
				'wc_order_id' => (string) $order_id,
				'wc_site_url' => home_url(),
			],
		];

		$billing_email = $order->get_billing_email();
		$billing_phone = $order->get_billing_phone();
		$billing_name  = trim( $order->get_billing_first_name() . ' ' . $order->get_billing_last_name() );

		if ( $billing_email ) {
			$body['customer_email'] = $billing_email;
		}
		if ( $billing_phone ) {
			$body['customer_phone'] = $billing_phone;
		}
		if ( $billing_name ) {
			$body['customer_name'] = $billing_name;
		}

		$response = $this->api_request( $this->api_base_url . '/checkout?type=direct', $body );

		if ( is_wp_error( $response ) ) {
			$this->log( 'API request failed: ' . $response->get_error_message() );
			wc_add_notice( 'Payment gateway connection error. Please try again or contact support.', 'error' );
			$order->update_status( 'failed', 'StellarTools API unreachable.' );
			return [ 'result' => 'failure' ];
		}

		$http_code = wp_remote_retrieve_response_code( $response );
		$body_raw  = wp_remote_retrieve_body( $response );
		$result    = json_decode( $body_raw, true );

		if ( 200 !== $http_code || ! is_array( $result ) ) {
			$error_msg = isset( $result['error'] ) ? (string) $result['error'] : "HTTP {$http_code}";
			$this->log( "API error ({$http_code}): {$error_msg} | body: {$body_raw}" );
			wc_add_notice( 'Payment could not be initiated. Please try again.', 'error' );
			$order->update_status( 'failed', "StellarTools error: {$error_msg}" );
			return [ 'result' => 'failure' ];
		}

		$checkout_data = $result['data'] ?? null;
		$checkout_id   = $checkout_data['id'] ?? null;
		$redirect_url  = $checkout_data['next_action']['redirect_to_url']['url'] ?? $checkout_data['payment_url'] ?? null;

		if ( ! $checkout_id || ! $redirect_url ) {
			$this->log( 'Unexpected API response shape: ' . $body_raw );
			wc_add_notice( 'Unexpected payment gateway response. Please try again.', 'error' );
			$order->update_status( 'failed', 'Malformed StellarTools response.' );
			return [ 'result' => 'failure' ];
		}

		$order->update_meta_data( '_stellartools_checkout_id', sanitize_text_field( $checkout_id ) );
		$order->save_meta_data();

		$this->log( "Checkout created: {$checkout_id} for order #{$order_id}. Redirecting to: {$redirect_url}" );

		return [
			'result'   => 'success',
			'redirect' => esc_url_raw( $redirect_url ),
		];
	}

	public function handle_webhook(): array {
		$raw_body   = file_get_contents( 'php://input' );
		$signature  = sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_STELLARTOOLS_SIGNATURE'] ?? '' ) );
		$event_type = sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_STELLARTOOLS_EVENT'] ?? '' ) );

		$this->log( "Webhook received. Event: {$event_type}" );

		if ( ! $this->verify_webhook_signature( $raw_body, $signature ) ) {
			$this->log( 'Webhook signature verification failed.' );
			return [ 'status' => 400, 'body' => [ 'error' => 'Invalid signature' ] ];
		}

		$payload = json_decode( $raw_body, true );
		if ( ! is_array( $payload ) ) {
			return [ 'status' => 400, 'body' => [ 'error' => 'Invalid payload' ] ];
		}

		if ( 'payment.confirmed' === $event_type ) {
			$this->handle_payment_confirmed( $payload );
		} elseif ( 'payment.failed' === $event_type ) {
			$this->handle_payment_failed( $payload );
		} else {
			$this->log( "Unhandled event: {$event_type}" );
		}

		return [ 'status' => 200, 'body' => [ 'received' => true ] ];
	}

	private function handle_payment_confirmed( array $payload ): void {
		$order = $this->resolve_order_from_payload( $payload );
		if ( ! $order || ! $order->needs_payment() ) {
			if ( $order ) {
				$this->log( "Order #{$order->get_id()} already processed. Skipping." );
			}
			return;
		}

		$obj              = $payload['data']['data']['object'] ?? [];
		$payment_id       = sanitize_text_field( $obj['id'] ?? '' );
		$transaction_hash = sanitize_text_field( $obj['transaction_hash'] ?? '' );
		$amount_paid      = sanitize_text_field( (string) ( $obj['amount'] ?? '' ) );

		$order->add_order_note( "StellarTools payment confirmed. Payment ID: {$payment_id}. Amount: {$amount_paid}. Transaction: {$transaction_hash}" );

		$order->update_meta_data( '_stellartools_payment_id', $payment_id );
		$order->update_meta_data( '_stellartools_txn_hash', $transaction_hash );
		$order->payment_complete( $payment_id );

		$target_status = $this->get_option( 'order_status_on_payment', 'processing' );
		if ( 'completed' === $target_status ) {
			$order->update_status( 'completed', 'StellarTools: auto-completed per gateway settings.' );
		}

		$this->log( "Order #{$order->get_id()} marked {$target_status} via payment.confirmed." );
	}

	private function handle_payment_failed( array $payload ): void {
		$order = $this->resolve_order_from_payload( $payload );
		if ( ! $order || ! $order->needs_payment() ) {
			return;
		}

		$order->update_status( 'failed', 'StellarTools reported payment failure.' );
		$this->log( "Order #{$order->get_id()} marked failed via payment.failed." );
	}

	private function resolve_order_from_payload( array $payload ): ?WC_Order {
		$obj = $payload['data']['data']['object'] ?? [];

		$order_id = $obj['metadata']['wc_order_id'] ?? null;
		if ( $order_id ) {
			$order = wc_get_order( (int) $order_id );
			if ( $order instanceof WC_Order ) {
				$this->log( "Order resolved via metadata: #{$order->get_id()}" );
				return $order;
			}
		}

		$checkout_id = $obj['checkout_id'] ?? null;
		if ( $checkout_id ) {
			$orders = wc_get_orders( [
				'type'       => 'shop_order',
				'meta_key'   => '_stellartools_checkout_id',
				'meta_value' => sanitize_text_field( $checkout_id ),
				'limit'      => 1,
			] );

			if ( ! empty( $orders ) ) {
				$this->log( "Order resolved via checkout ID meta: #{$orders[0]->get_id()}" );
				return $orders[0];
			}
		}

		$this->log( 'Could not resolve WC order from webhook payload. Payload: ' . wp_json_encode( $payload ) );
		return null;
	}

	private function verify_webhook_signature( string $raw_body, string $signature ): bool {
		if ( empty( $signature ) || empty( $this->webhook_secret ) ) {
			return false;
		}

		// Format: t={unix_timestamp},v1={hmac_sha256_hex}
		$parts     = explode( ',', $signature, 2 );
		$timestamp = null;
		$received  = null;

		foreach ( $parts as $part ) {
			$kv = explode( '=', $part, 2 );
			if ( 2 !== count( $kv ) ) {
				return false;
			}
			if ( 't' === $kv[0] ) {
				$timestamp = (int) $kv[1];
			} elseif ( 'v1' === $kv[0] ) {
				$received = $kv[1];
			}
		}

		if ( null === $timestamp || null === $received ) {
			return false;
		}

		if ( abs( time() - $timestamp ) > 300 ) {
			$this->log( 'Webhook rejected: timestamp outside tolerance window.' );
			return false;
		}

		$expected = hash_hmac( 'sha256', $timestamp . '.' . $raw_body, $this->webhook_secret );

		return hash_equals( $expected, $received );
	}

	private function api_request( string $url, array $body = [] ) {
		$this->log( "API POST {$url} body: " . wp_json_encode( $body ) );

		return wp_remote_post( $url, [
			'timeout'     => 30,
			'redirection' => 0,
			'httpversion' => '1.1',
			'headers'     => [
				'Content-Type' => 'application/json',
				'x-api-key'    => $this->api_key,
				'User-Agent'   => 'StellarTools-WooCommerce/1.0',
			],
			'body'        => wp_json_encode( $body ),
		] );
	}

	private function log( string $message ): void {
		if ( $this->debug_mode ) {
			wc_get_logger()->info( $message, [ 'source' => 'stellartools-gateway' ] );
		}
	}
}
