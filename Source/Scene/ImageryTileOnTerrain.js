/*global define*/
define([
        '../Core/defined',
        '../Core/defineProperties',
        './ImageryState'
    ], function(
        defined,
        defineProperties,
        ImageryState) {
    'use strict';

    /**
     * Represents a tile of imagery on a terrain tile.
     *
     * @alias TileImagery
     * @private
     *
     * @param {Imagery} imagery The initial imagery tile, whether ready or not.
     * @param {Cartesian4} textureCoordinateRectangle The texture rectangle of the tile that is covered
     *        by the imagery, where X=west, Y=south, Z=east, W=north.
     */
    function ImageryTileOnTerrain(imagery, textureCoordinateRectangle) {
        /**
         * The imagery tile that is currently ready to render in this space, if any.
         * @type {TileOfImageryData}
         */
        this.ready = undefined;

        /**
         * The imagery tile that is currently loading and will be rendered in this space once
         * it is ready, if any.  This may be a more detailed version of the tile if we're currently
         * rendering a low-detail parent tile, or it may be the next tile to display in (for example)
         * a time-dynamic layer.
         * @type {TileOfImageryData}
         */
        this.loading = imagery;

        /**
         * The geographic texture rectangle of the terrain tile that is covered by the imagery, where
         * x=west, y=south, z=east, and w=north.  0 is the southwest corner of the terrain tile, 1 is the
         * northeast.
         * @type {Cartesian4}
         */
        this.readyTextureCoordinateRectangle = textureCoordinateRectangle;

        /**
         * The translation and scale to apply to the geographic texture coordinates of the terrain tile
         * before using them to sample the ready imagery texture.  X and Y are the translation and Z and W
         * are the scale.  The texture coordinates for imagery sampling are computed in the fragment shader
         * as `vec2 imageryTextureCoordinates = terrainTextureCoordinates * scale + translation;`
         * @type {Cartesian4}
         */
        this.readyTextureTranslationAndScale = undefined;
    }

    /**
     * Frees the resources held by this instance.
     */
    ImageryTileOnTerrain.prototype.freeResources = function() {
        if (defined(this.ready)) {
            this.ready.releaseReference();
        }

        if (defined(this.loading)) {
            this.loading.releaseReference();
        }
    };

    /**
     * Processes the load state machine for this instance.
     *
     * @param {GlobeSurfaceTile} tile The tile to which this instance belongs.
     * @param {FrameState} frameState The frameState.
     * @returns {Boolean} True if this instance is done loading; otherwise, false.
     */
    ImageryTileOnTerrain.prototype.processStateMachine = function(frameState, terrainRectangle) {
        var loadingImagery = this.loading;
        var imageryLayer = loadingImagery.imageryLayer;

        loadingImagery.processStateMachine(frameState);

        if (loadingImagery.state === ImageryState.READY) {
            if (defined(this.ready)) {
                this.ready.releaseReference();
            }
            this.ready = this.loading;
            this.loading = undefined;
            this.readyTextureTranslationAndScale = imageryLayer._calculateTextureTranslationAndScale(terrainRectangle, this.ready.rectangle);
            return true; // done loading
        }

        // Find some ancestor imagery we can use while this imagery is still loading.
        var ancestor = loadingImagery.parent;
        var closestAncestorThatNeedsLoading;
        while (defined(ancestor) && ancestor.state !== ImageryState.READY) {
            if (!closestAncestorThatNeedsLoading && ancestor.state !== ImageryState.FAILED && ancestor.state !== ImageryState.INVALID) {
                // ancestor is still loading
                closestAncestorThatNeedsLoading = ancestor;
            }
            ancestor = ancestor.parent;
        }

        if (this.ready !== ancestor) {
            if (defined(this.ready)) {
                this.ready.releaseReference();
            }

            this.ready = ancestor;

            if (defined(ancestor)) {
                ancestor.addReference();
                this.readyTextureTranslationAndScale = imageryLayer._calculateTextureTranslationAndScale(terrainRectangle, this.ready.rectangle);
            }
        }

        if (loadingImagery.state === ImageryState.FAILED || loadingImagery.state === ImageryState.INVALID) {
            // The imagery tile is failed or invalid, so we'd like to use an ancestor instead.
            if (defined(closestAncestorThatNeedsLoading)) {
                // Push the ancestor's load process along a bit.  This is necessary because some ancestor imagery
                // tiles may not be attached directly to a terrain tile.  Such tiles will never load if
                // we don't do it here.
                closestAncestorThatNeedsLoading.processStateMachine(frameState);
                return false; // not done loading
            } else {
                // This imagery tile is failed or invalid, and we have the "best available" substitute.
                return true; // done loading
            }
        }

        return false; // not done loading
    };

    return ImageryTileOnTerrain;
});
