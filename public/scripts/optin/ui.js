(function(lib) {
	
	/* globals optin */

	'use strict';

	lib.showAlert = function(alert_area, type, text) {
			
		var alert = $('<div class="alert alert-'+type+'">'+text+'</div>');
		alert_area.append(alert);

	};

})(optin.ui);