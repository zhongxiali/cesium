/*global define*/
define([
        '../Core/defined',
        '../Core/defineProperties',
        '../Core/DeveloperError',
        '../Core/Rectangle',
        './ImageryState',
        './TerrainState',
        './TileBoundingRegion',
        './TileOfTerrainData'
    ], function(
        defined,
        defineProperties,
        DeveloperError,
        Rectangle,
        ImageryState,
        TerrainState,
        TileBoundingRegion,
        TileOfTerrainData
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

        this.rectangle = Rectangle.clone(rectangle);

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
         * @type {TileOfTerrainData}
         */
        this.loading = undefined;

        /**
         * @type {TileOfTerrainData}
         */
        this.ready = undefined;

        /**
         * Gets or sets the range of texture coordinates for which to render the {@link GlobeSurfaceTile#ready} tile's vertexArray.  If the tile is loaded with its own
         * data, this property is undefined.  If the vertexArray belongs to an ancestor tile, it specifies the range of parent texture
         * coordinates, where x=west, y=south, z=east, w=north, that fall within this tile's extent.  0 is the southwest corner of the terrain tile, 1 is the
         * northeast.
         * @type {Cartesian4}
         */
        this.readyTextureCoordinateRectangle = undefined;

        /**
         * @type {ImageryTileOnTerrain[]}
         */
        this.imagery = undefined;

        /**
         * True if this tile has further loading to do; otherwise, false.
         * @type {Boolean}
         */
        this.needsLoad = true;
    }

    defineProperties(GlobeSurfaceTile.prototype, {
        /**
         * Gets a value indicating if this tile is selectable.  A selectable tile has a valid and accurate bounding volume
         * such that we can determine if the tile is in view and can estimate its screen-space error.  Selectable tiles usually
         * also know if they have child tiles, though some terrain providers may choose to assume that all child tiles exist
         * until they fail to load.
         * @memberOf GlobeSurfaceTile.prototype
         * @type {Boolean}
         */
        isSelectable : {
            get : function() {
                return defined(this.region);
            }
        }
    });

    GlobeSurfaceTile.prototype.cullAgainstFrustum = function(tileProvider, clippingPlaneMask) {
    };

    GlobeSurfaceTile.prototype.computeDistanceFromViewer = function(frameState) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(this.region)) {
            throw new DeveloperError('Cannot compute the distance to a tile that does not have selection data loaded.');
        }
        //>>includeEnd('debug');
        return this.region.distanceToCamera(frameState);
    };

    GlobeSurfaceTile.prototype.loadRenderData = function(tileProvider, frameState) {
        this.needsLoad = loadTerrain(this, tileProvider, frameState);
        this.needsLoad = loadImagery(this, tileProvider, frameState) || this.needsLoad;
        return this.needsLoad;
    };

    GlobeSurfaceTile.prototype.loadSelectionData = function(tileProvider, frameState) {

    };

    function loadTerrain(tile, tileProvider, frameState) {
        if (!tile.loading) {
            if (tile.ready && !tile.readyTextureCoordinateRectangle) {
                // Terrain is already loaded.
                return false; // done loading
            }

            tile.loading = new TileOfTerrainData(tile.x, tile.y, tile.level);
        }

        // TODO: if we're only loading the selection dasta, we can stop the load process earlier.
        tile.loading.load(tileProvider.terrainProvider, frameState);

        // When selection data becomes available, use it to to create a bounding region.
        if (!tile.region && tile.loading.data && !tile.loading.data.then) {
            var data = tile.loading.data;
            tile.region = new TileBoundingRegion({
                rectangle: tile.rectangle,
                // TODO: min/max height accessed as private properties, and not available at all on heightmap terrain.
                minimumHeight: data._minimumHeight,
                maximumHeight: data._maximumHeight,
                ellipsoid: tileProvider.terrainProvider.ellipsoid
            });
        }

        if (tile.loading.state === TerrainState.READY) {
            if (defined(tile.ready)) {
                tile.ready.releaseReference();
            }
            tile.ready = tile.loading;
            tile.loading = undefined;

            return false; // done loading
        }

        return true; // needs more loading
    }

    function loadImagery(tile, tileProvider, frameState) {
        var i;
        var len;

        if (!tile.imagery) {
            // Map imagery tiles to this terrain tile
            var imageryLayers = tileProvider.imageryLayers;
            tile.imagery = [];
            for (i = 0, len = imageryLayers.length; i < len; ++i) {
                var layer = imageryLayers.get(i);
                if (layer.show) {
                    layer._createTileImagerySkeletons(tile, tileProvider.terrainProvider);
                }
            }
        }

        var isUpsampledOnly = true;
        var isDoneLoading = true;

        var imageryTilesOnTerrain = tile.imagery;
        for (i = 0, len = imageryTilesOnTerrain.length; i < len; ++i) {
            var imageryTileOnTerrain = imageryTilesOnTerrain[i];
            if (!defined(imageryTileOnTerrain.loading)) {
                isUpsampledOnly = false;
                continue;
            }

            if (imageryTileOnTerrain.loading.state === ImageryState.PLACEHOLDER) {
                var imageryLayer = imageryTileOnTerrain.loading.imageryLayer;
                if (imageryLayer.imageryProvider.ready) {
                    // Remove the placeholder and add the actual skeletons (if any)
                    // at the same position.  Then continue the loop at the same index.
                    imageryTileOnTerrain.freeResources();
                    imageryTilesOnTerrain.splice(i, 1);
                    imageryLayer._createTileImagerySkeletons(tile, tileProvider.terrainProvider, i);
                    --i;
                    len = imageryTilesOnTerrain.length;
                    continue;
                } else {
                    isUpsampledOnly = false;
                }
            }

            var thisTileDoneLoading = imageryTileOnTerrain.processStateMachine(frameState, tile.rectangle);
            isDoneLoading = isDoneLoading && thisTileDoneLoading;

            // The imagery is renderable as soon as we have any renderable imagery for this region.
            // isRenderable = isRenderable && (thisTileDoneLoading || defined(imageryTileOnTerrain.readyImagery));

            // isUpsampledOnly = isUpsampledOnly && defined(imageryTileOnTerrain.loadingImagery) &&
            //                   (imageryTileOnTerrain.loadingImagery.state === ImageryState.FAILED || imageryTileOnTerrain.loadingImagery.state === ImageryState.INVALID);
        }

        return !isDoneLoading;
    }

    return GlobeSurfaceTile;
});