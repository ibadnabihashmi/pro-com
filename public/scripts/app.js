'use strict';

/* globals FileReader, CSV, atob, window, event, location */

angular.module('rmail-server', ['ngRoute', 'ui.bootstrap', 'angularFileUpload', 'ui.directives', 'ui.filters', 'ngSanitize'])
.run(function($rootScope, $window, Tracker, Api){
  $rootScope.mixpanel = function() {
    return $window.mixpanel;
  };
  var userInfo;
  Api.getUser().then(function(resp) {
    var data;
    if(!(resp && (data = resp.data) && data.email)) {
      throw new Error('failed to get user information');
    }
    userInfo = resp.data;
    Tracker.init(userInfo.email);
  });

  $rootScope.$on('MixpanelEvent', function(scope, event) {
    Tracker.track(event.name, event.data);
  });

})

.factory('$csv', [function() {
  var REG_VALID_ADDR = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  function upload(files, callback) {
    var file = files[0];
    var reader = new FileReader();
    reader.onload = function(e) {
      var source = atob(e.target.result.split(',')[1]);
      var csvData = new CSV(source).parse();
      var list = [];
      var statistic = {
        lines: 0,
        contacts: 0
      };
      csvData.forEach(function readline(items) {
        statistic.lines++;
        //The 2nd field should always be an email address.
        var email = items[1];
        if(email && REG_VALID_ADDR.test(email)){
          //field 1 is name and field 3 is skills
          /**
          * get name and skills from csv
          * Example file:
          * name, email address, skill1:skill2:skillN
          */
          statistic.contacts++;
          //get skills from string
          var skills = [];
          if(items[2]){
            items[2].split(':').forEach(function(skill){
              if(skill && skill.trim()){
                skills.push(skill);
              }
            });
          }

          var name = items[0].trim().split(' ');
          var contact = {
            firstName: name[0],
            lastName: name.length > 1 ? name[1] : '',
            email: email,
            skills: skills
          };
          list.push(contact);
        }
      });
      if(typeof(callback) === 'function'){
        callback(list, statistic);
      }
    };
    reader.readAsDataURL(file);
  }

  return {
    upload: upload
  };
}])

.factory('TwitterOauth', ['$http', '$q', function($http, $q) {
  var defaultCheckInterval = 5000;
  var self = this;
  function _isAuthrorized() {
    var defer = new $q.defer();
    $http.get('/accounts').then(function(resp) {
      defer.resolve(resp.data);
    });
    return defer.promise;
  }
  function _checkOauth(defer) {
    defer = defer || new $q.defer();
    _isAuthrorized()
    .then(function(data) {
          // if (!data) {
          //   defer.reject();
          // }
          if(data.length > 0){
            defer.resolve(data);
          } else {
            setTimeout(_checkOauth.bind(self, defer), defaultCheckInterval);
          }
        });
    return defer.promise;
  }

  function _getRecentTweets (email) {
    var defer = new $q.defer();
    $http.get('/twitter/lastActivity?email=' + email).then(function(resp) {
      defer.resolve(resp.data);
    });
    return defer.promise;
  }

  var _disconnectTwitter = function() {
    var deferred = $q.defer();
    $http.delete('/auth/twitter')
    .then(function(resp) {
      deferred.resolve(resp);
    });

    return deferred.promise;
  };

  return {
    checkTwitterAuthorizatin: _checkOauth,
    isTwitterAuthorized: _isAuthrorized,
    getRecentTweets: _getRecentTweets,
    disconnectTwitter: _disconnectTwitter
  };
}])

.factory('Api', ['$http', '$q', '$rootScope', function($http, $q, $rootScope) {
  function _groupMessages (candidates, defaultMessage) {
    var messagesGroups = {
      defaultMessage: []
    };
    $rootScope.$broadcast('settingsChange', {});
    for (var i = 0; i < candidates.length; i++) {
      var candidate = candidates[i],
      message = candidate.message;
      if(message) {
        var groupKey = angular.toJson(message);
        messagesGroups[groupKey] = messagesGroups[groupKey] || [];
        messagesGroups[groupKey].push(candidate);
      } else {
        candidate.message = defaultMessage;
        messagesGroups.defaultMessage.push(candidate);
      }
    }
    var messages = [];
    for(var key in messagesGroups) {
      if(messagesGroups.hasOwnProperty(key) && messagesGroups[key].length) {
        messages.push(messagesGroups[key]);
      }
    }
    return messages;
  }
  function doSend (modalData, personalize) {
    var defer = new $q.defer();
    var messages;
    if(!personalize) {
      var defaultMessage = modalData.defaultMessage,
      salutation = defaultMessage.salutation,
        // never used
        content = defaultMessage.content; // jshint ignore: line
        if(salutation) {
          defaultMessage.content = defaultMessage.salutation + ' -\n' +
          defaultMessage.content;
        }

        if (modalData.signature) {
          defaultMessage.content = defaultMessage.content.trim();
          defaultMessage.content += '\n\n' + modalData.signature;
        }
      }
      messages = _groupMessages(modalData.candidates, modalData.defaultMessage);
      var campaignId = '';
      (function _sendNext($http, messages, campaignName, defer, idx, campaign) {
        idx = idx || 0;
        campaign = campaign || {};
        if(idx >= messages.length) {
          var customizedMessage = modalData.isPersonalMessage ? true : false;
          return defer.resolve({
            campaignId: campaignId,
            customizedMessage: customizedMessage
          });
        }
        var messageGroup = messages[idx];
        var msg = messageGroup[0].message || messageGroup[0].defaultMessage;
        $http.post('/mail/compose', {
          to: messageGroup.map(function(item) {
            return {
              firstName: item.firstName,
              lastName: item.lastName,
              email: item.email
            };
          }),
          subject: msg.subject,
          content: msg.content.replace(/\n/g, '<br />'),
          campaignName: campaignName,
          campaignId: campaign._id,
          beaconId: campaign.beaconId
        })
        .then(function(resp) {
          if (!campaignId) {
            campaignId = resp.data._id;
          }
          campaign = resp.data;
          _sendNext($http, messages, campaignName, defer, ++idx, campaign);
        })
        .catch(function(err) {
          defer.reject(err);
        });

      })($http, messages, modalData.campaignName, defer);

      return defer.promise;

    }
    function _send (data, personalize) {
      var modalData = angular.copy(data);
      var campaignName = modalData.campaignName || modalData.defaultMessage.subject;

      return _getUniqueCampaignName(campaignName)
      .then(function(resp) {
        modalData.campaignName = resp.data.name;
        return doSend(modalData, personalize);
      });

    }

    function _getUniqueCampaignName(campaignName) {
      return $http({
        url: '/mail/validate-campaign-name',
        params: { name: campaignName }
      });
    }

    function _getUser() {
      return $http.get('/user');
    }

    function _unlike (id) {
      if(!id) throw new Error('missing ID field');
      return $http.get('/profile/unlike?id=' + id);
    }

    return {
      send: _send,
      groupMessages: _groupMessages,
      getUser: _getUser,
      unlike: _unlike
    };
  }])

.directive('spinner', function() {
  return {
    templateUrl: '/partials/spinner.html',
      link: function(scope, element, attrs) { // jshint ignore: line
        var color = attrs.spinner || '#eee';
        element.css('background', color);
      }
    };
  })

.controller('CandidateAddTagController', ['$scope', '$rootScope', '$http', '$modalInstance','candidate',
  function($scope, $rootScope, $http, $modalInstance, candidate) {
    var timeOut;
    $scope.candidate = candidate;
    $scope.email = candidate.email;

    $scope.CandidateForm = {
      success: false,
      data: {
        email: $scope.email,
        tags: ''
      },
      submit: function() {
        $http.post('/profile/add-tag', $scope.CandidateForm.data).then(function(response) {
          if (response.data.success) {
            $scope.CandidateForm.success = true;
            $scope.CandidateForm.errors = {};

            // upadate current candidate.
            candidate.skills = response.data.candidate.skills;
            timeOut = setTimeout(function(){
              $modalInstance.close();
            }, 4000);

            $rootScope.$broadcast('MixpanelEvent', {
              name: 'People added manually',
              data: {}
            });

          } else {
            $scope.CandidateForm.errors = response.data.errors;
          }
        });
      }
    };

    $scope.close = function() {
      $modalInstance.close();
    };
  }
  ])


.directive('candidatesTable', ['Api', '$http', '$modal', function(Api, $http, $modal, $scope) {
  return {
    templateUrl: '/partials/candidates-table.html',
    link: function(scope, element, attrs) {
      var name = attrs.ngName;
      scope.getDataset = function() {
        if (scope.pageSize && scope[name]) {
          return scope[name].slice(scope.curPage*scope.pageSize, (scope.curPage+1)*scope.pageSize);
        } else {
          return scope[name];
        }
      };
      scope.unlike = function(candidate) {
        var instance = $modal.open({
          templateUrl: '/partials/confirm-unlike.html',
          scope: scope,
          controller: ['$scope', '$modalInstance', function($scope, $modalInstance) {
            $scope.candidate = candidate;
            window.$modalInstance = $modalInstance;
            $scope.close = function(result) {
              if(result) {
                $modalInstance.close(result);
              } else {
                $modalInstance.dismiss('closed');
              }
            };
          }]
        });
        instance.result.then(function() {
          var candidates = scope[name];
          Api.unlike(candidate._id).then(function() {
            candidates.splice(candidates.indexOf(candidate), 1);
              //update curpage if we delete last item
              var ceil = Math.ceil(candidates.length / scope.pageSize);
              //check ceil > 0 to fix the first page
              scope.curPage = ceil > 0 ? ceil - 1 : 0;
              //call controller to update.
              scope.$apply();
            });
        });
      };
      scope.updateFollowUp = function(item) {
        item.successColor = 'initial';
        var data = {
          id: item._id,
          nextFollowUpDate: item.nextFollowUpDate
        };
        $http.post('/profile/update-next-follow-up', data).then(function(response) {
          if (response.data.success) {
            item.successColor = 'lightgreen';
          } else {
            item.successColor = 'darkred';
          }
        });
      };
      scope.showAdditionalInfo = function(candidate) {
        console.log(candidate);
        $modal.open({
          templateUrl: '/partials/candidates-additional-info.html',
          controller: 'CandidateAdditionalInfoCtrl',
          resolve: {
            candidate: function(){
              return candidate;
            }
          }
        });
      };

      scope.moreSkillsFlags = [];
      scope.noSkills = 10;

      scope.incrementSkillsFlags = function () {
        scope.moreSkillsFlags.push(false);
      };

      scope.initEachMoreSkillFlags=  function (len) {
        console.log("here we iniate more skills flags");
        for (var i = 0; i < len; i++) {
          scope.moreSkillsFlags[i].push(false);
        }
      };

      scope.toggleMoreSkillsFlag = function(index) {
        scope.moreSkillsFlags[index] = !(scope.moreSkillsFlags[index]);
      };

      scope.addTag = function (candidate) {
        $modal.open({
          templateUrl: '/partials/candidates-add-tag-modal.html',
          controller: 'CandidateAddTagController',
          resolve: {
            candidate: function(){
              return candidate;
            }
          }
        });
      };
      scope.deleteTag = function (candidate, tag){
        console.log("some one has deleta a tag");
        console.log("here is candidate email: "+candidate.email);
        console.log("here is candidate tag: "+tag);
        var data = {
          email: candidate.email,
          deletedTag: tag
        };
        $http.post('/profile/delete-tag', data).then(function(response) {
          if (response.data.success) {
            var index = candidate.skills.indexOf(tag);
            if(index > -1 )
              candidate.skills.splice(index, 1);
          }
        });
      };
    }
  };
}])

.controller('CandidateAdditionalInfoCtrl', [
  '$scope', '$http', '$modalInstance', 'candidate',
  function($scope, $http, $modalInstance, candidate) {
    $scope.candidate = candidate;
    $http.get('/profile/candidate-campaigns', {
      params: {
        candidateEmail: candidate.email
      }
    }).then(function(response) {
      if (response.data.success) {
        $scope.campaigns = response.data.campaigns;
      }
    });
    $http.get('/profile/candidate-pixels', {
      params: {
        candidateEmail: candidate.email
      }
    }).then(function(response) {
      if (response.data.success) {
        $scope.pixels = response.data.pixels;
      }
    });

    $scope.close = function () {
      $modalInstance.dismiss();
    };
  }
  ])

.controller('MessageController', ['$scope', '$http', '$rootScope','$modal', function($scope, $http, $rootScope, $modal) {
  $rootScope.activeTab = 1;
  $http.get('/profile/messages/tracked')
    .success(function(data, status) { // jshint ignore: line

      data = data || [];
      window.data = data;

      function mapFunc(a) {
        var m, contact = {};
        if(a && (m = a.match(/^(.*?)<(.*?)>$/))) {
          contact = {
            name: m[1],
            email: m[2]
          };
        } else {
          contact = {
            email: a
          };
        }
        return contact;
      }
      for (var i = 0; i < data.length; i++) {
        var entry = data[i];
        var message = entry.message;
        message.cc = message.cc || [];
        message.bcc = message.bcc || [];
        entry.contributers = [message.from].concat(message.to, message.cc, message.bcc);

        entry.contributers = entry.contributers.map(mapFunc); // don't create functions in a loop, or at least tell jshint to shut up

      }
      $scope.messages = data;
    });

    $http.get('/user').then(function(resp) {
      $scope.user = resp.data;
    });

    $scope.showMessageDetails = function(item) {
      $modal.open({
        templateUrl: '/partials/message-details.html',
        controller: function($scope) {
          $scope.message = item;
        },
        scope: $scope
      });
    };
  }])

.controller('LikedCandidatesController', ['$scope', '$http', '$csv', '$modal', '$rootScope', function($scope, $http, $csv, $modal, $rootScope) {
  $scope.Math = window.Math;
  $scope.curPage = 0;
  $scope.pageSize = 10;
  $scope.allowRemove = true;
  $scope.showNextFollowUp = true;

  $rootScope.activeTab = 2;
  $scope.uploadCSV = uploadCSV;
  $http.get('/profile/list/liked')
    .success(function(data, status) { // jshint ignore: line
      $scope.candidates = data || [];

      downloadAsCSV($scope.candidates);
    });

    function saveCandidates(list, callback) {
      $http.put('/profile/list', list)
      .success(function(data, status) {
        if (status === 200 && data) {
          if(typeof(callback) === 'function') callback(data);
        }
      });
    }

    function showUploadStatistic(statistic) {
      $scope.uploadStatistic = statistic;
      $http.get('/profile/list/liked')
      .success(function(data, status) { // jshint ignore: line
        $scope.candidates = data || [];
        //$scope.$apply();
      });
      setTimeout(function() {
        delete $scope.uploadStatistic;
        $scope.$apply();
      }, 5000);
    }

    function uploadCSV($files) {
      //file is in the cache but user selects cancel button
      if(!$files.length){ return; }
      $scope.fileError = '';
      var file = $files[0];
      var ext = file.name.split('.').pop();
      if(['csv', 'txt'].indexOf(ext) === -1){
        $scope.fileError = 'Invalid file format. Allow csv or plain text only!';
        return;
      }

      $csv.upload($files, function onlist(list, statistic) {
        if (statistic.contacts !== 0) {
          saveCandidates(list, function(data) {
            statistic.uploaded = data.length;
            showUploadStatistic(statistic);
            $rootScope.$broadcast('MixpanelEvent', {
              name: 'CSV File uploaded',
              data: {}
            });
          });
        } else {
          statistic.uploaded = 0;
          showUploadStatistic(statistic);
        }
      });
    }

    function downloadAsCSV(candidates) {
      var csvContent  = "data:text/csv;charset=utf-8,";
      var downloadBtn = $('#downloadCSVBtn');
      var cvsFileName = "LikedCandidates.csv";

      for (var index in candidates) {
        var candidate       = candidates[index];
        var candidateFirstName   = (typeof candidate.firstName !== 'undefined' && candidate.firstName !== null) ? candidate.firstName        : '';
        var candidateLastName   = (typeof candidate.lastName !== 'undefined' && candidate.lastName !== null) ? candidate.lastName        : '';
        var candidateName = candidateFirstName + ' ' + candidateLastName;

        var candidateEmail  = (typeof candidate.email     !== 'undefined' && candidate.email     !== null) ? candidate.email            : '';
        var candidateSkills = (typeof candidate.skills    !== 'undefined' && candidate.skills    !== null) ? candidate.skills.join(' ') : '';

        csvContent += formatStringForCsv(candidateName) + ',' + formatStringForCsv(candidateEmail) + ',' + formatStringForCsv(candidateSkills) + "\n";
      }

      var encodedUri = encodeURI(csvContent);
      downloadBtn.attr("href", encodedUri);
      downloadBtn.attr("download", cvsFileName);

    }

    function formatStringForCsv(text) {
      if (text.search(/("|,|\n)/g) >= 0)
        text = '"' + text + '"';

      return text;
    }

    $scope.sendMixpanelDownloadEvent = function() {
      $rootScope.$broadcast('MixpanelEvent', {
        name: 'CSV file downloaded',
        data: {}
      });
    };

    $scope.addNewCandidate = function() {
      $modal.open({
        templateUrl: '/partials/candidates-add-modal.html',
        controller: 'CandidateAddController',
        resolve: {
          parentScope: function() {
            return $scope;
          }
        }
      });
    };
  }])

.controller('CandidateAddController', ['$scope', '$rootScope', '$http', '$modalInstance', 'parentScope',
  function($scope, $rootScope, $http, $modalInstance, parentScope) {
    var timeOut;
    console.log(parentScope);
    $scope.CandidateForm = {
      success: false,
      data: {
        name: '',
        email: '',
        tags: '',
        nextFollowUp: new Date()
      },
      submit: function() {
        $http.post('/profile/list/new', $scope.CandidateForm.data).then(function(response) {
          if (response.data.success) {
            $scope.CandidateForm.success = true;
            $scope.CandidateForm.errors = {};
            parentScope.candidates.push(response.data.candidate);
            timeOut = setTimeout(function(){
              $modalInstance.close();
            }, 4000);
            $rootScope.$broadcast('MixpanelEvent', {
              name: 'People added manually',
              data: {}
            });
          } else {
            $scope.CandidateForm.errors = response.data.errors;
          }
        });
      },
      again: function() {
        clearTimeout(timeOut);
        $scope.CandidateForm.data = {
          name: '',
          email: '',
          tags: '',
          nextFollowUp: new Date()
        };
        $scope.CandidateForm.success = false;
      }
    };

    $scope.close = function() {
      $modalInstance.close();
    };
  }
  ])

.controller('ConnectTwitterController', ['$scope', '$modalInstance', 'modalData', 'parentScope', 'isTwitterAuthorized', 'TwitterOauth', function($scope, $modalInstance, modalData, parentScope, isTwitterAuthorized, TwitterOauth) {
  $scope.close = $modalInstance.dismiss.bind($modalInstance, 'close');
  $scope.isTwitterAuthorized = isTwitterAuthorized;

  $scope.back = function() {
      // for some reason this requires a delay to dismiss the modal
      parentScope.openComposer(modalData);
      setTimeout($scope.close, 500);
    };
    $scope.next = function() {
      parentScope.openPersonalize(modalData);
      setTimeout($scope.close, 500);
    };
    $scope.disconnectTwitter = function() {
      TwitterOauth.disconnectTwitter().then(function() {
        $scope.isTwitterAuthorized = false;
        Twitter.checkTwitterAuthorizatin(); // jshint ignore: line
        // call this method to keep track of twitter connect status
      });
    };
    TwitterOauth.checkTwitterAuthorizatin().then(function(data) {
      if (data.length > 0) {
        for (var i = 0; i < data.length; i++) {
          if (data[i].domain === 'twitter.com') {
            $scope.isTwitterAuthorized = true;
            return;
          }
        }
        $scope.isTwitterAuthorized = true;
      }
    });
  }])

.controller('PersonalizeComposerController', ['$scope', '$http', '$modalInstance', 'recipients', 'parentScope', 'personalizeMessage', 'modalData', function($scope, $http, $modalInstance, recipients, parentScope, personalizeMessage, modalData) {
  var modalDataOrg = angular.copy(modalData);
  $scope.close = $modalInstance.dismiss.bind($modalInstance, 'close');
  $scope.modalData = modalData;
  modalData.candidates.forEach(addSalutation);
  $scope.back = function() {
    $modalInstance.close('back');
    parentScope.openComposer(modalDataOrg);
  };
  $scope.isMessageModified = function(message) {
    return message && message.modified;
  };
  $scope.recipients = recipients;

  $http.get('/user').success(function(data, status) {
    if (status !== 200)
      throw new Error('server error');
    modalData.signature = data.settings.signature;

    $scope.personalizeMessage = function(candidate) {
      personalizeMessage(candidate, modalData);
    };
  });

  function addSalutation(candidate) {
    if(!candidate.message){
      var firstName = '';
      if ($scope.modalData.useFirstName && candidate.firstName && candidate.firstName.length > 0) {
        firstName = ' ' + candidate.firstName;
      }
      candidate.message = angular.copy(modalData.defaultMessage);
      if(candidate.message.salutation) {
        candidate.message.content =
        candidate.message.salutation + firstName + ' -\n' +
        candidate.message.content;
      }
      if(modalData.signature) {
        candidate.message.content = candidate.message.content.trim();
        candidate.message.content += '\n\n' + modalData.signature;
      }
    }
  }
}])

.controller('PersonalizeMessageController', ['$scope', '$sce', '$modal', '$modalInstance', '$http', 'candidate', 'TwitterOauth', function($scope, $sce, $modal, $modalInstance, $http, candidate, TwitterOauth) {
  $scope.message = angular.copy(candidate.message);
  TwitterOauth.isTwitterAuthorized().then(function() {
    TwitterOauth.getRecentTweets(candidate.email).then(function(res) {
      $scope.handle = res.handle;
      $scope.recentTweets = res.tweets.slice(0, 3);

      $scope.recentTweets.forEach(function (tweet) {
        var urlRegex = /\(?(?:(http|https|ftp):\/\/)?(?:((?:[^\W\s]|\.|-|[:]{1})+)@{1})?((?:www.)?(?:[^\W\s]|\.|-)+[\.][^\W\s]{2,4}|localhost(?=\/)|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::(\d*))?([\/]?[^\s\?]*[\/]{1})*(?:\/?([^\s\n\?\[\]\{\}\#]*(?:(?=\.)){1}|[^\s\n\?\[\]\{\}\.\#]*)?([\.]{1}[^\s\?\#]*)?)?(?:\?{1}([^\s\n\#\[\]]*))?([\#][^\s\n]*)?\)?/gi;

          tweet.text = tweet.text.replace(urlRegex, function(text, link) { // jshint ignore: line
            return '<a target="_blank" href="'+ text +'">'+ text +'</a>';
          });

          tweet.text = $sce.trustAsHtml(tweet.text);
        });
    });
  });

  $http.get('/user').success(function(data, status) {

      var data; // jshint ignore: line

      if (status !== 200) {
        throw new Error('server error');
      }
      if(!data || !data.email) {
        throw new Error('failed to get user information');
      }

      $http.get('/google/threads?email=' + candidate.email + '&count=3').then(function(resp) {
        var threads = resp.data;

        if (!threads || !threads.length) {
          $scope.threads = [];
          return;
        }

        $scope.threads = threads.map(function (thread) {
          var message = thread.messages[0],
          headers = message.payload.headers,
          subject = headers.filter(function (header) {
            return header.name.toLowerCase() === 'subject';
          })[0].value,
          to = headers.filter(function (header) {
            return header.name.toLowerCase() === 'to';
          })[0].value,
          date = headers.filter(function (header) {
            return header.name.toLowerCase() === 'date';
          })[0].value,
          others = to.split(',').length - 1,
          link = 'http://mail.google.com/mail?account_id=' + data.email + '&message_id=' + thread.id + '&view=conv&extsrc=atom';

          return {
            subject: subject,
            others: others,
            date: new Date(date),
            link: link
          };
        });
      });
});

$scope.close = function(result) {
  if(result){
    candidate.message = result;
    candidate.message.modified = true;
  }
  $modalInstance.dismiss('close');
};
$scope.candidate = candidate;
}])

.controller('PreviewController', ['$scope', '$modal', '$http', '$modalInstance', 'modalData', 'parentScope',
  function($scope, $modal, $http, $modalInstance, modalData, parentScope) {
    $scope.close = function () {
      $modalInstance.dismiss();
      parentScope.$broadcast('sent');
    };
    $http.get('/user').success(function(data, status) {
      if (status !== 200)
        throw new Error('server error');
      modalData.signature = data.settings.signature;
      $scope.modalData = modalData;
    });

    $scope.back = function() {
      $modalInstance.close('back');
      parentScope.openComposer();
    };
    $scope.compose = parentScope.compose;
  }
  ])

.controller('CampaignRecipientsListController', ['$scope', '$modal', '$modalInstance', 'modalData',
  function($scope, $modal, $modalInstance, modalData) {
    $scope.close = $modalInstance.dismiss;
    $scope.modalData = modalData;
  }
  ])
.controller('CampaignEventsListCtrl', ['$scope', '$modal', '$modalInstance', 'modalData',
  function($scope, $modal, $modalInstance, modalData) {
    $scope.close = $modalInstance.dismiss;
    $scope.modalData = modalData;
  }
  ])
.controller('CampaignOpenListController', ['$scope', '$modal', '$modalInstance', 'modalData', 'parentScope', function($scope, $modal, $modalInstance, modalData, parentScope) { // jshint ignore: line
  $scope.close = $modalInstance.dismiss;
  $scope.modalData = modalData;
}])

.controller('ComposerController', ['$scope', '$http', '$modalInstance', 'list', '$q', 'parentScope', 'modalData', function($scope, $http, $modalInstance, list, $q, parentScope, modalData) {
  window.q = $q;
  $scope.back = $modalInstance.dismiss;
  $scope.remove = remove;
  $scope.salutations = ['Hello', 'Hey', 'Hi'];

    // get articles
    var tags = [];
    for (var i = 0; i < list.length; i++) {
      var candidate = list[i];
      for (var j = 0; j < candidate.skills.length; j++) {
        var tag = candidate.skills[j];
        if (tags.indexOf(tag) === -1) {
          tags.push(tag);
        }
      }
    }
    var options = {
      params: {
        tags: JSON.stringify(tags)
      }
    };
    $http.get('/profile/articles', options)
    .success(function (data, status) {
      if (status === 200 && data) {
        $scope.articles = data.articles;
        $scope.tags = data.tags;
      }
    });

    modalData = modalData || {
      defaultMessage: {},
      candidates : list ? angular.copy(list) : [],
      invalid : {},
      state : 'init'
    };

    if (modalData.defaultMessage.content) {
      modalData.defaultMessage.content = modalData.defaultMessage.content.replace(/<br \/>/g, '\n');
    }
    $scope.modalData = modalData;
    $scope.articleChanged = function(index) {
      var article = $scope.articles[index];

      //pass article data to modal
      $scope.modalData.defaultMessage.subject = article.title;
      $scope.modalData.defaultMessage.content = article.description + '<br/>' + article.link;
    };

    $scope.isPersonalMessage = false;
    $scope.useFirstName = false;

    $scope.next = function(personalize) {
      $modalInstance.close('close');
      if(personalize){
        parentScope.connectTwitter(modalData);
      } else {
        parentScope.openPreview(modalData);
      }
    };

    function remove(removed) {
      $scope.modalData.candidates = $scope.modalData.candidates.filter(function(value, index) {
        return index !== removed;
      });
    }
  }])

.controller('CreateCampaignsController', ['$scope', '$location', '$csv', '$modal', '$rootScope', '$http', 'Api', function($scope, $location, $csv, $modal, $rootScope, $http, Api) {
  $rootScope.activeTab = 3;

  var csvlist = [];
  $scope.tags = $location.search().tags;
  $scope.candidates = [];
  $scope.showNextFollowUp = false;
  $scope.search = search;
  $scope.openComposer = openComposer;
  $scope.openPersonalize = openPersonalize;
  $scope.connectTwitter = connectTwitter;
  $scope.personalizeMessage = personalizeMessage;
  $scope.composerAvailable = composerAvailable;
  $scope.openPreview = openPreview;
  $scope.compose = compose;
  $scope.uploadCSV = uploadCSV;

  $scope.$on('responseError', function(scope, err) {
      var errorProperties = typeof(err.data) === 'object' ? err.data : err; // jshint ignore: line
      var error = err;

      // if (errorProperties.message.indexOf("Access Not Configured") > -1) {
      //   error = {
      //     statusText: "Internal Server Error",
      //     message: ""
      //   }
      // };

      $modal.open({
        templateUrl: '/partials/error-message.html',
        controller: ['$scope', '$modalInstance', function($scope, $modalInstance) {
          $scope.error = error;
          $scope.close = $modalInstance.dismiss.bind($modalInstance, 'close');
        }]
      });
    });

    // message personaliztion is not fully implemented yet
    // TODO: consider grouping candidates by message
    function compose(modalData, personalize) {
      modalData.state = 'pending';

      Api.send(modalData, personalize)
      .then(function(response) {
        modalData.state = 'complete';
        $rootScope.$broadcast('settingsChange', {});
        $rootScope.$broadcast('MixpanelEvent', {
          name: 'Email Campaign Created',
          data: {
            campaignId: response.campaignId,
            customizedMessage: response.customizedMessage
          }
        });
      })
      .catch(function(data, status) {
        if(status === 401) {
          $location.href = '/';
        } else {
          // TODO: handle error messages
          modalData.state = 'init';
        }
      });
    }

    function connectTwitter(modalData) {
      $modal.open({
        templateUrl: '/partials/connect-twitter.html',
        controller: 'ConnectTwitterController',
        resolve: {
          modalData: function () {
            return modalData;
          },
          isTwitterAuthorized: function(TwitterOauth) {
            return TwitterOauth.isTwitterAuthorized();
          },
          parentScope: function() {
            return $scope;
          }
        }
      });
    }

    function openPersonalize(modalData) {
      var modal = $modal.open({
        templateUrl: '/partials/composer-personalize.html',
        controller: 'PersonalizeComposerController',
        scope: $scope,
        resolve: {
          recipients: function() { return $scope.candidates; },
          personalizeMessage: function() { return personalizeMessage; },
          modalData: function() { return modalData; },
          parentScope: function() { return $scope; }
        }
      });
      return modal;
    }

    function personalizeMessage (candidate, modalData) {
      console.debug('personalizeMessage with data: ', candidate, modalData);
      if(!candidate.message){
        var firstName = '';
        if (modalData.useFirstName && candidate.firstName && candidate.firstName.length > 0) {
          firstName = ' ' + candidate.firstName;
        }
        candidate.message = angular.copy(modalData.defaultMessage);
        if(candidate.message.salutation) {
          candidate.message.content =
          candidate.message.salutation + firstName +  ' -\n' +
          candidate.message.content;
        }
        if(modalData.signature) {
          candidate.message.content = candidate.message.content.trim();
          candidate.message.content += '\n\n' + modalData.signature;
        }
      }

      $scope.activeCadndidate = candidate;
      var modal = $modal.open({
        templateUrl: '/partials/personalize-message.html',
        controller: 'PersonalizeMessageController',
        size: 'lg',
        scope: $scope,
        resolve: {
          candidate: function() {
            return candidate;
          }
        }
      });
      return modal;
    }

    function openPreview (modalData) {
      var modal = $modal.open({
        templateUrl: '/partials/composer-preview.html',
        controller: 'PreviewController',
        scope: $scope,
        resolve: {
          modalData: function() {
            return modalData;
          },
          parentScope: function() {
            return $scope;
          }
        }
      });

      return modal;
    }

    if ($scope.tags) {
      queryCandidatesBySkill($scope.tags);
    }

    function composerAvailable() {
      return csvlist.length > 0 || $scope.candidates.length > 0;
    }

    function openComposer(modalData) {
      var composerInstance = $modal.open({
        templateUrl: '/views/jade_partials/composer',
        controller: 'ComposerController',
        windowClass: 'composer-modal',
        scope: $scope,
        resolve: {
          list: function getList() {
            return $scope.candidates.concat(csvlist);
          },
          modalData: function() {
            return modalData;
          },
          parentScope: function() {
            return $scope;
          }
        }
      });
      return composerInstance;
    }

    function uploadCSV($files) {
      $csv.upload($files, function onlist(list) {
        if (!list || list.length === 0)
          return alert('please make sure your csv file is valided and contain address column'); // jshint ignore: line
        csvlist = list;
        $scope.$apply();
        $rootScope.$broadcast('MixpanelEvent', {
          name: 'CSV File uploaded',
          data: {}
        });
        // auto open composer - removed, because user must click next button
        // openComposer();
      });
    }

    function search(e) {
      var $input = null;
      var tags = null;
      if (e.type === 'click') {
        $input = angular.element(e.target).parent().parent().children('input');
        tags = $input.val();
      } else if (e.type === 'keypress' && e.which === 13) {
        $input = angular.element(e.target);
        tags = $input.val();
      }
      if (!tags) return;
      queryCandidatesBySkill(tags);
    }

    function queryCandidatesBySkill(tags) {
      var url = '/profile/list?tags='+tags;
      $http.get(url)
      .success(function(data, status) {
        if (status === 200 && data)
          $scope.candidates = data.filter(function(candidate) {
            return candidate.email;
          });
      });
    }
  }])

.controller('ShowAnalyticsController', ['$scope', '$http', '$rootScope', '$modal', '$controller', '$route', '$timeout', '$q',
  function($scope, $http, $rootScope, $modal, $controller, $route, $timeout, $q) {
    $rootScope.activeTab = 4;

    $http.get('/mail/campaign/list')
      .success(function(data, status) { // jshint ignore: line
        data.campaigns = data.campaigns.map(function(campaign) {
          angular.extend(campaign, {
            recipientsCount: campaign.recipients.length,
            opens: campaign.recipientsViewed.length,
            openRate: (campaign.recipientsViewed.length / campaign.recipients.length)
          });
          return campaign;
        });
        $scope.campaigns = data.campaigns || [];
      });

      $scope.headers = [
      {title: 'Name', sorter: 'name'},
      {title: 'Date and Time Sent', sorter: 'sentTimestamp'},
      {title: 'Number of Recipients', sorter: 'recipientsCount'},
      {title: 'Opens', sorter: 'opens'},
        //{title: 'Events', sorter: 'events'},
        {title: 'Open rate', sorter: 'openRate'},
        ];
        $scope.setSorter = function(column) {
          var sorter = $scope.sorter,
          columnTitle = sorter.replace('-', '');
          if (column.sorter === columnTitle) {
            $scope.sorter = $scope.sorter.indexOf('-') === 0 ? columnTitle : '-' + $scope.sorter;
          } else {
            $scope.sorter = column.sorter;
          }
        };
        $scope.showRecipientsList = function(recipients, campName) {
          var modal = $modal.open({
            templateUrl: '/partials/campaign-recipients.html',
            controller: 'CampaignRecipientsListController',
            scope: $scope,
            resolve: {
              modalData: function() {
                return {
                  'campaignName': campName,
                  'recipients': recipients
                };
              },
              parentScope: function() {
                return $scope;
              }
            }
          });
          return modal;
        };
        $scope.showCampaignOpenList = function(modalData, campName) {
        // do not show the popup window if no recipients opened the email yet.
        if(!modalData || modalData.length === 0) return;

        // if there are recipients opened the campaign then show them
        var modal = $modal.open({
          templateUrl: '/partials/campaign-opens.html',
          controller: 'CampaignOpenListController',
          scope: $scope,
          resolve: {
            modalData: function() {
              var recipient, recipientsViewed = [];

              angular.forEach(modalData, function(item){
                // extract the name and emails separately
                recipient = item.split('<');

                // if there is an email component, then remove the anchors to show
                if(recipient.length >= 1) recipient[1] = recipient[1].replace('<', '').replace('>', '');

                // add the recipient as to the modalData
                recipientsViewed.push({ 'name': recipient[0], 'email': recipient[1]});
              });
              return { 'campaignName': campName, 'recipientsViewed': recipientsViewed};
            },
            parentScope: function() {
              return $scope;
            }
          }
        });
        return modal;
      };
      $scope.showEventsList = function(events, campName) {
        var modal = $modal.open({
          templateUrl: '/partials/campaign-events.html',
          controller: 'CampaignEventsListCtrl',
          scope: $scope,
          resolve: {
            modalData: function() {
              return {
                'campaignName': campName,
                'events': events
              };
            },
            parentScope: function() {
              return $scope;
            }
          }
        });
        return modal;
      };

        // This function gets called when user clicks on delete 'X' icon in the campaign list.
        // This shows up a confirm dialog box
        // If confirmed calls an API method to delete the campaign
        $scope.deleteCampaign = function (campaign) {
          var instance = $modal.open({
            templateUrl: '/partials/confirm-delete-campaign.html',
            scope: $scope,
            controller: ['$scope', '$modalInstance', function ($scope, $modalInstance) {
              $scope.campaign = campaign;
              window.$modalInstance = $modalInstance;
              $scope.close = function (result) {
                if (result) {
                  $modalInstance.close(result);
                } else {
                  $modalInstance.dismiss('closed');
                }
              };
            }]
          });
          instance.result.then(function () {
                // TODO: The best practice is to add all the http calls to a service object, since the current architecture does not have services the following direct call has been made
                $http.get('/profile/campaigns/delete/?id=' + campaign._id).then(function () {
                    // Delete the campaign from the local scope
                    $scope.campaigns.splice($scope.campaigns.indexOf(campaign), 1);
                  });
              });
        };

        $scope.cloneCampaign = function (campaign) {
          var instance = $modal.open({
            templateUrl: '/partials/confirm-clone-campaign.html',
            scope: $scope,
            controller: ['$scope', '$modalInstance', '$sce', function ($scope, $modalInstance, $sce) {
              campaign.contentHTML = $sce.trustAsHtml(campaign.content);
              $scope.campaign = campaign;
              window.$modalInstance = $modalInstance;
              $scope.close = function (result) {
                if (result) {
                  $modalInstance.close(result);
                } else {
                  $modalInstance.dismiss('closed');
                }
              };
            }]
          });

          instance.result.then(function () {
            $modal.open({
              templateUrl: '/views/jade_partials/composer',
              controller: 'ComposerController',
              windowClass: 'composer-modal',
              scope: $scope,
              resolve: {
                list: function () {
                  var defer = $q.defer();
                  var emails = campaign.recipients.map(function(recipient) {
                    return recipient.email;
                  });
                  var url = '/profile/list?emails='+emails.join(',');
                  $http.get(url).success(function(list) {
                    defer.resolve(list);
                  });
                  return defer.promise;
                },
                modalData: function () {
                  return {
                    defaultMessage: {
                      content: campaign.content,
                      subject: campaign.subject
                    },
                    candidates: campaign.recipients,
                    invalid: {},
                    state: 'init'
                  };
                },
                parentScope: function () {
                  $controller('CreateCampaignsController', {$scope: $scope});
                            $scope.$on('sent', function (scope, err) { // jshint ignore: line
                              $timeout($route.reload);
                            });
                            return $scope;
                          }
                        }
                      });
});
};

      // tab signups stuff
      $scope.currentHost = '';
      $scope.currentPath = '';

      $scope.pathChanged = function(path) {

        $scope.currentPath = path.path;
        $scope.referers[0].is_checked = true;

        $http.get('/optin/stats/conversions?host=' + $scope.currentHost + '&path=' + path.path)
        .success(function (response) {
          $scope.conversions = response;
        });
      };

      $scope.hostChanged = function(host) {
        $scope.currentHost = host.name;
        host.is_checked = true;
        $scope.referers = host.referers;
        if ($scope.referers.length > 0) {
          var path = $scope.referers[0];
          $scope.pathChanged(path);
        } else {
          $scope.currentPath = '';
          $scope.conversions = [];
        }
      };

      $scope.resetStats = function() {
        $http.get('/optin/stats/reset');
      };

      $http.get('/optin/stats')
      .success(function(response) {
        $scope.totals = response.totals;
        $scope.hosts = response.hosts;
        if ($scope.hosts.length > 0) {
          var host = $scope.hosts[0];
          $scope.hostChanged(host);
        }
      });
    }])

.config(function($routeProvider, $locationProvider, $httpProvider) {
  $routeProvider
  .when('/profile/', {
    templateUrl: '/partials/messages.html',
    controller: 'MessageController'
  })
  .when('/profile/messages', {
    templateUrl: '/partials/messages.html',
    controller: 'MessageController'
  })
  .when('/profile/candidates/people', {
    templateUrl: '/partials/liked-candidates.html',
    controller: 'LikedCandidatesController'
  })
  .when('/profile/campaigns/create', {
    templateUrl: '/partials/campaigns-create.html',
    controller: 'CreateCampaignsController'
  })
  .when('/profile/campaigns/show', {
    templateUrl: '/views/jade_partials/profile/campaigns/show',
    controller: 'ShowAnalyticsController'
  });

  $locationProvider.html5Mode(true);

  $httpProvider.interceptors.push(['$q', '$rootScope', function($q, $rootScope) {
    return {
      responseError: function(rejection) {
        $rootScope.$broadcast('responseError', rejection);
        $rootScope.pendingRequests--;
        return $q.reject(rejection);
      }
    };
  }]);
})

.controller('settings', ['$scope', '$http', '$timeout', function($scope, $http, $timeout) {
  $scope.settings = {};
  $scope.updated = false;
  $scope.update = function() {

    $http.put('/settings', $scope.settings).success(function() {
      $scope.updated = true;
      $timeout(function() {
        $scope.updated = false;
      }, 2000);
    });
  };
  $http.get('/user').success(function(data, status) {
    if (status !== 200)
      throw new Error('server error');
    $scope.settings = data.settings;
  });
}])

.controller('SettingsCtrl', ['$scope', '$http', '$timeout', 'TwitterOauth',
  function($scope, $http, $timeout, TwitterOauth) {
    $scope.settings = {};
    $scope.updated = false;
      //twitter social connect
      TwitterOauth.isTwitterAuthorized().then(function(data){
        for (var i = 0; i < data.length; i++) {
          if (data[i].domain === 'twitter.com') {
            $scope.isTwitterAuthorized = true;
            return;
          }
        }
      });
      $scope.ref = function(){
        $scope.isTwitterAuthorized = true;
        return;
      };
      $scope.disconnectTwitter = function() {
        TwitterOauth.disconnectTwitter().then(function() {
          $scope.isTwitterAuthorized = false;
        });
      };

      $scope.addNewUnit = function() {
        $scope.settings.returnMail.push({
          title: '',
          amount: 1
        });
      };
      $scope.removeUnit = function(unit, index) {
        $scope.settings.returnMail.splice(index, 1);
      };

      $scope.addFeedUrl = function() {
        if ($scope.settings.feedUrls.length < 5) {
          $scope.settings.feedUrls.push({
            name: '',
            tags: ''
          });
        }
      };
      $scope.removeFeedUrl = function(index) {
        $scope.settings.feedUrls.splice(index, 1);
      };

      $scope.update = function() {
        $http.put('/settings', $scope.settings).success(function(response) {
          $scope.updated = true;
          $timeout(function() {
            $scope.updated = false;
          }, 2000);
              chrome.runtime.sendMessage(response.extensionId, {type:'newsettings'}, function(res) { // jshint ignore: line
                if (!res) console.log('Error connect to chrome extension. Can not refresh gmail tab.');
              });
            });
      };
      $http.get('/user').success(function(data, status) {
        if (status !== 200)
          throw new Error('server error');
        $scope.settings = data.settings;
      });
    }])



.controller('profile', ['$scope', '$rootScope','$location', function($scope, $rootScope, $location) {

  $scope.search = search;
  $rootScope.$watch('activeTab', function() {
    $scope.activeTab = $rootScope.activeTab || 0;
  });

    function search($event) { // jshint ignore: line
      var $input = null;
      var tags = null;
      if (event.which === 13) {
        $input = angular.element(event.target);
        tags = $input.val();
      } else {
        return;
      }
      $input.val('');
      location.href = '/profile/campaigns/create?tags=' + tags;
    }

    $scope.redirectToPeople = function () {
      $location.path('/profile/candidates/people');
    };

  }])

.controller('pixel', ['$scope', '$http', '$timeout', function($scope, $http, $timeout) {
  var isGenerated = false;
  $scope.showError = false;
  $scope.isCollapsed = false;

  $scope.countActions = function(users) {
    var totalActions = 0;

    for (var i = 0; i < users.length; i++) {
      totalActions += users[i].actionsCount;
    }

    return totalActions;
  };

  $scope.getEvents = function() {
    $scope.events = [
    {
      name: 'PHP Job Post',
      totalUniqueUsers: 3,
      users: [
      {
        name: 'Jose',
        actionsCount: 2,
        lastActionDate: '2 days ago'
      },
      {
        name: 'John',
        actionsCount: 2,
        lastActionDate: '3 days ago'
      },
      {
        name: 'Mike',
        actionsCount: 1,
        lastActionDate: 'last week'
      }
      ]
    },
    {
      name: 'Ruby Job Post',
      totalUniqueUsers: 3,
      users: [
      {
        name: 'Rully',
        actionsCount: 7,
        lastActionDate: '1 day ago'
      },
      {
        name: 'Mohammed',
        actionsCount: 2,
        lastActionDate: '3 days ago'
      },
      {
        name: 'Karuna',
        actionsCount: 1,
        lastActionDate: 'last month'
      }
      ]
    }
    ];
  };

  $http.get('/pixel/current').success(function(data, status) {
    if (status !== 200)
      throw new Error('server error');
    $scope.pixel = '<div pixel="' + data.current + '"></div>';
    if ($scope.pixel.length > 0) {
      isGenerated = true;
    }
  });

  $scope.generatePixel = function() {
    if (isGenerated) {
      $scope.showError = true;
      $timeout(function() {
        $scope.showError = false;
      }, 3000);
      return;
    }
    isGenerated = true;

    $http.get('/pixel/generate', '').success(function(result) {
      $scope.pixel = '<div pixel="' + result.actualPixel + '"></div>';
    });
  };

}])
.directive('quoteInfo', ['$http', function($http) {
  return {
    templateUrl: '/partials/quote-info.html',
      link: function(scope, elm, attrs) { // jshint ignore: line
        scope.$on('settingsChange', update);
        function update () {
          $http.get('/user')
          .then(function(resp) {
            var settings = scope.settings = resp.data.settings;
            scope.settings.apiQuota.availableQuota = settings.apiQuota.dailyQuota - settings.apiQuota.messagesSent;
          })
          .catch(function(err) {
            scope.err = err;
          });
        }
        update();
      }
    };
  }])
.directive('rmTabs', ['$rootScope', '$location', '$window', function($rootScope, $location, $window) {
  return {
      link: function(scope, elm, attrs) { // jshint ignore: line
        var paths = [
        '/profile/messages',
        '/profile/candidates/people',
        '/profile/campaigns/create',
        '/profile/campaigns/show',
        '/optin',
        '/settings'
        ];
        $rootScope.$on('$routeChangeSuccess', function() {
          //optin does not come form angular route, it come from express
          //we have to use $window.location to redirect. should be changed after config other route.
          switch($location.path()){
            case '/optin':
            $window.location.href = '/optin';
            break;
            case '/settings':
            $window.location.href = '/settings';
            break;
            default:
            $rootScope.activeTab = paths.indexOf($location.path()) + 1;
            break;
          }
        });
      }
    };
  }])
.factory('Tracker', [function() {
  function _track(eventName, data) {
    window.mixpanel.track(eventName, data);
  }
  function _init(id) {
    window.mixpanel.identify(id);
    window.mixpanel.people.set({
      '$email': id
    });
  }

  return {
    init: _init,
    track: _track
  };

}]);
