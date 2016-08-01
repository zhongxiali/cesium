/*global define*/
define([
        '../Core/Math',
        '../Core/defined',
        '../Core/defineProperties',
        '../Core/DeveloperError',
        '../Core/getTimestamp',
        '../Scene/CullingVolume'
    ], function(
        CesiumMath,
        defined,
        defineProperties,
        DeveloperError,
        getTimestamp,
        CullingVolume
    ) {
    'use strict';

    function QuadtreePrimitive(options) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(options) || !defined(options.tileProvider)) {
            throw new DeveloperError('options.tileProvider is required.');
        }
        if (defined(options.tileProvider.quadtree)) {
            throw new DeveloperError('A QuadtreeTileProvider can only be used with a single QuadtreePrimitive');
        }
        //>>includeEnd('debug');

        /**
         * Gets or sets the maximum screen-space error, in pixels, that is allowed.
         * A higher maximum error will render fewer tiles and improve performance, while a lower
         * value will improve visual quality.
         * @type {Number}
         * @default 1.3333
         */
        this.maximumScreenSpaceError = 4.0 / 3.0;

        this._tileProvider = options.tileProvider;

        this._rootTiles = undefined;
        this._tilesToRender = [];
        this._skeletonLoadQueue = [];
        this._highPriorityLoadQueue = [];
        this._lowPriorityLoadQueue = [];
        this._loadQueueTimeSlice = 5.0;

        this._debug = {
            enableDebugOutput : false,

            maxDepth : 0,
            tilesVisited : 0,
            tilesCulled : 0,
            tilesRendered : 0,
            tilesWaitingForChildren : 0,

            lastMaxDepth : -1,
            lastTilesVisited : -1,
            lastTilesCulled : -1,
            lastTilesRendered : -1,
            lastTilesWaitingForChildren : -1,

            suspendLodUpdate : false
        };
    }

    defineProperties(QuadtreePrimitive.prototype, {
        /**
         * Gets the provider of {@link QuadtreeTile} instances for this quadtree.
         * @type {QuadtreeTileProvider}
         * @memberof QuadtreePrimitive.prototype
         */
        tileProvider : {
            get : function() {
                return this._tileProvider;
            }
        }
    });

    /**
     * @private
     */
    QuadtreePrimitive.prototype.beginFrame = function(frameState) {
        var passes = frameState.passes;
        if (!passes.render) {
            return;
        }

        // Gets commands for any texture re-projections and updates the credit display
        this._tileProvider.initialize(frameState);

        var debug = this._debug;
        if (debug.suspendLodUpdate) {
            return;
        }

        debug.maxDepth = 0;
        debug.tilesVisited = 0;
        debug.tilesCulled = 0;
        debug.tilesRendered = 0;
        debug.tilesWaitingForChildren = 0;

        this._skeletonLoadQueue.length = 0;
        this._highPriorityLoadQueue.length = 0;
        this._lowPriorityLoadQueue.length = 0;

        //this._tileReplacementQueue.markStartOfRenderFrame();
    };

    /**
     * @private
     */
    QuadtreePrimitive.prototype.update = function(frameState) {
        this._tilesToRender.length = 0;

        if (!this._tileProvider.ready) {
            return;
        }

        if (!defined(this._rootTiles)) {
            this._rootTiles = this._tileProvider.createLevelZeroTiles();
        }

        var passes = frameState.passes;

        if (passes.render) {
            this._tileProvider.beginUpdate(frameState);

            selectTilesForRendering(this, frameState);
            createRenderCommandsForSelectedTiles(this, frameState);

            this._tileProvider.endUpdate(frameState);
        }

        if (passes.pick && this._tilesToRender.length > 0) {
            this._tileProvider.updateForPick(frameState);
        }
    };

    /**
     * @private
     */
    QuadtreePrimitive.prototype.endFrame = function(frameState) {
        var passes = frameState.passes;
        if (!passes.render) {
            return;
        }

        // Load/create resources for terrain and imagery.
        processTileLoadQueues(this, frameState);
        //updateHeights(this, frameState);

        // var debug = this._debug;
        // if (debug.suspendLodUpdate) {
        //     return;
        // }

        // if (debug.enableDebugOutput) {
        //     if (debug.tilesVisited !== debug.lastTilesVisited ||
        //         debug.tilesRendered !== debug.lastTilesRendered ||
        //         debug.tilesCulled !== debug.lastTilesCulled ||
        //         debug.maxDepth !== debug.lastMaxDepth ||
        //         debug.tilesWaitingForChildren !== debug.lastTilesWaitingForChildren) {

        //         console.log('Visited ' + debug.tilesVisited + ', Rendered: ' + debug.tilesRendered + ', Culled: ' + debug.tilesCulled + ', Max Depth: ' + debug.maxDepth + ', Waiting for children: ' + debug.tilesWaitingForChildren);

        //         debug.lastTilesVisited = debug.tilesVisited;
        //         debug.lastTilesRendered = debug.tilesRendered;
        //         debug.lastTilesCulled = debug.tilesCulled;
        //         debug.lastMaxDepth = debug.maxDepth;
        //         debug.lastTilesWaitingForChildren = debug.tilesWaitingForChildren;
        //     }
        // }
    };

    function selectTilesForRendering(primitive, frameState) {
        var rootTiles = primitive._rootTiles;
        var cameraPosition = frameState.camera.positionCartographic;

        for (var i = 0, len = rootTiles.length; i < len; ++i) {
            var rootTile = rootTiles[i];

            queueForHighPriorityLoad(primitive, rootTile);

            if (!rootTile.needsLoad) {
                selectTilesDepthFirst(primitive, frameState, rootTile, CullingVolume.MASK_INDETERMINATE, cameraPosition);
            }
        }
    }

    function selectTilesDepthFirst(primitive, frameState, tile, clippingPlaneMask, cameraPosition) {
        // `tile` is guaranteed to be a skeleton - so we can cull it and compute SSE - but
        // is not guaranteed to be fully loaded.

        var tileProvider = primitive._tileProvider;
        clippingPlaneMask = tile.cullAgainstFrustum(tileProvider, clippingPlaneMask);
        if (clippingPlaneMask === CullingVolume.MASK_OUTSIDE) {
            // This tile is outside the view frustum.
            queueForLowPriorityLoad(primitive, tile);
            return;
        }

        var isLeaf = !tileProvider.createTileChildrenIfNecessary(tile);
        if (isLeaf) {
            // Don't refine past a leaf tile.
            queueForHighPriorityLoad(primitive, tile);
            addToRenderList(primitive, tile);
            return;
        }

        var sse = computeScreenSpaceError(primitive, frameState, tile);
        if (sse > primitive.maximumScreenSpaceError) {
            // This tile meets the SSE requirements, render it.
            queueForHighPriorityLoad(primitive, tile);
            addToRenderList(primitive, tile);
            return;
        }

        var southwestChild = tile.southwestChild;
        var southeastChild = tile.southeastChild;
        var northwestChild = tile.northwestChild;
        var northeastChild = tile.northeastChild;

        if (!southwestChild.isSelectable || !southeastChild.isSelectable || !northwestChild.isSelectable || !northeastChild.isSelectable) {
            // One or more children are not selectable, so we can't compute their distance or SSE.
            // Queue the children to load their skeleton data and render this tile for now.
            queueForSkeletonLoad(primitive, southwestChild);
            queueForSkeletonLoad(primitive, southeastChild);
            queueForSkeletonLoad(primitive, northwestChild);
            queueForSkeletonLoad(primitive, northeastChild);
            queueForLowPriorityLoad(primitive, tile);
            addToRenderList(primitive, tile);
            return;
        }

        // Children are all skeletons and this tile doesn't meet SSE, so refine.
        queueForLowPriorityLoad(primitive, tile);
        selectChildrenNearToFar(primitive, frameState, clippingPlaneMask, cameraPosition, southwestChild, southeastChild, northwestChild, northeastChild);
    }

    function selectChildrenNearToFar(primitive, frameState, clippingPlaneMask, cameraPosition, southwest, southeast, northwest, northeast) {
        if (cameraPosition.longitude < southwest.east) {
            if (cameraPosition.latitude < southwest.north) {
                // Camera in southwest quadrant
                selectTilesDepthFirst(primitive, frameState, southwest, clippingPlaneMask, cameraPosition);
                selectTilesDepthFirst(primitive, frameState, southeast, clippingPlaneMask, cameraPosition);
                selectTilesDepthFirst(primitive, frameState, northwest, clippingPlaneMask, cameraPosition);
                selectTilesDepthFirst(primitive, frameState, northeast, clippingPlaneMask, cameraPosition);
            } else {
                // Camera in northwest quadrant
                selectTilesDepthFirst(primitive, frameState, northwest, clippingPlaneMask, cameraPosition);
                selectTilesDepthFirst(primitive, frameState, southwest, clippingPlaneMask, cameraPosition);
                selectTilesDepthFirst(primitive, frameState, northeast, clippingPlaneMask, cameraPosition);
                selectTilesDepthFirst(primitive, frameState, southeast, clippingPlaneMask, cameraPosition);
            }
        } else {
            if (cameraPosition.latitude < southwest.north) {
                // Camera southeast quadrant
                selectTilesDepthFirst(primitive, frameState, southeast, clippingPlaneMask, cameraPosition);
                selectTilesDepthFirst(primitive, frameState, southwest, clippingPlaneMask, cameraPosition);
                selectTilesDepthFirst(primitive, frameState, northeast, clippingPlaneMask, cameraPosition);
                selectTilesDepthFirst(primitive, frameState, northwest, clippingPlaneMask, cameraPosition);
            } else {
                // Camera in northeast quadrant
                selectTilesDepthFirst(primitive, frameState, northeast, clippingPlaneMask, cameraPosition);
                selectTilesDepthFirst(primitive, frameState, northwest, clippingPlaneMask, cameraPosition);
                selectTilesDepthFirst(primitive, frameState, southeast, clippingPlaneMask, cameraPosition);
                selectTilesDepthFirst(primitive, frameState, southwest, clippingPlaneMask, cameraPosition);
            }
        }
    }

    function queueForSkeletonLoad(primitive, tile) {
        if (tile && !tile.isSelectable) {
            primitive._skeletonLoadQueue.push(tile);
        }
    }

    function queueForLowPriorityLoad(primitive, tile) {
        if (tile && tile.needsLoad) {
            primitive._lowPriorityLoadQueue.push(tile);
        }
    }

    function queueForHighPriorityLoad(primitive, tile) {
        if (tile && tile.needsLoad) {
            primitive._highPriorityLoadQueue.push(tile);
        }
    }

    function computeScreenSpaceError(primitive, frameState, tile) {
        // TODO: screenSpaceError2D like QuadtreePrimitive.js
        var tileProvider = primitive._tileProvider;
        var geometricError = tileProvider.getLevelMaximumGeometricError(tile.level);
        if (geometricError === 0.0) {
            // Leaf nodes do not have any error so save the computation
            return 0.0;
        }

        // Avoid divide by zero when viewer is inside the tile
        var distance = Math.max(tile.computeDistanceFromViewer(frameState), CesiumMath.EPSILON7);
        var height = frameState.context.drawingBufferHeight;
        var sseDenominator = frameState.camera.frustum.sseDenominator;

        return (geometricError * height) / (distance * sseDenominator);
    }

    function addToRenderList(primitive, tile) {
        primitive._tilesToRender.push(tile);
    }

    function createRenderCommandsForSelectedTiles(primitive, frameState) {
        var tileProvider = primitive._tileProvider;
        var tilesToRender = primitive._tilesToRender;
        //var tilesToUpdateHeights = primitive._tileToUpdateHeights;

        for (var i = 0, len = tilesToRender.length; i < len; ++i) {
            var tile = tilesToRender[i];
            tileProvider.showTileThisFrame(tile, frameState);

            // if (tile._frameRendered !== frameState.frameNumber - 1) {
            //     tilesToUpdateHeights.push(tile);
            // }
            tile._frameRendered = frameState.frameNumber;
        }
    }

    function processTileLoadQueues(primitive, frameState) {
        var skeletonLoadQueue = primitive._skeletonLoadQueue;
        var highPriorityLoadQueue = primitive._highPriorityLoadQueue;
        var lowPriorityLoadQueue = primitive._highPriorityLoadQueue;

        if (skeletonLoadQueue.length === 0 && highPriorityLoadQueue.length === 0 && lowPriorityLoadQueue === 0) {
            return;
        }

        // Remove any tiles that were not used this frame beyond the number
        // we're allowed to keep.
        // primitive._tileReplacementQueue.trimTiles(primitive.tileCacheSize);

        var startTime = getTimestamp();
        var timeSlice = primitive._loadQueueTimeSlice;
        var endTime = startTime + timeSlice;

        var tileProvider = primitive._tileProvider;

        // Loading skeletons is our highest priority.
        for (var i = skeletonLoadQueue.length - 1; i >= 0; --i) {
            var tile = skeletonLoadQueue[i];
            tile.loadSelectionData(tileProvider, frameState);
            if (getTimestamp() >= endTime) {
                break;
            }
        }

        // Load high and low priority geometry.
        processTileLoadQueue(primitive, frameState, highPriorityLoadQueue, endTime);
        processTileLoadQueue(primitive, frameState, lowPriorityLoadQueue, endTime);
    }

    function processTileLoadQueue(primitive, frameState, tileLoadQueue, endTime) {
        var tileProvider = primitive._tileProvider;

        for (var i = tileLoadQueue.length - 1; i >= 0; --i) {
            var tile = tileLoadQueue[i];
            tile.loadRenderData(tileProvider, frameState);
            if (getTimestamp() >= endTime) {
                break;
            }
        }
    }

    return QuadtreePrimitive;
});
