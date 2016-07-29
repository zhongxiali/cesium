/*global define*/
define([
        '../Core/defaultValue',
        '../Core/defined',
        '../Core/defineProperties',
        '../Core/DeveloperError',
        '../Core/Rectangle',
        '../Renderer/RenderState',
        '../Scene/BlendingState',
        '../Scene/DepthFunction',
        './GlobeSurfaceTile2'
    ], function(
        defaultValue,
        defined,
        defineProperties,
        DeveloperError,
        Rectangle,
        RenderState,
        BlendingState,
        DepthFunction,
        GlobeSurfaceTile
    ) {
    'use strict';

    function GlobeSurfaceTileProvider(options) {
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

        this._tilesToRenderByTextureCount = [];
    }

    defineProperties(GlobeSurfaceTileProvider.prototype, {
        /**
         * Gets or sets the {@link QuadtreePrimitive} for which this provider is
         * providing tiles.  This property may be undefined if the provider is not yet associated
         * with a {@link QuadtreePrimitive}.
         * @memberof GlobeSurfaceTileProvider.prototype
         * @type {QuadtreePrimitive}
         */
        quadtree : {
            get : function() {
                return this._quadtree;
            },
            set : function(value) {
                //>>includeStart('debug', pragmas.debug);
                if (!defined(value)) {
                    throw new DeveloperError('value is required.');
                }
                //>>includeEnd('debug');

                this._quadtree = value;
            }
        },

        /**
         * Gets a value indicating whether or not the provider is ready for use.
         * @memberof GlobeSurfaceTileProvider.prototype
         * @type {Boolean}
         */
        ready : {
            get : function() {
                return this._terrainProvider.ready && (this._imageryLayers.length === 0 || this._imageryLayers.get(0).imageryProvider.ready);
            }
        }
    });

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

    /**
     * Creates the children of this tile (the {@link GlobeSurfaceTile#southwestChild}, {@link GlobeSurfaceTile#southeastChild},
     * {@link GlobeSurfaceTile#northwestChild}, and {@link GlobeSurfaceTile#northeastChild} properties) if they:
     *   * Exist, and
     *   * Have not already been created.
     * This method will either create all of the children or none of them.  Tiles with some but not all four of their children
     * are not allowed.  Also, this method will not be called for a tile unless that tile has at least its skeleton loaded.
     * @param {QuadtreeTile} tile The tile.
     * @returns {Boolean} True if this tile has four children; false if it is a leaf node with zero children.
     */
    GlobeSurfaceTileProvider.prototype.createTileChildrenIfNecessary = function(tile) {
        // We assume that either all or none of the child tiles exist, so only check one for quick return.
        if (defined(tile.southwestChild)) {
            return true;
        }

        // No children created yet, do any exist?
        var terrainProvider = this._terrainProvider;
        var childrenExist = false;
        if (!(tile.readyGeometry && tile.readyGeometry.data) && !defined(terrainProvider.getTileDataAvailable)) {
            // We can't tell if children are available, so assume they are.
            childrenExist = true;
        }

        childrenExist |= tile.readyGeometry && tile.readyGeometry.data && tile.readyGeometry.childTileMask > 0;

        var level = tile.level + 1;
        var x = tile.x * 2;
        var y = tile.y * 2;

        if (defined(terrainProvider.getTileDataAvailable)) {
            childrenExist |= defaultValue(terrainProvider.getTileDataAvailable(x, y, level), true) ||
                             defaultValue(terrainProvider.getTileDataAvailable(x + 1, y, level), true) ||
                             defaultValue(terrainProvider.getTileDataAvailable(x, y + 1, level), true) ||
                             defaultValue(terrainProvider.getTileDataAvailable(x + 1, y + 1, level), true);
        }

        if (childrenExist) {
            var tilingScheme = this._terrainProvider.tilingScheme;
            tile.northwestChild = new GlobeSurfaceTile(level, x, y, tilingScheme.tileXYToRectangle(x, y, level, rectangleScratch));
            tile.northeastChild = new GlobeSurfaceTile(level, x + 1, y, tilingScheme.tileXYToRectangle(x + 1, y, level, rectangleScratch));
            tile.southwestChild = new GlobeSurfaceTile(level, x, y + 1, tilingScheme.tileXYToRectangle(x, y + 1, level, rectangleScratch));
            tile.southeastChild = new GlobeSurfaceTile(level, x + 1, y + 1, tilingScheme.tileXYToRectangle(x + 1, y + 1, level, rectangleScratch));
            return true;
        }

        return false;
    };


    GlobeSurfaceTileProvider.prototype.getLevelMaximumGeometricError = function(level) {
        return this._terrainProvider.getLevelMaximumGeometricError(level);
    };

    /**
     * Called at the beginning of each render frame, before {@link QuadtreeTileProvider#showTileThisFrame}
     * @param {FrameState} frameState The frame state.
     */
    GlobeSurfaceTileProvider.prototype.initialize = function(frameState) {
        var imageryLayers = this._imageryLayers;

        // update collection: imagery indices, base layers, raise layer show/hide event
        imageryLayers._update();
        // update each layer for texture reprojection.
        imageryLayers.queueReprojectionCommands(frameState);

        // if (this._layerOrderChanged) {
        //     this._layerOrderChanged = false;

        //     // Sort the TileImagery instances in each tile by the layer index.
        //     this._quadtree.forEachLoadedTile(function(tile) {
        //         tile.data.imagery.sort(sortTileImageryByLayerIndex);
        //     });
        // }

        // Add credits for terrain and imagery providers.
        var creditDisplay = frameState.creditDisplay;

        if (this._terrainProvider.ready && defined(this._terrainProvider.credit)) {
            creditDisplay.addCredit(this._terrainProvider.credit);
        }

        for (var i = 0, len = imageryLayers.length; i < len; ++i) {
            var imageryProvider = imageryLayers.get(i).imageryProvider;
            if (imageryProvider.ready && defined(imageryProvider.credit)) {
                creditDisplay.addCredit(imageryProvider.credit);
            }
        }

        // var vertexArraysToDestroy = this._vertexArraysToDestroy;
        // var length = vertexArraysToDestroy.length;
        // for (var j = 0; j < length; ++j) {
        //     freeVertexArray(vertexArraysToDestroy[j]);
        // }
        // vertexArraysToDestroy.length = 0;
    };

    /**
     * Called at the beginning of the update cycle for each render frame, before {@link QuadtreeTileProvider#showTileThisFrame}
     * or any other functions.
     *
     * @param {FrameState} frameState The frame state.
     */
    GlobeSurfaceTileProvider.prototype.beginUpdate = function(frameState) {
        var tilesToRenderByTextureCount = this._tilesToRenderByTextureCount;
        for (var i = 0, len = tilesToRenderByTextureCount.length; i < len; ++i) {
            var tiles = tilesToRenderByTextureCount[i];
            if (defined(tiles)) {
                tiles.length = 0;
            }
        }

        this._usedDrawCommands = 0;
    };

    /**
     * Called at the end of the update cycle for each render frame, after {@link QuadtreeTileProvider#showTileThisFrame}
     * and any other functions.
     *
     * @param {FrameState} frameState The frame state.
     */
    GlobeSurfaceTileProvider.prototype.endUpdate = function(frameState) {
        if (!defined(this._renderState)) {
            this._renderState = RenderState.fromCache({ // Write color and depth
                cull : {
                    enabled : true
                },
                depthTest : {
                    enabled : true,
                    func : DepthFunction.LESS
                }
            });

            this._blendRenderState = RenderState.fromCache({ // Write color and depth
                cull : {
                    enabled : true
                },
                depthTest : {
                    enabled : true,
                    func : DepthFunction.LESS_OR_EQUAL
                },
                blending : BlendingState.ALPHA_BLEND
            });
        }

        // Add the tile render commands to the command list, sorted by texture count.
        var tilesToRenderByTextureCount = this._tilesToRenderByTextureCount;
        for (var textureCountIndex = 0, textureCountLength = tilesToRenderByTextureCount.length; textureCountIndex < textureCountLength; ++textureCountIndex) {
            var tilesToRender = tilesToRenderByTextureCount[textureCountIndex];
            if (!defined(tilesToRender)) {
                continue;
            }

            for (var tileIndex = 0, tileLength = tilesToRender.length; tileIndex < tileLength; ++tileIndex) {
                addDrawCommandsForTile(this, tilesToRender[tileIndex], frameState);
            }
        }
    };

    GlobeSurfaceTileProvider.prototype.computeDistanceToTile = function(tile, frameState) {
    };

    GlobeSurfaceTileProvider.prototype.showTileThisFrame = function(tile) {
    };

    function addDrawCommandsForTile(tileProvider, tile, frameState) {
    }

    return GlobeSurfaceTileProvider;
});