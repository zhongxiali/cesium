/*global define*/
define([
        '../Core/Math',
        '../Core/defined',
        '../Core/DeveloperError',
        '../Scene/CullingVolume'
    ], function(
        CesiumMath,
        defined,
        DeveloperError,
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
        this._traversalStack = [];
        this._skeletonLoadQueue = [];
        this._highPriorityLoadQueue = [];
        this._lowPriorityLoadQueue = [];
    }

    /**
     * @private
     */
    QuadtreePrimitive.prototype.update = function(frameState) {
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

    function selectTilesForRendering(primitive, frameState) {
        var rootTiles = primitive._rootTiles;

        for (var i = 0, len = rootTiles.length; i < len; ++i) {
            var rootTile = rootTiles[i];

            queueForHighPriorityLoad(primitive, rootTile);

            if (rootTile.isLoaded()) {
                selectTilesDepthFirst(primitive, frameState, rootTile);
            }
        }
    }

    function selectTilesDepthFirst(primitive, frameState, tile, clippingPlaneMask) {
        // `tile` is guaranteed to be a skeleton - so we can cull it and compute SSE - but
        // is not guaranteed to be fully loaded.  It is also already in a loading queue if it
        // needs any loading.

        var tileProvider = primitive._tileProvider;
        clippingPlaneMask = tileProvider.cullAgainstFrustum(tile, clippingPlaneMask);
        if (clippingPlaneMask === CullingVolume.MASK_OUTSIDE) {
            // This tile is outside the view frustum.
            queueForLowPriorityLoad(primitive, tile);
            return;
        }

        if (tile.isLeaf()) {
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

        var southwestChild = tile.getSouthwestChild(tileProvider);
        var southeastChild = tile.getSoutheastChild(tileProvider);
        var northwestChild = tile.getNorthwestChild(tileProvider);
        var northeastChild = tile.getNortheastChild(tileProvider);

        if (!southwestChild.isSkeleton() || !southeastChild.isSkeleton() || !northwestChild.isSkeleton() || !northeastChild.isSkeleton()) {
            // One or more children are not even skeletons, so we can't compute their distance or SSE.
            // So queue the children to load their skeleton data and render this tile for now.
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
        recurseOnChildren(primitive, frameState, clippingPlaneMask, southwestChild, southeastChild, northwestChild, northeastChild);
    }

    function recurseOnChildren(primitive, frameState, clippingPlaneMask, southwest, southeast, northwest, northeast) {
        // TODO: Call in near-to-far order
        selectTilesDepthFirst(primitive, frameState, southwest, clippingPlaneMask);
        selectTilesDepthFirst(primitive, frameState, southeast, clippingPlaneMask);
        selectTilesDepthFirst(primitive, frameState, northwest, clippingPlaneMask);
        selectTilesDepthFirst(primitive, frameState, northeast, clippingPlaneMask);
    }

    function queueForSkeletonLoad(primitive, tile) {
        if (tile && !tile.isSkeleton()) {
            primitive._skeletonLoadQueue.push(tile);
        }
    }

    function queueForLowPriorityLoad(primitive, tile) {
        if (tile && !tile.isLoaded()) {
            primitive._lowPriorityLoadQueue.push(tile);
        }
    }

    function queueForHighPriorityLoad(primitive, tile) {
        if (tile && !tile.isLoaded()) {
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
        var distance = Math.max(tileProvider.computeDistanceToTile(tile, frameState), CesiumMath.EPSILON7);
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

    return QuadtreePrimitive;
});
