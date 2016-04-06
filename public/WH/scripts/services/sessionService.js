angular.module('procom').factory('sessionService', function($http){
    return{
        getSessionInfo: function(){
            return $http.get('/user').then(function(res){
                return res.data.user;
            });
        }
    }
});
