FROM wordpress:6.7-php8.2-apache

# Baked into the image; WordPress entrypoint copies this into /var/www/html on first boot.
COPY packages/woocommerce-adapter /usr/src/wordpress/wp-content/plugins/stellartools

# Railway: fix AH00534 (multiple MPMs) and bind Apache to $PORT at container start.
COPY examples/woocommerce/docker-entrypoint-railway.sh /usr/local/bin/docker-entrypoint-railway.sh
RUN chmod +x /usr/local/bin/docker-entrypoint-railway.sh

EXPOSE 8080

ENTRYPOINT ["docker-entrypoint-railway.sh"]
CMD ["apache2-foreground"]
