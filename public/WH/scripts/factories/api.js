angular.module('procom').factory('Api', ['$http', function ($http) {

//  var hosts = {
//    user: '/user/',
//    organizations: '/api/admin/organizations/',
//    lists: '/api/admin/lists/',
//    users: '/api/admin/users/',
//    templates: '/api/admin/templates/',
//    campaigns: '/api/admin/campaigns/',
//    variables: '/api/admin/campaigns/variables/',
//    research: '/api/admin/research/'
//  };
//
//  // user
//  function _user () {
//    return $http.get(hosts.user);
//  }
//
//  // organizations
//  function _organizations_query () {
//    return $http.get(hosts.organizations);
//  }
//
//  function _organizations_save (params) {
//    return $http.post(hosts.organizations, params);
//  }
//
//  function _organizations_update (id, params) {
//    return $http.put(hosts.organizations + id, params);
//  }
//
//  function _organizations_delete (id) {
//    return $http.delete(hosts.organizations + id);
//  }
//
//  function _organizations_users (params) {
//    return $http.post(hosts.organizations + 'users');
//  }
//
//  // lists
//  function _lists_query () {
//    return $http.get(hosts.lists);
//  }
//
//  function _lists_get (id) {
//    return $http.get(hosts.lists + id);
//  }
//
//  function _lists_update (id, params) {
//    return $http.put(hosts.lists + id, params);
//  }
//
//  // users
//  function _users_query (params) {
//    return $http.get(hosts.users, {params: params});
//  }
//
//  function _users_total (params) {
//    return $http.get(hosts.users + 'total', {params: params});
//  }
//
//  function _users_loginas (id) {
//    return $http.post(hosts.users + id + '/login');
//  }
//
//  // templates
//  function _templates_query () {
//    return $http.get(hosts.templates);
//  }
//
//  function _templates_get (id) {
//    return $http.get(hosts.templates + id);
//  }
//
//  // campaigns
//  function _campaigns_pending (id) {
//    return $http.get(hosts.campaigns + 'pending', {params: {listId: id}});
//  }
//
//  function _campaigns_create (params) {
//    return $http.post(hosts.campaigns, {params: params});
//  }
//
//  function _campaigns_delete (params) {
//    return $http.delete(hosts.campaigns, {params: params});
//  }
//
//  // variables
//  function _variables_query (params) {
//    return $http.get(hosts.variables, {params: params});
//  }
//
//  function _variables_update (params) {
//    return $http.put(hosts.variables, params);
//  }
//
//  // research
//  function _research_upload (file) {
//    return $http({
//      method: 'POST',
//      url: hosts.research,
//      headers: {
//        'Content-Type': 'multipart/form-data'
//      },
//      data: {
//        file: file
//      },
//      transformRequest: function (data, headersGetter) {
//        var formData = new FormData();
//        formData.append('file', data.file);
//
//        var headers = headersGetter();
//        delete headers['Content-Type'];
//
//        return formData;
//      }
//    });
//  }
//
//  return {
//    user: _user,
//    organizations: {
//      query: _organizations_query,
//      save: _organizations_save,
//      update: _organizations_update,
//      delete: _organizations_delete,
//      users: _organizations_users
//    },
//    lists: {
//      query: _lists_query,
//      get: _lists_get,
//      update: _lists_update
//    },
//    users: {
//      query: _users_query,
//      total: _users_total,
//      loginAs: _users_loginas
//    },
//    templates: {
//      query: _templates_query,
//      get: _templates_get
//    },
//    campaigns: {
//      pending: _campaigns_pending,
//      create: _campaigns_create,
//      delete: _campaigns_delete
//    },
//    variables: {
//      query: _variables_query,
//      update: _variables_update
//    },
//    research: {
//      upload: _research_upload
//    }
//  };
}]);