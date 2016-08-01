/*global define*/
define([
        '../Core/Cartesian3',
        '../Core/Cartesian4',
        '../Core/defaultValue',
        '../Core/defined',
        '../Core/defineProperties',
        '../Core/DeveloperError',
        '../Core/Rectangle',
        '../Core/TerrainQuantization',
        '../Core/WebMercatorProjection',
        '../Renderer/ContextLimits',
        '../Renderer/RenderState',
        '../Scene/BlendingState',
        '../Scene/DepthFunction',
        '../Scene/SceneMode',
        './GlobeSurfaceTile2'
    ], function(
        Cartesian3,
        Cartesian4,
        defaultValue,
        defined,
        defineProperties,
        DeveloperError,
        Rectangle,
        TerrainQuantization,
        WebMercatorProjection,
        ContextLimits,
        RenderState,
        BlendingState,
        DepthFunction,
        SceneMode,
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
        },

        imageryLayers: {
            get : function() {
                return this._imageryLayers;
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
            // TODO: fill new tiles with selection data if available.
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

    /**
     * Shows a specified tile in this frame.  The provider can cause the tile to be shown by adding
     * render commands to the commandList, or use any other method as appropriate.  The tile is not
     * expected to be visible next frame as well, unless this method is called next frame, too.
     *
     * @param {Object} tile The tile instance.
     * @param {FrameState} frameState The state information of the current rendering frame.
     */
    GlobeSurfaceTileProvider.prototype.showTileThisFrame = function(tile, frameState) {
        var readyTextureCount = 0;
        var tileImageryCollection = tile.imagery;
        for (var i = 0, len = tileImageryCollection.length; i < len; ++i) {
            var tileImagery = tileImageryCollection[i];
            if (defined(tileImagery.ready) && tileImagery.ready.imageryLayer.alpha !== 0.0) {
                ++readyTextureCount;
            }
        }

        var tileSet = this._tilesToRenderByTextureCount[readyTextureCount];
        if (!defined(tileSet)) {
            tileSet = [];
            this._tilesToRenderByTextureCount[readyTextureCount] = tileSet;
        }

        tileSet.push(tile);

        // var debug = this._debug;
        // ++debug.tilesRendered;
        // debug.texturesRendered += readyTextureCount;
    };

    var tileRectangleScratch = new Cartesian4();
    var rtcScratch = new Cartesian3();
    var southwestScratch = new Cartesian3();
    var northeastScratch = new Cartesian3();
    var otherPassesInitialColor = new Cartesian4(0.0, 0.0, 0.0, 0.0);

    function addDrawCommandsForTile(tileProvider, tile, frameState) {
        var surfaceTile = tile;

        var maxTextures = ContextLimits.maximumTextureImageUnits;

        var waterMaskTexture = surfaceTile.waterMaskTexture;
        var showReflectiveOcean = tileProvider.hasWaterMask && defined(waterMaskTexture);
        var oceanNormalMap = tileProvider.oceanNormalMap;
        var showOceanWaves = showReflectiveOcean && defined(oceanNormalMap);
        var hasVertexNormals = tileProvider.terrainProvider.ready && tileProvider.terrainProvider.hasVertexNormals;
        var enableFog = frameState.fog.enabled;
        var castShadows = tileProvider.castShadows;
        var receiveShadows = tileProvider.receiveShadows;

        if (showReflectiveOcean) {
            --maxTextures;
        }
        if (showOceanWaves) {
            --maxTextures;
        }

        var rtc = surfaceTile.center;
        var encoding = surfaceTile.pickTerrain.mesh.encoding;

        // Not used in 3D.
        var tileRectangle = tileRectangleScratch;

        // Only used for Mercator projections.
        var southLatitude = 0.0;
        var northLatitude = 0.0;
        var southMercatorY = 0.0;
        var oneOverMercatorHeight = 0.0;

        var useWebMercatorProjection = false;

        if (frameState.mode !== SceneMode.SCENE3D) {
            var projection = frameState.mapProjection;
            var southwest = projection.project(Rectangle.southwest(tile.rectangle), southwestScratch);
            var northeast = projection.project(Rectangle.northeast(tile.rectangle), northeastScratch);

            tileRectangle.x = southwest.x;
            tileRectangle.y = southwest.y;
            tileRectangle.z = northeast.x;
            tileRectangle.w = northeast.y;

            // In 2D and Columbus View, use the center of the tile for RTC rendering.
            if (frameState.mode !== SceneMode.MORPHING) {
                rtc = rtcScratch;
                rtc.x = 0.0;
                rtc.y = (tileRectangle.z + tileRectangle.x) * 0.5;
                rtc.z = (tileRectangle.w + tileRectangle.y) * 0.5;
                tileRectangle.x -= rtc.y;
                tileRectangle.y -= rtc.z;
                tileRectangle.z -= rtc.y;
                tileRectangle.w -= rtc.z;
            }

            if (frameState.mode === SceneMode.SCENE2D && encoding.quantization === TerrainQuantization.BITS12) {
                // In 2D, the texture coordinates of the tile are interpolated over the rectangle to get the position in the vertex shader.
                // When the texture coordinates are quantized, error is introduced. This can be seen through the 1px wide cracking
                // between the quantized tiles in 2D. To compensate for the error, move the expand the rectangle in each direction by
                // half the error amount.
                var epsilon = (1.0 / (Math.pow(2.0, 12.0) - 1.0)) * 0.5;
                var widthEpsilon = (tileRectangle.z - tileRectangle.x) * epsilon;
                var heightEpsilon = (tileRectangle.w - tileRectangle.y) * epsilon;
                tileRectangle.x -= widthEpsilon;
                tileRectangle.y -= heightEpsilon;
                tileRectangle.z += widthEpsilon;
                tileRectangle.w += heightEpsilon;
            }

            if (projection instanceof WebMercatorProjection) {
                southLatitude = tile.rectangle.south;
                northLatitude = tile.rectangle.north;

                southMercatorY = WebMercatorProjection.geodeticLatitudeToMercatorAngle(southLatitude);

                oneOverMercatorHeight = 1.0 / (WebMercatorProjection.geodeticLatitudeToMercatorAngle(northLatitude) - southMercatorY);

                useWebMercatorProjection = true;
            }
        }

        var tileImageryCollection = surfaceTile.imagery;
        var imageryIndex = 0;
        var imageryLen = tileImageryCollection.length;

        var firstPassRenderState = tileProvider._renderState;
        var otherPassesRenderState = tileProvider._blendRenderState;
        var renderState = firstPassRenderState;

        var initialColor = tileProvider._firstPassInitialColor;

        var context = frameState.context;

        // if (!defined(tileProvider._debug.boundingSphereTile)) {
        //     debugDestroyPrimitive();
        // }

        do {
            var numberOfDayTextures = 0;

            var command;
            var uniformMap;

            if (tileProvider._drawCommands.length <= tileProvider._usedDrawCommands) {
                command = new DrawCommand();
                command.owner = tile;
                command.cull = false;
                command.boundingVolume = new BoundingSphere();
                command.orientedBoundingBox = undefined;

                uniformMap = createTileUniformMap(frameState);

                tileProvider._drawCommands.push(command);
                tileProvider._uniformMaps.push(uniformMap);
            } else {
                command = tileProvider._drawCommands[tileProvider._usedDrawCommands];
                uniformMap = tileProvider._uniformMaps[tileProvider._usedDrawCommands];
            }

            command.owner = tile;

            ++tileProvider._usedDrawCommands;

            if (tile === tileProvider._debug.boundingSphereTile) {
                // If a debug primitive already exists for this tile, it will not be
                // re-created, to avoid allocation every frame. If it were possible
                // to have more than one selected tile, this would have to change.
                if (defined(surfaceTile.orientedBoundingBox)) {
                    getDebugOrientedBoundingBox(surfaceTile.orientedBoundingBox, Color.RED).update(frameState);
                } else if (defined(surfaceTile.boundingSphere3D)) {
                    getDebugBoundingSphere(surfaceTile.boundingSphere3D, Color.RED).update(frameState);
                }
            }

            var uniformMapProperties = uniformMap.properties;
            Cartesian4.clone(initialColor, uniformMapProperties.initialColor);
            uniformMapProperties.oceanNormalMap = oceanNormalMap;
            uniformMapProperties.lightingFadeDistance.x = tileProvider.lightingFadeOutDistance;
            uniformMapProperties.lightingFadeDistance.y = tileProvider.lightingFadeInDistance;
            uniformMapProperties.zoomedOutOceanSpecularIntensity = tileProvider.zoomedOutOceanSpecularIntensity;

            uniformMapProperties.center3D = surfaceTile.center;
            Cartesian3.clone(rtc, uniformMapProperties.rtc);

            Cartesian4.clone(tileRectangle, uniformMapProperties.tileRectangle);
            uniformMapProperties.southAndNorthLatitude.x = southLatitude;
            uniformMapProperties.southAndNorthLatitude.y = northLatitude;
            uniformMapProperties.southMercatorYAndOneOverHeight.x = southMercatorY;
            uniformMapProperties.southMercatorYAndOneOverHeight.y = oneOverMercatorHeight;

            // For performance, use fog in the shader only when the tile is in fog.
            var applyFog = enableFog && CesiumMath.fog(tile._distance, frameState.fog.density) > CesiumMath.EPSILON3;

            var applyBrightness = false;
            var applyContrast = false;
            var applyHue = false;
            var applySaturation = false;
            var applyGamma = false;
            var applyAlpha = false;

            while (numberOfDayTextures < maxTextures && imageryIndex < imageryLen) {
                var tileImagery = tileImageryCollection[imageryIndex];
                var imagery = tileImagery.ready;
                ++imageryIndex;

                if (!defined(imagery) || imagery.state !== ImageryState.READY || imagery.imageryLayer.alpha === 0.0) {
                    continue;
                }

                var imageryLayer = imagery.imageryLayer;

                if (!defined(tileImagery.textureTranslationAndScale)) {
                    tileImagery.textureTranslationAndScale = imageryLayer._calculateTextureTranslationAndScale(tile, tileImagery);
                }

                uniformMapProperties.dayTextures[numberOfDayTextures] = imagery.texture;
                uniformMapProperties.dayTextureTranslationAndScale[numberOfDayTextures] = tileImagery.textureTranslationAndScale;
                uniformMapProperties.dayTextureTexCoordsRectangle[numberOfDayTextures] = tileImagery.textureCoordinateRectangle;

                uniformMapProperties.dayTextureAlpha[numberOfDayTextures] = imageryLayer.alpha;
                applyAlpha = applyAlpha || uniformMapProperties.dayTextureAlpha[numberOfDayTextures] !== 1.0;

                uniformMapProperties.dayTextureBrightness[numberOfDayTextures] = imageryLayer.brightness;
                applyBrightness = applyBrightness || uniformMapProperties.dayTextureBrightness[numberOfDayTextures] !== ImageryLayer.DEFAULT_BRIGHTNESS;

                uniformMapProperties.dayTextureContrast[numberOfDayTextures] = imageryLayer.contrast;
                applyContrast = applyContrast || uniformMapProperties.dayTextureContrast[numberOfDayTextures] !== ImageryLayer.DEFAULT_CONTRAST;

                uniformMapProperties.dayTextureHue[numberOfDayTextures] = imageryLayer.hue;
                applyHue = applyHue || uniformMapProperties.dayTextureHue[numberOfDayTextures] !== ImageryLayer.DEFAULT_HUE;

                uniformMapProperties.dayTextureSaturation[numberOfDayTextures] = imageryLayer.saturation;
                applySaturation = applySaturation || uniformMapProperties.dayTextureSaturation[numberOfDayTextures] !== ImageryLayer.DEFAULT_SATURATION;

                uniformMapProperties.dayTextureOneOverGamma[numberOfDayTextures] = 1.0 / imageryLayer.gamma;
                applyGamma = applyGamma || uniformMapProperties.dayTextureOneOverGamma[numberOfDayTextures] !== 1.0 / ImageryLayer.DEFAULT_GAMMA;

                if (defined(imagery.credits)) {
                    var creditDisplay = frameState.creditDisplay;
                    var credits = imagery.credits;
                    for (var creditIndex = 0, creditLength = credits.length; creditIndex < creditLength; ++creditIndex) {
                        creditDisplay.addCredit(credits[creditIndex]);
                    }
                }

                ++numberOfDayTextures;
            }

            // trim texture array to the used length so we don't end up using old textures
            // which might get destroyed eventually
            uniformMapProperties.dayTextures.length = numberOfDayTextures;
            uniformMapProperties.waterMask = waterMaskTexture;
            Cartesian4.clone(surfaceTile.waterMaskTranslationAndScale, uniformMapProperties.waterMaskTranslationAndScale);

            uniformMapProperties.minMaxHeight.x = encoding.minimumHeight;
            uniformMapProperties.minMaxHeight.y = encoding.maximumHeight;
            Matrix4.clone(encoding.matrix, uniformMapProperties.scaleAndBias);

            command.shaderProgram = tileProvider._surfaceShaderSet.getShaderProgram(frameState, surfaceTile, numberOfDayTextures, applyBrightness, applyContrast, applyHue, applySaturation, applyGamma, applyAlpha, showReflectiveOcean, showOceanWaves, tileProvider.enableLighting, hasVertexNormals, useWebMercatorProjection, applyFog);
            command.castShadows = castShadows;
            command.receiveShadows = receiveShadows;
            command.renderState = renderState;
            command.primitiveType = PrimitiveType.TRIANGLES;
            command.vertexArray = surfaceTile.vertexArray;
            command.uniformMap = uniformMap;
            command.pass = Pass.GLOBE;

            if (tileProvider._debug.wireframe) {
                createWireframeVertexArrayIfNecessary(context, tileProvider, tile);
                if (defined(surfaceTile.wireframeVertexArray)) {
                    command.vertexArray = surfaceTile.wireframeVertexArray;
                    command.primitiveType = PrimitiveType.LINES;
                }
            }

            var boundingVolume = command.boundingVolume;
            var orientedBoundingBox = command.orientedBoundingBox;

            if (frameState.mode !== SceneMode.SCENE3D) {
                BoundingSphere.fromRectangleWithHeights2D(tile.rectangle, frameState.mapProjection, surfaceTile.minimumHeight, surfaceTile.maximumHeight, boundingVolume);
                Cartesian3.fromElements(boundingVolume.center.z, boundingVolume.center.x, boundingVolume.center.y, boundingVolume.center);

                if (frameState.mode === SceneMode.MORPHING) {
                    boundingVolume = BoundingSphere.union(surfaceTile.boundingSphere3D, boundingVolume, boundingVolume);
                }
            } else {
                command.boundingVolume = BoundingSphere.clone(surfaceTile.boundingSphere3D, boundingVolume);
                command.orientedBoundingBox = OrientedBoundingBox.clone(surfaceTile.orientedBoundingBox, orientedBoundingBox);
            }

            frameState.commandList.push(command);

            renderState = otherPassesRenderState;
            initialColor = otherPassesInitialColor;
        } while (imageryIndex < imageryLen);
    }

    return GlobeSurfaceTileProvider;
});