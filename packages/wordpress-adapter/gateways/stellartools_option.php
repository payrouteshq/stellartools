<?php
defined( 'ABSPATH' ) || exit;

use Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType;

class WC_Gateway_StellarTools_Options extends AbstractPaymentMethodType {

	protected $name = 'stellartools';

	public function initialize(): void {
		$this->settings = get_option( 'woocommerce_stellartools_settings', [] );
	}

	public function is_active(): bool {
		return filter_var( $this->get_setting( 'enabled', false ), FILTER_VALIDATE_BOOLEAN );
	}

	public function get_payment_method_script_handles(): array {
		wp_register_script(
			'wc-stellartools-blocks',
			plugins_url( 'assets/blocks_checkout.js', dirname( __FILE__, 2 ) . '/stellartools_woocommerce.php' ),
			[ 'wc-blocks-registry', 'wc-settings', 'wp-element', 'wp-html-entities' ],
			'1.2.0',
			true
		);
		return [ 'wc-stellartools-blocks' ];
	}

	public function get_payment_method_data(): array {
		return [
			'title'       => $this->get_setting( 'title', __( 'Pay with Stellar (Crypto)', 'stellartools' ) ),
			'description' => $this->get_setting( 'description', '' ),
			'supports'    => [ 'products' ],
		];
	}
}
