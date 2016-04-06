'use strict';

/* globals location */

angular.module('AuthApp', ['ui.bootstrap'], function () {
});

angular.module('AuthApp').run(['Auth', 'Modals',
  function (Auth, Modals) {
    Auth.isLoggedIn().catch(Modals.showAuthModal);
  }
]);

angular.module('AuthApp').factory('Auth', ['$http', '$q',
  function ($http) {
    function _isLoggedIn() {
      return $http.get('/user');
    }

    function _signup(userData) {
      return $http.post('/auth/signup', userData);
    }

    function _login(cred) {
      return $http.post('/auth/login', cred);
    }
    
    return {
      isLoggedIn: _isLoggedIn,
      login: _login,
      signup: _signup
    };
  }
]);

angular.module('AuthApp').factory('Modals', ['$modal',
  function ($modal) {
    var currentModal;

    function _showModal(options) {
      options = options || {};
      if (currentModal) currentModal.dismiss('close');
      currentModal = $modal.open(angular.extend({
        backdrop: false
      }, options));
      return currentModal;
    }

    function _showAuthModal(options) {
      return _showModal(angular.extend({
        templateUrl: '/partials/auth.html',
        controller: 'AuthCtrl'
      }, options));
    }

    function _showLoginModal(options) {
      return _showModal(angular.extend({
        templateUrl: '/partials/login.html',
        controller: 'LoginCtrl'
      }, options));
    }

    function _showSignupModal(options) {
      return _showModal(angular.extend({
        templateUrl: '/partials/signup.html',
        controller: 'SignupCtrl'
      }, options));
    }

    return {
      showAuthModal: _showAuthModal,
      showLoginModal: _showLoginModal,
      showSignupModal: _showSignupModal
    };
  }
]);

angular.module('AuthApp').factory('Url', function () {
  function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
  }

  return {
    redirect: function () {
      return getParameterByName('redirectURL') || '/';
    },
    ext: function () {
      return getParameterByName('ext');
    }
  };
});

angular.module('AuthApp').controller('AuthCtrl', ['$scope', 'Auth', 'Modals', 'Url',
  function ($scope, Auth, Modals, Url) {
    $scope.redirectURL = Url.redirect();
    $scope.login = Modals.showLoginModal;
    $scope.signup = Modals.showSignupModal;
  }
]);

angular.module('AuthApp').controller('LoginCtrl', ['$scope', '$location', 'Auth', 'Url',
  function ($scope, $location, Auth, Url) {
    $scope.login = function () {
      $scope.error = null;

      $scope.cred.redirectURL = Url.redirect();
      $scope.cred.ext = Url.ext();

      Auth.login($scope.cred).then(function (res) {
        location.replace(res.data.redirectURL);
      }).catch(function (err) {
        $scope.error = err;
      });
    };
  }
]);

angular.module('AuthApp').controller('SignupCtrl', ['$scope', 'Auth', 'Url',
  function ($scope, Auth, Url) {
    $scope.signup = function () {
      $scope.error = null;

      $scope.user.redirectURL = Url.redirect();
      $scope.user.ext = Url.ext();

      Auth.signup($scope.user).then(function (res) {
        location.replace(res.data.redirectURL);
      }).catch(function (err) {
        $scope.error = err;
      });
    };
  }
]);
