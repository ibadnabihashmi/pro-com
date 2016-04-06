angular.module('procom').config(function ($routeProvider, $locationProvider) {

    $routeProvider
        .when('/account', {
            templateUrl: '/WH/views/account/profile.html'
        })
        .when('/account/managers', {
            templateUrl: '/WH/views/account/profile.html'
        })
        .when('/account/managers/addItem', {
            templateUrl: '/WH/views/account/addItem.html'
        });

    $locationProvider.html5Mode({
        enabled: true,
        requireBase: false
    });
});