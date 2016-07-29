/*global define*/
define([
        '../Core/defined',
        '../Core/defineProperties',
        '../Core/DeveloperError',
        './TileTerrain2'
    ], function(
        defined,
        defineProperties,
        DeveloperError,
        TileTerrain
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

    defineProperties(GlobeSurfaceTile.prototype, {
        isSkeletonReady : {
            get : function() {
                return defined(this.region);
            }
        },

        isLoaded : {
            get : function() {
                return defined(this.readyGeometry) && !defined(this.loadingGeometry);
            }
        }
    });

    GlobeSurfaceTile.prototype.cullAgainstFrustum = function(tileProvider, clippingPlaneMask) {
    };

    GlobeSurfaceTile.prototype.loadGeometry = function(tileProvider, frameState) {
        loadTerrain(this, tileProvider, frameState);
        loadImagery(this, tileProvider, frameState);
    };

    GlobeSurfaceTile.prototype.loadSkeleton = function(tileProvider, frameState) {
    };

    function loadTerrain(tile, tileProvider, frameState) {
        if (!tile.loadingGeometry) {
            if (tile.readyGeometry && !tile.readyGeometry.geographicTextureCoordinateSubset) {
                // Terrain is already loaded.
                return;
            }

            tile.loadingGeometry = new TileTerrain();
        }

        tile.loadingGeometry.load(tile, tileProvider, frameState);
    }

    function loadImagery(tile, tileProvider, frameState) {
    }

    return GlobeSurfaceTile;
});