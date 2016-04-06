(function (lib) {

  'use strict';

  /* globals user_id, host, path, optin */

  var btn_close = $('#btn_close');
  var btn_submit = $('#btn_submit');
  var widget_email = $('#widget_email');
  var alert_area = $('#widget_alert_area');

  btn_close.on('click', function () {

    window.parent.postMessage(JSON.stringify({id: 'close'}), '*');

  });

  function updateLayout() {

    var msg = {
      id: 'resize',
      height: $('body').height(),
      width: $('body').width() + 1,
      widget_position: widget_position
    };

    window.parent.postMessage(JSON.stringify(msg), '*');

  }

  function getCookie(c_name) {
    if (document.cookie.length > 0) {
      var c_start = document.cookie.indexOf(c_name + '=');
      if (c_start !== -1) {
        c_start = c_start + c_name.length + 1;
        var c_end = document.cookie.indexOf(';', c_start);
        if (c_end === -1) {
          c_end = document.cookie.length;
        }
        return unescape(document.cookie.substring(c_start, c_end));
      }
    }
    return '';
  }

  $(document).ready(function () {

    $('.hn-optin-widget').fadeIn(400, function () {

    });
    updateLayout();

    //track xpanel in the first time
    var wginstall = getCookie('wginstalled');
    //only send in the first time
    if (!wginstall) {
      //write the cookie
      document.cookie = 'wginstalled=1; path=/';
      //mixpanel init
      window.mixpanel.identify(email);
      window.mixpanel.people.set({
        '$email': email
      });
      window.mixpanel.track('Widget Installed', {});
    }

    // send prospect event
    if (path.length > 0) {
      var trackerScript = document.createElement('script');
      trackerScript.async = true;
      trackerScript.src = '/dashboard/scripts/external/tracker.js';

      trackerScript.onload = function() {
        trackEvent('', user_id, 'widget');
      };

      var parent = document.getElementsByTagName('script')[0];
      parent.parentNode.insertBefore(trackerScript, parent);
    }
  });
  var submit = function () {
        var original_html = btn_submit.html();

        btn_submit.prop('disabled', 'disabled');
        btn_submit.html('Processing...');

        alert_area.empty();

        $.ajax({
            url: '/widget/add_candidate',
            data: {
                user_id: user_id,
                email: widget_email.val(),
                host: host,
                path: path,
                fingerprint: getFingerprint()
            },
            dataType: 'json',
            success: function (response) {
                var i, err;

                btn_submit.html(original_html);
                btn_submit.prop('disabled', false);

                if (response.hasErrors) {
                    for (i in response.errors) {
                        err = response.errors[i];
                        switch (err.id) {
                            case 'param-empty':
                                switch (err.context) {
                                    case 'email':
                                        lib.ui.showAlert(alert_area, 'danger', 'Email is empty');
                                        break;
                                }
                                break;
                            case 'param-not_email':
                                switch (err.context) {
                                    case 'email':
                                        lib.ui.showAlert(alert_area, 'danger', 'Not a valid email');
                                        break;
                                }
                                break;
                            default:
                                console.log(err);
                                lib.ui.showAlert(alert_area, 'danger', 'Unknown error');
                        }
                    }
                } else {
                    $('#view_form').hide();
                    $('#view_thank_you').fadeIn();
                }
                updateLayout();
            },
            error: lib.handleHTTPError
        });
    };
  btn_submit.on('click', submit);
  widget_email.keydown(function (e){
      if(e.keyCode === 13){
          submit();
      }
  });
})(optin);