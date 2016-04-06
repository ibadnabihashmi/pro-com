angular.module('procom').factory('fetchService', function($http, $location){
    return{
        fetchQuestion: function(){
            return $http.get('/explore/question?qid='+$location.search().qid).then(function(res){
                return res.data.question;
            });
        },
        fetchComments: function(){
            return $http.get('/explore/getComments?qid='+$location.search().qid).then(function(res){
                return res.data.comments;
            });
        },
        getAllQuestions: function(){
            return $http.get('/explore/getAllQues').then(function(res){
                return res.data.questions;
            });
        },
        /*      getActivity: function(){
         return $http.get('/account/getActivity').then(function(res){
         //console.log(res.data);
         return res.data.a;
         });
         },
         */
        getNotifications: function(){
            return $http.get('/account/getNotifications').then(function(res){
                console.log(res.data.n);
                return res.data.n;
            });
        },
        getAllTags : function(){
            return $http.get('/explore/getAllTags').then(function(tags){
                return tags;
            });
        },
        getAllCats : function(){
            return $http.get('/explore/getAllCats').then(function(cats){
                return cats;
            });
        },
        getQuestionsFromTag: function(id){
            return $http.get('/explore/getQuesFromTag?id='+id).then(function(ques){
                return ques.data.questions;
            });
        },
        getQuestionsFromCat: function(id){
            return $http.get('/explore/getQuesFromCat?id='+id).then(function(ques){
                return ques.data.questions;
            });
        }

    }
});