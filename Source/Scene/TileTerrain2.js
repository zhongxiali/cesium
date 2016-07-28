/*global define*/
define([
        './TerrainState'
    ], function(
        TerrainState
    ) {
    'use strict';

    /**
     * Manages details of the terrain load or upsample process.
     *
     * @alias TileTerrain
     * @constructor
     * @private
     */
    function TileTerrain() {
        /**
         * The current state of the terrain in the terrain processing pipeline.
         * @type {TerrainState}
         * @default {@link TerrainState.UNLOADED}
         */
        this.state = TerrainState.UNLOADED;

        /**
         * @type {TerrainData}
         */
        this.data = undefined;

        /**
         * @type {TerrainMesh}
         */
        this.mesh = undefined;

        /**
         * @type {VertexArray}
         */
        this.vertexArray = undefined;

        /**
         * Gets or sets the range of texture coordinates for which to render this tile's vertexArray.  If the tile is loaded with its own
         * data (that is vertexArrayFromTile points to the tile itself), this property is undefined.  If the vertexArray belongs to
         * an ancestor tile, it specifies the range of parent texture coordinates, where x=west, y=south, z=east, w=north, that fall
         * within this tile's extent.
         * @type {Cartesian4}
         */
        this.geographicTextureCoordinateSubset = undefined;
    }

    return TileTerrain;
});