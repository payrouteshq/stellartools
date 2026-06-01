( function () {
	var registry  = window.wc && window.wc.wcBlocksRegistry;
	var settings  = window.wc && window.wc.wcSettings;
	var el        = window.wp && window.wp.element && window.wp.element.createElement;
	var decode    = window.wp && window.wp.htmlEntities && window.wp.htmlEntities.decodeEntities;

	if ( ! registry || ! registry.registerPaymentMethod ) {
		return;
	}

	var data        = ( settings && settings.getPaymentMethodData )
		? settings.getPaymentMethodData( 'stellartools', {} )
		: {};
	var title       = ( decode ? decode( data.title || '' ) : data.title ) || 'Pay with Stellar (Crypto)';
	var description = data.description || '';

	var Content = el
		? function () { return el( 'div', null, description ); }
		: function () { return description; };

	registry.registerPaymentMethod( {
		name:           'stellartools',
		label:          title,
		content:        el ? el( Content, null ) : null,
		edit:           el ? el( Content, null ) : null,
		canMakePayment: function () { return true; },
		ariaLabel:      title,
		supports:       { features: ( data.supports || [ 'products' ] ) },
	} );
} )();
