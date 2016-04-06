(function() {

	/* globals HN_OPTIN_WIDGET */

	'use strict';

	var widget = HN_OPTIN_WIDGET;

	var DOCK_STYLE = 'width: 247px; height:340px; overflow: hidden; border: 0; background: none; background-color:transparent;';
	var PROD_STYLE = DOCK_STYLE+'position: fixed; left: .7%; top: 15%; z-index: 999;';

	var el_iframe = document.createElement('iframe');

	if (!window.location.origin) {
		console.log("in the name of allah");
		window.location.origin = window.location.protocol +
			'//' + window.location.hostname +
			(window.location.port ? ':' + window.location.port: '');
	}

	function processMessage(msg) {

		switch(msg.id) {

			case 'close':

				widget.dockEl.removeChild(el_iframe);

				break;

			case 'resize':
				el_iframe.style.height = msg.height+'px';
				el_iframe.style.width = msg.width+'px';
                //default is left, just need to check right
                if(msg.widget_position === 'right'){
                  el_iframe.style.left = null;
                  el_iframe.style.right = '.7%';
                }

				break;
		}

	}

	function init() {

		el_iframe.setAttribute('style',	PROD_STYLE);
		el_iframe.setAttribute('src',	widget.src+'&host='+window.location.hostname+'&path='+window.location.pathname);
		el_iframe.setAttribute('scrolling','no');
		el_iframe.setAttribute('seamless','seamless');

		widget.isReady = true;

		if(widget.isDocked) {
			widget.dock();
		} else {
			document.body.appendChild(el_iframe);
			widget.dockEl = document.body;
		}
	}

	if (document.addEventListener) {

		window.addEventListener('message', function(event) {
          processMessage( JSON.parse(event.data) );
		}, false);

		document.addEventListener('DOMContentLoaded', init);

	} else {

		document.attachEvent('onreadystatechange', function() {

			if (document.readyState === 'interactive') init();

		});

	}

	HN_OPTIN_WIDGET.dock = function(tgt_el_id) {

		widget.isDocked = true;
		widget.dockElementId = tgt_el_id || widget.dockElementId;

		if( widget.isReady ) {
			el_iframe.setAttribute('style',	DOCK_STYLE);
			widget.dockEl = document.getElementById(widget.dockElementId);
			widget.dockEl.appendChild(el_iframe);

		}

	};

})();