'use strict';

angular.module('ramlEditorApp')
  .controller('mockingServiceController', function mockingServiceControllerFactory(
    $scope,
    mockingService
  ) {
    function addBaseUri() {
      if (!$scope.editor) {
        return;
      }

      var baseUriLine = 'baseUri: ' + $scope.mock.baseUri;
      var lineNumber  = void(0);
      var line        = void(0);

      if ($scope.editor.getValue().trim().length === 0) {
        $scope.editor.setLine(0, baseUriLine);
        return;
      }

      for (lineNumber = $scope.editor.lineCount() - 1; lineNumber >= 0; lineNumber--) {
        line = $scope.editor.getLine(lineNumber).trim();

        if (line.indexOf('baseUri: ') === 0) {
          if (line === baseUriLine) {
            return;
          }

          line = '#' + line;
          break;
        }

        if (line.indexOf('title: ') === 0) {
          break;
        }

        if (line.indexOf('---') === 0) {
          break;
        }

        if (line.indexOf('#%RAML 0.8') === 0) {
          break;
        }
      }

      $scope.editor.setLine(lineNumber, line + '\n' + baseUriLine);
    }

    function removeBaseUri() {
      if (!$scope.editor) {
        return;
      }

      var baseUriLine = 'baseUri: ' + $scope.mock.baseUri;
      var lineNumber  = void(0);
      var line        = void(0);

      // trying to find mocked baseUri
      // and remove it
      for (lineNumber = 0; lineNumber < $scope.editor.lineCount(); lineNumber++) {
        line = $scope.editor.getLine(lineNumber).trim();

        if (line === baseUriLine) {
          $scope.editor.removeLine(lineNumber);
          break;
        }
      }

      // trying to find previous commented out baseUri
      // and uncomment it
      for (lineNumber = Math.min(lineNumber, $scope.editor.lineCount() - 1); lineNumber >= 0; lineNumber--) {
        line = $scope.editor.getLine(lineNumber).trim();

        if (line.indexOf('#') === 0 && line.slice(1).trim().indexOf('baseUri: ') === 0) {
          $scope.editor.setLine(lineNumber, line.slice(1).trim());
          break;
        }
      }
    }

    function loading(promise) {
      $scope.loading = true;
      return promise.finally(function onFinally() {
        $scope.loading = false;
      });
    }

    function setMock(mock) {
      $scope.mock    = mock;
      $scope.enabled = !!mock;
    }

    function getMock() {
      loading(mockingService.getMock($scope.fileBrowser.selectedFile)
        .then(setMock)
      );
    }

    function createMock() {
      loading(mockingService.createMock($scope.fileBrowser.selectedFile, $scope.fileBrowser.selectedFile.raml)
        .then(setMock)
        .then(addBaseUri)
      );
    }

    function updateMock() {
      mockingService.updateMock($scope.fileBrowser.selectedFile, $scope.fileBrowser.selectedFile.raml)
        .then(setMock)
      ;
    }

    function deleteMock() {
      loading(mockingService.deleteMock($scope.fileBrowser.selectedFile)
        .then(function () {
          removeBaseUri();
        })
        .then(setMock)
      );
    }

    $scope.toggleMockingService = function toggleMockingService($event) {
      if ($event) {
        $event.preventDefault();
      }

      if (!$scope.fileBrowser.selectedFile) {
        return;
      }

      if ($scope.enabled) {
        deleteMock();
        return;
      }

      createMock();
    };

    $scope.$watch('fileBrowser.selectedFile', function watch(newValue) {
      if (newValue) {
        getMock();
      } else {
        setMock();
      }
    });

    $scope.$watch('fileBrowser.selectedFile.raml', function watch() {
      if ($scope.enabled) {
        updateMock();
      }
    });
  })
;
