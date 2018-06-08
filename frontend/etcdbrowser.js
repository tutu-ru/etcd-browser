var app = angular.module("app", ["xeditable", "ngCookies"]);

function confirmExit(on) {
  if (on) {
    var overlay = document.createElement('div');
    var spinner = document.createElement('div');
    var loader  = document.createElement('div');
    loader.classList.add('loader');
    spinner.classList.add('spinner');
    overlay.classList.add('spinner-overlay');
    spinner.appendChild(loader);
    overlay.appendChild(spinner);
    document.body.insertBefore(overlay, document.getElementById('downloadAnchorElem'));
    window.onbeforeunload = function () { return true; };
  } else {
    return function () {
      window.onbeforeunload = null;
      document.body.removeChild(document.getElementsByClassName('spinner-overlay')[0]); 
    };
  }
}

app.controller('NodeCtrl', ['$scope', '$http', '$cookies', '$q', function ($scope, $http, $cookies, $q) {
  var keyPrefix = '/v2/keys',
    statsPrefix = '/v2/stats';

  if ($cookies.urlPrefix) {
    $scope.urlPrefix = $cookies.urlPrefix;
  } else {
    $scope.urlPrefix = ('https:' == document.location.protocol ? 'https://' : 'http://') + document.location.host;
  }

  $scope.getPrefix = function () {
    splitted = $scope.urlPrefix.split("/")
    return splitted[0] + "//" + splitted[2]
  }


  $scope.setActiveNode = function (node) {
    $scope.activeNode = node;
    if (!node.open) {
      $scope.toggleNode(node);
    } else {
      $scope.loadNode(node);
    }
  }

  function errorHandler(data, status, headers, config) {
    var message = data;
    if (data.message) {
      message = data.message;
    }
    $scope.error = "Request failed - " + message + " - " + config.url;
  }

  $scope.loadNode = function (node) {
    delete $scope.error;
    $http({
      method: 'GET',
      url: $scope.getPrefix() + keyPrefix + node.key
    }).
    success(function (data) {
      prepNodes(data.node.nodes, node);
      node.nodes = data.node.nodes;
      $scope.urlPrefix = $scope.getPrefix() + keyPrefix + node.key
    }).
    error(errorHandler);
  }

  $scope.toggleNode = function (node) {
    node.open = !node.open;
    if (node.open) {
      $scope.loadNode(node);
    } else {
      node.nodes = [];
    }
  };
  $scope.hasProperties = function (node) {
    for (var key in node.nodes) {
      if (!node.nodes[key].dir) {
        return true;
      }
    }
  }
  $scope.submit = function () {
    console.log($cookies);
    $cookies.urlPrefix = $scope.getPrefix();
    $scope.root = {
      key: '/'
    };
    delete $scope.activeNode;
    $scope.loadNode($scope.root);
  }
  $scope.addNode = function (node) {
    var name = prompt("Enter Property Name", "");
    var value = prompt("Enter Property value", "");
    if (!name || name == "") return;

    $http({
      method: 'PUT',
      url: $scope.getPrefix() + keyPrefix + node.key + (node.key != "/" ? "/" : "") + name,
      params: {
        "value": value
      }
    }).
    success(function (data) {
      $scope.loadNode(node);
    }).
    error(errorHandler);
  }

  $scope.updateNode = function (node, value) {
    $http({
      method: 'PUT',
      url: $scope.getPrefix() + keyPrefix + node.key,
      params: {
        "value": value
      }
    }).
    success(function (data) {
      $scope.loadNode(node);
    }).
    error(errorHandler);
  }

  $scope.deleteNode = function (node) {
    $http({
      method: 'DELETE',
      url: $scope.getPrefix() + keyPrefix + node.key
    }).
    success(function (data) {
      $scope.loadNode(node.parent);
    }).
    error(errorHandler);
  }

  $scope.copyNode = function (node) {
    var dirName = prompt("Copy property to directory", "/");
    if (!dirName || dirName == "") return;
    dirName = $scope.formatDir(dirName);
    $http({
      method: 'PUT',
      url: $scope.getPrefix() + keyPrefix + dirName + node.name,
      params: {
        "value": node.value
      }
    }).
    error(errorHandler);
  }

  $scope.createDir = function (node) {
    var dirName = prompt("Enter Directory Name", "");
    if (!dirName || dirName == "") return;
    $http({
      method: 'PUT',
      url: $scope.getPrefix() + keyPrefix + node.key + (node.key != "/" ? "/" : "") + dirName,
      params: {
        "dir": true
      }
    }).
    success(function (data) {
      $scope.loadNode(node);
    }).
    error(errorHandler);
  }

  $scope.copyDirAux = function (node, tarjet) {
    $http({
      method: 'GET',
      url: $scope.getPrefix() + keyPrefix + node.key
    }).
    success(function (data) {
      prepNodes(data.node.nodes, node);
      node.nodes = data.node.nodes;
      for (var key in node.nodes) {
        if (node.nodes[key].dir) {
          $scope.copyDirAux(node.nodes[key], tarjet + node.nodes[key].name + "/")
        } else {
          var url = $scope.getPrefix() + keyPrefix + tarjet + node.nodes[key].name
          $http({
            method: 'PUT',
            url: url,
            params: {
              "value": node.nodes[key].value
            }
          }).
          error(errorHandler);
        }
      }
    }).
    error(errorHandler);
  }

  $scope.copyDir = function (node) {
    var dirName = prompt("Copy properties to directory", node.key);
    if (!dirName || dirName == "") return;
    dirName = $scope.formatDir(dirName);
    $scope.copyDirAux(node, dirName)
  }

  $scope.deleteDir = function (node) {
    if (!confirm("Are you sure you want to delete " + node.key)) return;
    $http({
      method: 'DELETE',
      url: $scope.getPrefix() + keyPrefix + node.key + "?dir=true&recursive=true"
    }).
    success(function (data) {
      $scope.loadNode(node.parent);
    }).
    error(errorHandler);
  }

  $scope.formatDir = function (dirName) {
    if (dirName.substr(dirName.trim().length - 1) != '/') {
      dirName += '/';
    }
    return dirName;
  }

  $scope.serializeDir = function (node) {
    return $http({
      method: 'GET',
      url: $scope.getPrefix() + keyPrefix + node.key + '?recursive=true'
    }).
    success(function (data) {
      var serialized = {};
      prepNodesRecursive(data.node, serialized);
      var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(serialized, null, '\t'));
      var dlAnchorElem = document.getElementById('downloadAnchorElem');
      dlAnchorElem.setAttribute("href", dataStr);
      dlAnchorElem.setAttribute("download", data.node.key.replace(/\//ig, '_') + ".json");
      dlAnchorElem.click();
    }).
    error(errorHandler)
  }

  $scope.setTargetDir = function (node) {
    $scope.targetDir = node.key;
  }

  $scope.deserializeDir = function (target) {
    var file = $('#loadDirForm [name=file]')[0].files[0];
    if (!file || file.type !== 'application/json') {
      alert('Please select a json file');
    } else {
      if (confirm('Deserialize file to directory ' + target + '?')) {
        var reader = new FileReader();
        reader.onload = function (e) {
          var newBranch = JSON.parse(e.target.result);
          $http({
            method: 'GET',
            url: $scope.getPrefix() + keyPrefix + target + '?recursive=true'
          }).
          success(function (data) {
            var proceed = function () {
              $('#loadDirModal').modal('hide');
              confirmExit(true);
              setTimeout(function () {
                $scope.deserialize(newBranch, target, requestsAccumulator);
                $q.all(requestsAccumulator).then(confirmExit(false));
              }, 500);
            }
            var currentBranch = {};
            prepNodesRecursive(data.node, currentBranch);
            var coincidingNodes = {};
            compareBranches(currentBranch, newBranch, '', coincidingNodes);
            if (Object.keys(coincidingNodes).length > 0) {
              var message = 'There are matches in old and new config branches. Following nodes will be rewritten: \n';
              for (var key in coincidingNodes) {
                message += '\n' + key + ': ' + coincidingNodes[key][0] + ' -> ' + coincidingNodes[key][1];
              }
              if (confirm(message)) {
                proceed();
              }
            } else {
              proceed();
            }
          }).
          error(errorHandler)
        };
        reader.readAsText(file)
      }
    }
  }

  $scope.deserialize = function (branch, target, acc) {
    for (var key in branch) {
      if (typeof branch[key] === 'object') {
        $scope.deserialize(branch[key], target + '/' + key, acc);
      } else {
        var url = $scope.getPrefix() + keyPrefix + target + '/' + key;
        acc.push(
          $http({
            method: 'PUT',
            url: url,
            params: {
              "value": branch[key]
            }
          }).
          error(errorHandler)
        )
      }
    }
  }

  $scope.submit();

  function prepNodes(nodes, parent) {
    for (var key in nodes) {
      var node = nodes[key];
      var name = node.key.substring(node.key.lastIndexOf("/") + 1);
      node.name = name;
      node.parent = parent;
    }
  }

  function prepNodesRecursive(node, result) {
    for (var key in node.nodes) {
      var current = node.nodes[key];
      var name = current.key.substring(current.key.lastIndexOf("/") + 1);
      if (current.dir) {
        result[name] = {};
        prepNodesRecursive(current, result[name]);
      } else {
        result[name] = current.value;
      }
    }
  }

  function compareBranches(br1, br2, prefix, coinciding) {
    for (var key in br1) {
      if (typeof br1[key] === 'string') {
        if (br2.hasOwnProperty(key) && typeof br2[key] === 'string' && br2[key] !== br1[key]) {
          coinciding[(prefix ? prefix + '/' : '') + key] = [br1[key], br2[key]];
        }
      } else if (br2.hasOwnProperty(key) && typeof br2[key] === 'object') {
        compareBranches(br1[key], br2[key], (prefix ? prefix + '/' : '') + key, coinciding);
      }
    }
  }

  $scope.loadStats = function () {
    console.log("LOAD STATS");
    $scope.stats = {};
    $http({
      method: 'GET',
      url: $scope.getPrefix() + statsPrefix + "/store"
    }).
    success(function (data) {
      $scope.stats.store = JSON.stringify(data, null, " ");
    }).
    error(errorHandler);
    delete $scope.storeStats;
    $http({
      method: 'GET',
      url: $scope.getPrefix() + statsPrefix + "/leader"
    }).
    success(function (data) {
      $scope.stats.leader = JSON.stringify(data, null, " ");
    }).
    error(errorHandler);
    delete $scope.storeStats;
    $http({
      method: 'GET',
      url: $scope.getPrefix() + statsPrefix + "/self"
    }).
    success(function (data) {
      $scope.stats.self = JSON.stringify(data, null, " ");
    }).
    error(errorHandler);
  }

}]);

app.run(function (editableOptions) {
  editableOptions.theme = 'bs3';
});


$(document).ready(function () {
  var sticky = document.querySelector('#value-editor');
  var originalOffsetY = 0;

  function onScroll(e) {
    if (originalOffsetY == 0) {
      originalOffsetY = sticky.getBoundingClientRect().top;
    }
    if (window.pageYOffset >= originalOffsetY) {
      sticky.classList.add('fixed');
    } else {
      sticky.classList.remove('fixed');
    }
  }

  function onScrollIfInIframe() {
    if (window.parent.pageYOffset > 0) {
      sticky.style.transform = 'translateY(' + window.parent.pageYOffset + 'px)';
    } else {
      sticky.style.transform = null;
    }
  }

  document.addEventListener('scroll', onScroll);
  if (window != window.parent) {
    window.parent.addEventListener('scroll', onScrollIfInIframe);
  }
});