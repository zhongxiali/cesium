/*global define*/
define([
        '../Core/DeveloperError'
    ], function(
        DeveloperError
    ) {
    'use strict';

    function GlobeSurfaceTile(level, x, y, rectangle) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(level)) {
            throw new DeveloperError('level is required.');
        }
        if (!defined(x)) {
            throw new DeveloperError('x is required.');
        }
        if (!defined(y)) {
            throw new DeveloperError('y is required.');
        }
        if (!defined(rectangle)) {
            throw new DeveloperError('rectangle is required.');
        }
        //>>includeEnd('debug');

        this.level = level;
        this.x = x;
        this.y = y;

        this.west = rectangle.west;
        this.south = rectangle.south;
        this.east = rectangle.east;
        this.north = rectangle.north;

        /**
         * @type {TileBoundingRegion}
         */
        this.region = undefined;

        /**
         * @type {GlobeSurfaceTile}
         */
        this.parent = undefined;

        /**
         * @type {GlobeSurfaceTile}
         */
        this.southwestChild = undefined;

        /**
         * @type {GlobeSurfaceTile}
         */
        this.southeastChild = undefined;

        /**
         * @type {GlobeSurfaceTile}
         */
        this.northwestChild = undefined;

        /**
         * @type {GlobeSurfaceTile}
         */
        this.northeastChild = undefined;

        /**
         * @type {TileTerrain}
         */
        this.loadingGeometry = undefined;

        /**
         * @type {TileTerrain}
         */
        this.readyGeometry = undefined;

        /**
         * @type {TileImagery[]}
         */
        this.imageryTiles = [];
    }

    GlobeSurfaceTile.prototype.isLoaded = function(tileProvider) {
        return defined(this.readyGeometry);
    };

    GlobeSurfaceTile.prototype.isSkeleton = function(tileProvider) {
        return defined(this.region);
    };

    GlobeSurfaceTile.prototype.isLeaf = function(tileProvider) {
    };

    GlobeSurfaceTile.prototype.getSouthwestChild = function(tileProvider) {
    };

    GlobeSurfaceTile.prototype.getSoutheastChild = function(tileProvider) {
    };

    GlobeSurfaceTile.prototype.getNorthwestChild = function(tileProvider) {
    };

    GlobeSurfaceTile.prototype.getNortheastChild = function(tileProvider) {
    };

    return GlobeSurfaceTile;
});