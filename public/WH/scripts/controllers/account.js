angular.module('procom').controller('AccountCtrl', function ($scope,$http, sessionService) {
    sessionService.getSessionInfo().then(function(response) {
        $scope.user=response;
    });

    $scope.updateInfo = function(){
        $http.post('/account/update',
            {
                email:$scope.user.email,
                name:$scope.user.profile.name,
                uname:$scope.user.username,
                facebook:$scope.user.preferences.facebookURL,
                twitter:$scope.user.preferences.twitterURL,
                google:$scope.user.preferences.googleURL
            })
            .then(function(res){

            });
    };
});