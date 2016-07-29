/*global define*/
define([
        '../Core/defined',
        '../Core/IndexDatatype',
        '../Core/Request',
        '../Core/TileProviderError',
        '../Renderer/Buffer',
        '../Renderer/BufferUsage',
        '../Renderer/VertexArray',
        '../ThirdParty/when',
        './TerrainState'
    ], function(
        defined,
        IndexDatatype,
        Request,
        TileProviderError,
        Buffer,
        BufferUsage,
        VertexArray,
        when,
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

    TileTerrain.prototype.freeResources = function() {
        this.state = TerrainState.UNLOADED;
        this.data = undefined;
        this.mesh = undefined;

        if (defined(this.vertexArray)) {
            var indexBuffer = this.vertexArray.indexBuffer;

            this.vertexArray.destroy();
            this.vertexArray = undefined;

            if (!indexBuffer.isDestroyed() && defined(indexBuffer.referenceCount)) {
                --indexBuffer.referenceCount;
                if (indexBuffer.referenceCount === 0) {
                    indexBuffer.destroy();
                }
            }
        }
    };

    TileTerrain.prototype.load = function(tile, tileProvider, frameState) {
        if (this.state === TerrainState.UNLOADED) {
            requestTileGeometry(this, tileProvider.terrainProvider, tile.x, tile.y, tile.level);
        }

        if (this.state === TerrainState.RECEIVED) {
            transform(this, frameState, tileProvider.terrainProvider, tile.x, tile.y, tile.level);
        }

        if (this.state === TerrainState.TRANSFORMED) {
            createResources(this, frameState.context, tileProvider.terrainProvider, tile.x, tile.y, tile.level);
        }
    };

    function requestTileGeometry(tileTerrain, terrainProvider, x, y, level, distance) {
        function success(terrainData) {
            tileTerrain.data = terrainData;
            tileTerrain.state = TerrainState.RECEIVED;
        }

        function failure() {
            // Initially assume failure.  handleError may retry, in which case the state will
            // change to RECEIVING or UNLOADED.
            tileTerrain.state = TerrainState.FAILED;

            var message = 'Failed to obtain terrain tile X: ' + x + ' Y: ' + y + ' Level: ' + level + '.';
            terrainProvider._requestError = TileProviderError.handleError(
                terrainProvider._requestError,
                terrainProvider,
                terrainProvider.errorEvent,
                message,
                x, y, level,
                doRequest);
        }

        function doRequest() {
            // Request the terrain from the terrain provider.
            var request = new Request({
            });
            tileTerrain.data = terrainProvider.requestTileGeometry(x, y, level, request);

            // If the request method returns undefined (instead of a promise), the request
            // has been deferred.
            if (defined(tileTerrain.data)) {
                tileTerrain.state = TerrainState.RECEIVING;

                when(tileTerrain.data, success, failure);
            } else {
                // Deferred - try again later.
                tileTerrain.state = TerrainState.UNLOADED;
            }
        }

        doRequest();
    }

    function transform(tileTerrain, frameState, terrainProvider, x, y, level) {
        var tilingScheme = terrainProvider.tilingScheme;

        var terrainData = tileTerrain.data;
        var meshPromise = terrainData.createMesh(tilingScheme, x, y, level, frameState.terrainExaggeration);

        if (!defined(meshPromise)) {
            // Postponed.
            return;
        }

        tileTerrain.state = TerrainState.TRANSFORMING;

        when(meshPromise, function(mesh) {
            tileTerrain.mesh = mesh;
            tileTerrain.state = TerrainState.TRANSFORMED;
        }, function() {
            tileTerrain.state = TerrainState.FAILED;
        });
    }

    function createResources(tileTerrain, context, terrainProvider, x, y, level) {
        var typedArray = tileTerrain.mesh.vertices;
        var buffer = Buffer.createVertexBuffer({
            context : context,
            typedArray : typedArray,
            usage : BufferUsage.STATIC_DRAW
        });
        var attributes = tileTerrain.mesh.encoding.getAttributes(buffer);

        var indexBuffers = tileTerrain.mesh.indices.indexBuffers || {};
        var indexBuffer = indexBuffers[context.id];
        if (!defined(indexBuffer) || indexBuffer.isDestroyed()) {
            var indices = tileTerrain.mesh.indices;
            var indexDatatype = (indices.BYTES_PER_ELEMENT === 2) ?  IndexDatatype.UNSIGNED_SHORT : IndexDatatype.UNSIGNED_INT;
            indexBuffer = Buffer.createIndexBuffer({
                context : context,
                typedArray : indices,
                usage : BufferUsage.STATIC_DRAW,
                indexDatatype : indexDatatype
            });
            indexBuffer.vertexArrayDestroyable = false;
            indexBuffer.referenceCount = 1;
            indexBuffers[context.id] = indexBuffer;
            tileTerrain.mesh.indices.indexBuffers = indexBuffers;
        } else {
            ++indexBuffer.referenceCount;
        }

        tileTerrain.vertexArray = new VertexArray({
            context : context,
            attributes : attributes,
            indexBuffer : indexBuffer
        });

        tileTerrain.state = TerrainState.READY;
    }

    return TileTerrain;
});