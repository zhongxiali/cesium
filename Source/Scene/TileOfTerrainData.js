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
     * A single tile of terrain data.
     *
     * @alias TileOfTerrainData
     * @constructor
     * @private
     */
    function TileOfTerrainData(x, y, level) {
        this.x = x;
        this.y = y;
        this.level = level;

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

        this.referenceCount = 0;
    }

    TileOfTerrainData.prototype.addReference = function() {
        ++this.referenceCount;
    };

    TileOfTerrainData.prototype.releaseReference = function() {
        --this.referenceCount;

        if (this.referenceCount === 0) {
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

            return 0;
        }

        return this.referenceCount;
    };

    TileOfTerrainData.prototype.load = function(terrainProvider, frameState) {
        if (this.state === TerrainState.UNLOADED) {
            requestTileGeometry(this, terrainProvider);
        }

        if (this.state === TerrainState.RECEIVED) {
            transform(this, frameState, terrainProvider);
        }

        if (this.state === TerrainState.TRANSFORMED) {
            createResources(this, frameState.context, terrainProvider);
        }
    };

    function requestTileGeometry(tile, terrainProvider) {
        function success(terrainData) {
            tile.data = terrainData;
            tile.state = TerrainState.RECEIVED;
        }

        function failure() {
            // Initially assume failure.  handleError may retry, in which case the state will
            // change to RECEIVING or UNLOADED.
            tile.state = TerrainState.FAILED;

            var message = 'Failed to obtain terrain tile X: ' + tile.x + ' Y: ' + tile.y + ' Level: ' + tile.level + '.';
            terrainProvider._requestError = TileProviderError.handleError(
                terrainProvider._requestError,
                terrainProvider,
                terrainProvider.errorEvent,
                message,
                tile.x, tile.y, tile.level,
                doRequest);
        }

        function doRequest() {
            // Request the terrain from the terrain provider.
            var request = new Request({
            });
            tile.data = terrainProvider.requestTileGeometry(tile.x, tile.y, tile.level, request);

            // If the request method returns undefined (instead of a promise), the request
            // has been deferred.
            if (defined(tile.data)) {
                tile.state = TerrainState.RECEIVING;

                when(tile.data, success, failure);
            } else {
                // Deferred - try again later.
                tile.state = TerrainState.UNLOADED;
            }
        }

        doRequest();
    }

    function transform(tile, frameState, terrainProvider) {
        var tilingScheme = terrainProvider.tilingScheme;

        var terrainData = tile.data;
        var meshPromise = terrainData.createMesh(tilingScheme, tile.x, tile.y, tile.level, frameState.terrainExaggeration);

        if (!defined(meshPromise)) {
            // Postponed.
            return;
        }

        tile.state = TerrainState.TRANSFORMING;

        when(meshPromise, function(mesh) {
            tile.mesh = mesh;
            tile.state = TerrainState.TRANSFORMED;
        }, function() {
            tile.state = TerrainState.FAILED;
        });
    }

    function createResources(tile, context, terrainProvider) {
        var typedArray = tile.mesh.vertices;
        var buffer = Buffer.createVertexBuffer({
            context : context,
            typedArray : typedArray,
            usage : BufferUsage.STATIC_DRAW
        });
        var attributes = tile.mesh.encoding.getAttributes(buffer);

        var indexBuffers = tile.mesh.indices.indexBuffers || {};
        var indexBuffer = indexBuffers[context.id];
        if (!defined(indexBuffer) || indexBuffer.isDestroyed()) {
            var indices = tile.mesh.indices;
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
            tile.mesh.indices.indexBuffers = indexBuffers;
        } else {
            ++indexBuffer.referenceCount;
        }

        tile.vertexArray = new VertexArray({
            context : context,
            attributes : attributes,
            indexBuffer : indexBuffer
        });

        tile.state = TerrainState.READY;
    }

    return TileOfTerrainData;
});