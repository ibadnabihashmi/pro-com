angular.module('procom').config(function ($routeProvider, $locationProvider) {

    $routeProvider
        .when('/account', {
            templateUrl: '/WH/views/account/profile.html'
        });

    $locationProvider.html5Mode({
        enabled: true,
        requireBase: false
    });
});