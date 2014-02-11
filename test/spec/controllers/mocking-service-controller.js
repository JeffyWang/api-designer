'use strict';

describe('mockingServiceController', function () {
  var $q;
  var $scope;
  var mockingService;
  var sandbox;

  beforeEach(module('ramlEditorApp'));
  beforeEach(inject(function beforeEach($injector) {
    sandbox = sinon.sandbox.create();
    $q      = $injector.get('$q');
    $scope  = $injector.get('$rootScope').$new({
      mockingService: (mockingService = $injector.get('mockingService'))
    });

    sandbox.stub(mockingService, 'getMock', function getMock(file) {
      return $q.when(file.mock);
    });

    sandbox.stub(mockingService, 'createMock', function createMock(file) {
      return $q.when(file.mock || {});
    });

    sandbox.stub(mockingService, 'updateMock', function updateMock(mock) {
      return $q.when(mock);
    });

    sandbox.stub(mockingService, 'deleteMock', function deleteMock() {
      return $q.when();
    });
  }));

  afterEach(function afterEach() {
    sandbox.restore();
  });

  describe('with selected file', function () {
    describe('and mocking service enabled', function () {
      beforeEach(inject(function ($injector) {
        $injector.get('$controller')('mockingServiceController', {
          $scope: ($scope = angular.extend($scope, {
            fileBrowser: {
              selectedFile: {
                mock: {

                }
              }
            }
          }))
        });

        $scope.$apply();
      }));

      it('should set `$scope.enabled`', function () {
        $scope.should.have.property('enabled').and.be.true;
      });

      describe('when raml is updated', function () {
        beforeEach(function () {
          $scope.fileBrowser.selectedFile.raml = {};
          $scope.$apply();
        });

        it('should update mocking service', function () {
          mockingService.updateMock.should.have.been.called;
        });
      }); // when raml is updated

      describe('#toggleMockingService', function () {
        it('should disable mocking service', function () {
          $scope.toggleMockingService();
          $scope.$apply();

          $scope.should.have.property('enabled').and.be.false;
        });
      }); // #toggleMockingService
    }); // and mocking service enabled

    describe('and mocking service disabled', function () {
      beforeEach(inject(function ($injector) {
        $injector.get('$controller')('mockingServiceController', {
          $scope: ($scope = angular.extend($scope, {
            fileBrowser: {
              selectedFile: {
                mock: null
              }
            }
          }))
        });

        $scope.$apply();
      }));

      it('should unset `$scope.enabled`', function () {
        $scope.should.have.property('enabled').and.be.false;
      });

      describe('when raml is updated', function () {
        beforeEach(function () {
          $scope.fileBrowser.selectedFile.raml = {};
          $scope.$apply();
        });

        it('should not update mocking service', function () {
          mockingService.updateMock.should.not.have.been.called;
        });
      }); // when raml is updated

      describe('when switch to another file with mocking service enabled', function () {
        beforeEach(function () {
          $scope.fileBrowser.selectedFile = {
            mock: {
            }
          };

          $scope.$apply();
        });

        it('should update `$scope.enabled` and reflect mocking service state', function () {
          $scope.should.have.property('enabled').and.be.true;
        });

        it('should not update mocking service', function () {
          mockingService.updateMock.should.not.have.been.called;
        });
      }); // when switch to another file with mocking service enabled

      describe('#toggleMockingService', function () {
        it('should enable mocking service', function () {
          $scope.toggleMockingService();
          $scope.$apply();

          $scope.should.have.property('enabled').and.be.true;
        });
      }); // #toggleMockingService
    }); // and mocking service disabled
  }); // with selected file

  describe('without selected file', function () {
    beforeEach(inject(function ($injector) {
      $injector.get('$controller')('mockingServiceController', {
        $scope: ($scope = angular.extend($scope, {
          fileBrowser: {
          }
        }))
      });

      $scope.$apply();
    }));

    it('should unset `$scope.enabled`', function () {
      $scope.should.have.property('enabled').and.be.false;
    });

    describe('when switch to another file with mocking service enabled', function () {
      beforeEach(function () {
        $scope.fileBrowser.selectedFile = {
          mock: {
          }
        };

        $scope.$apply();
      });

      it('should update `$scope.enabled` and reflect mocking service state', function () {
        $scope.should.have.property('enabled').and.be.true;
      });
    }); // when switch to another file
  }); // without selected file
}); // mockingServiceController
