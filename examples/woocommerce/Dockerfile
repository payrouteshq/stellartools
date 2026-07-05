FROM wordpress:6.7-php8.2-apache

# Baked into the image; WordPress entrypoint copies this into /var/www/html on first boot.
COPY packages/woocommerce-adapter /usr/src/wordpress/wp-content/plugins/stellartools
