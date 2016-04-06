angular.module('procom').controller('CpCtrl', function ($scope,$http,$modal,$log) {
    $scope.portfolio = [];
    $scope.animationsEnabled = true;

    $scope.open = function () {

        var modalInstance = $modal.open({
            animation: $scope.animationsEnabled,
            templateUrl: '/WH/views/partials/addItem.html?version=4',
            controller: 'additemCtrl',
            size: 'lg',
            resolve: {
                parentScope: function() {
                    return $scope;
                }
            }
        });

    };

    $scope.toggleAnimation = function () {
        $scope.animationsEnabled = !$scope.animationsEnabled;
    };
});