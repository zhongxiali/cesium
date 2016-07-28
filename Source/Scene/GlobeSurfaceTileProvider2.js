/*global define*/
define([
        './GlobeSurfaceTile2'
    ], function(
        GlobeSurfaceTile
    ) {
    'use strict';

    function GlobeSurfaceTileProvider() {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(options)) {
            throw new DeveloperError('options is required.');
        }
        if (!defined(options.terrainProvider)) {
            throw new DeveloperError('options.terrainProvider is required.');
        } else if (!defined(options.imageryLayers)) {
            throw new DeveloperError('options.imageryLayers is required.');
        } else if (!defined(options.surfaceShaderSet)) {
            throw new DeveloperError('options.surfaceShaderSet is required.');
        }
        //>>includeEnd('debug');

        this._terrainProvider = options.terrainProvider;
        this._imageryLayers = options.imageryLayers;
        this._surfaceShaderSet = options.surfaceShaderSet;
    }

    var rectangleScratch = new Rectangle();

    GlobeSurfaceTileProvider.prototype.createLevelZeroTiles = function() {
        var tilingScheme = this._terrainProvider.tilingScheme;

        var numberOfLevelZeroTilesX = tilingScheme.getNumberOfXTilesAtLevel(0);
        var numberOfLevelZeroTilesY = tilingScheme.getNumberOfYTilesAtLevel(0);

        var result = new Array(numberOfLevelZeroTilesX * numberOfLevelZeroTilesY);

        var index = 0;
        for (var y = 0; y < numberOfLevelZeroTilesY; ++y) {
            for (var x = 0; x < numberOfLevelZeroTilesX; ++x) {
                var rectangle = tilingScheme.tileXYToRectangle(x, y, 0, rectangleScratch);
                result[index++] = new GlobeSurfaceTile(0, x, y, rectangle);
            }
        }

        return result;
    };

    GlobeSurfaceTileProvider.prototype.isSkeletonLoaded = function(tile) {
    };

    GlobeSurfaceTileProvider.prototype.isGeometryLoaded = function(tile) {
    };

    GlobeSurfaceTileProvider.prototype.loadSkeleton = function(tile) {
    };

    GlobeSurfaceTileProvider.prototype.loadGeometry = function(tile) {
    };

    GlobeSurfaceTileProvider.prototype.cullAgainstFrustum = function(tile) {
    };

    GlobeSurfaceTileProvider.prototype.computeDistanceToTile = function(tile, frameState) {
    }

    GlobeSurfaceTileProvider.prototype.showTileThisFrame = function(tile) {
    };

    return GlobeSurfaceTileProvider;
});