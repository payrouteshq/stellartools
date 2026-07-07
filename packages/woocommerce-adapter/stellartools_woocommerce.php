<?php
/**
 * Plugin Name: StellarTools
 * Description: WooCommerce payment gateway for the Stellar Blockchain.
 * Version:     1.2.0
 * Author:      Prince Ajuzie
 * 
 * `before_woocommerce_init`                    - declare block checkout compatibility.
 * `plugins_loaded`                              - load the gateway class.
 * `woocommerce_payment_gateways`               - register gateway with WooCommerce.
 * `woocommerce_blocks_payment_method_type_registration` - register block checkout integration.
 * `rest_api_init`                              - register the webhook REST endpoint.
 */

defined( 'ABSPATH' ) || exit;

/**
 * Webhook URL for the StellarTools REST endpoint (plain permalinks).
 *
 * @return string e.g. https://store.example/index.php?rest_route=/stellartools/v1/webhook
 */
function stellartools_webhook_url(): string {
	return home_url( '/index.php?rest_route=/stellartools/v1/webhook' );
}

add_action( 'before_woocommerce_init', function () {
	if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
		\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'cart_checkout_blocks', __FILE__, true );
	}
} );


add_action( 'plugins_loaded', function () {
	if ( ! class_exists( 'WC_Payment_Gateway' ) ) {
		return;
	}
	require_once plugin_dir_path( __FILE__ ) . 'gateways/stellartools.php';
}, 0 );

add_filter( 'woocommerce_payment_gateways', function ( array $methods ) {
	if ( class_exists( 'WC_Gateway_StellarTools' ) ) {
		$methods[] = 'WC_Gateway_StellarTools';
	}
	return $methods;
} );

add_action( 'woocommerce_blocks_payment_method_type_registration', function ( \Automattic\WooCommerce\Blocks\Payments\PaymentMethodRegistry $registry ) {
	if ( ! class_exists( 'WC_Gateway_StellarTools_Options' ) ) {
		require_once plugin_dir_path( __FILE__ ) . 'gateways/stellartools_option.php';
	}
	$registry->register( new WC_Gateway_StellarTools_Options() );
} );

add_action( 'rest_api_init', function () {
	register_rest_route( 'stellartools/v1', '/webhook', [
		'methods'             => 'POST',
		'callback'            => function () {
			if ( ! class_exists( 'WC_Gateway_StellarTools' ) ) {
				require_once plugin_dir_path( __FILE__ ) . 'gateways/stellartools.php';
			}
			$result = ( new WC_Gateway_StellarTools() )->handle_webhook();
			return new WP_REST_Response( $result['body'], $result['status'] );
		},
		'permission_callback' => '__return_true',
	] );
} );
