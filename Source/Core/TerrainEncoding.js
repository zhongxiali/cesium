/*global define*/
define([
        './AttributeCompression',
        './AttributePacker',
        './Cartesian2',
        './Cartesian3',
        './ComponentDatatype',
        './CompressedAttributeType',
        './defaultValue',
        './defined',
        './Math',
        './Matrix3',
        './Matrix4',
        './TerrainQuantization'
    ], function(
        AttributeCompression,
        AttributePacker,
        Cartesian2,
        Cartesian3,
        ComponentDatatype,
        CompressedAttributeType,
        defaultValue,
        defined,
        CesiumMath,
        Matrix3,
        Matrix4,
        TerrainQuantization) {
    'use strict';

    var cartesian3Scratch = new Cartesian3();
    var cartesian3DimScratch = new Cartesian3();
    var matrix4Scratch = new Matrix4();
    var matrix4Scratch2 = new Matrix4();

    var SHIFT_LEFT_12 = Math.pow(2.0, 12.0);

    /**
     * Data used to quantize and pack the terrain mesh. The position can be unpacked for picking and all attributes
     * are unpacked in the vertex shader.
     *
     * @alias TerrainEncoding
     * @constructor
     *
     * @param {AxisAlignedBoundingBox} axisAlignedBoundingBox The bounds of the tile in the east-north-up coordinates at the tiles center.
     * @param {Number} minimumHeight The minimum height.
     * @param {Number} maximumHeight The maximum height.
     * @param {Matrix4} fromENU The east-north-up to fixed frame matrix at the center of the terrain mesh.
     * @param {Boolean} hasVertexNormals If the mesh has vertex normals.
     * @param {Boolean} [hasVertexHeight=true] true if the terrain data includes a height with each vertex; otherwise, false.
     *                                         The height is usually only needed in Columbus View.
     * @param {Boolean} [hasWebMercatorY=false] true if the terrain data includes a vertical Web Mercator texture coordinate; otherwise, false.
     *
     * @private
     */
    function TerrainEncoding(axisAlignedBoundingBox, minimumHeight, maximumHeight, fromENU, hasVertexNormals, hasVertexHeight, hasWebMercatorY) {
        var quantization;
        var center;
        var toENU;
        var matrix;

        if (defined(axisAlignedBoundingBox) && defined(minimumHeight) && defined(maximumHeight) && defined(fromENU)) {
            var minimum = axisAlignedBoundingBox.minimum;
            var maximum = axisAlignedBoundingBox.maximum;

            var dimensions = Cartesian3.subtract(maximum, minimum, cartesian3DimScratch);
            var hDim = maximumHeight - minimumHeight;
            var maxDim = Math.max(Cartesian3.maximumComponent(dimensions), hDim);

            if (maxDim < SHIFT_LEFT_12 - 1.0) {
                quantization = TerrainQuantization.BITS12;
            } else {
                quantization = TerrainQuantization.NONE;
            }

            center = axisAlignedBoundingBox.center;
            toENU = Matrix4.inverseTransformation(fromENU, new Matrix4());

            var translation = Cartesian3.negate(minimum, cartesian3Scratch);
            Matrix4.multiply(Matrix4.fromTranslation(translation, matrix4Scratch), toENU, toENU);

            var scale = cartesian3Scratch;
            scale.x = 1.0 / dimensions.x;
            scale.y = 1.0 / dimensions.y;
            scale.z = 1.0 / dimensions.z;
            Matrix4.multiply(Matrix4.fromScale(scale, matrix4Scratch), toENU, toENU);

            matrix = Matrix4.clone(fromENU);
            Matrix4.setTranslation(matrix, Cartesian3.ZERO, matrix);

            fromENU = Matrix4.clone(fromENU, new Matrix4());

            var translationMatrix = Matrix4.fromTranslation(minimum, matrix4Scratch);
            var scaleMatrix =  Matrix4.fromScale(dimensions, matrix4Scratch2);
            var st = Matrix4.multiply(translationMatrix, scaleMatrix,matrix4Scratch);

            Matrix4.multiply(fromENU, st, fromENU);
            Matrix4.multiply(matrix, st, matrix);
        }

        /**
         * How the vertices of the mesh were compressed.
         * @type {TerrainQuantization}
         */
        this.quantization = quantization;

        /**
         * The minimum height of the tile including the skirts.
         * @type {Number}
         */
        this.minimumHeight = minimumHeight;

        /**
         * The maximum height of the tile.
         * @type {Number}
         */
        this.maximumHeight = maximumHeight;

        /**
         * The center of the tile.
         * @type {Cartesian3}
         */
        this.center = center;

        /**
         * A matrix that takes a vertex from the tile, transforms it to east-north-up at the center and scales
         * it so each component is in the [0, 1] range.
         * @type {Matrix4}
         */
        this.toScaledENU = toENU;

        /**
         * A matrix that restores a vertex transformed with toScaledENU back to the earth fixed reference frame
         * @type {Matrix4}
         */
        this.fromScaledENU = fromENU;

        /**
         * The matrix used to decompress the terrain vertices in the shader for RTE rendering.
         * @type {Matrix4}
         */
        this.matrix = matrix;

        /**
         * The terrain mesh contains normals.
         * @type {Boolean}
         */
        this.hasVertexNormals = hasVertexNormals;

        /**
         * The terrain mesh contains heights.  This is generally only needed in Columbus View.
         * @type {Boolean}
         */
        this.hasVertexHeight = defaultValue(hasVertexHeight, true);

        /**
         * The terrain mesh contains a vertical texture coordinate following the Web Mercator projection.
         * @type {Boolean}
         */
        this.hasWebMercatorY = defaultValue(hasWebMercatorY, false);

        this.packer = undefined;
        this.positionGetter = undefined;
        this.heightGetter = undefined;
        this.webMercatorYGetter = undefined;
        this.textureCoordinatesGetter = undefined;
        this.encodedNormalGetter = undefined;
   }

   var cachedPackers = {};

   function createPacker(terrainEncoding) {
        if (defined(terrainEncoding.packer)) {
            return;
        }

        var cacheKey = JSON.stringify({
            quantization: terrainEncoding.quantization,
            hasVertexHeight: terrainEncoding.hasVertexHeight,
            hasWebMercatorY: terrainEncoding.hasWebMercatorY,
            hasVertexNormals: terrainEncoding.hasVertexNormals
        });

        var cachedPacker = cachedPackers[cacheKey];
        if (!defined(cachedPacker)) {
            var attrType = terrainEncoding.quantization === TerrainQuantization.BITS12 ? CompressedAttributeType.TWELVE_BITS : CompressedAttributeType.FLOAT;

            var packer = new AttributePacker();
            packer.addAttribute('position', 3, attrType);

            if (terrainEncoding.hasVertexHeight) {
                packer.addAttribute('height', 1, attrType);
            }

            if (terrainEncoding.hasWebMercatorY) {
                packer.addAttribute('webMercatorY', 1, attrType);
            }

            packer.addAttribute('textureCoordinates', 2, attrType);

            if (terrainEncoding.hasVertexNormals) {
                packer.addAttribute('encodedNormal', 1, CompressedAttributeType.FLOAT);
            }

            cachedPacker = cachedPackers[cacheKey] = {
                packer: packer,
                positionGetter: packer.createSingleAttributeGetFunction('position'),
                heightGetter: packer.createSingleAttributeGetFunction('height', 0.0),
                webMercatorYGetter: packer.createSingleAttributeGetFunction('webMercatorY'),
                textureCoordinatesGetter: packer.createSingleAttributeGetFunction('textureCoordinates'),
                encodedNormalGetter: packer.createSingleAttributeGetFunction('encodedNormal')
            };
        }

        // Create the functions to get individual vertex attributes from the buffer.
        terrainEncoding.packer = cachedPacker.packer;
        terrainEncoding.positionGetter = cachedPacker.positionGetter;
        terrainEncoding.heightGetter = cachedPacker.heightGetter;
        terrainEncoding.webMercatorYGetter = cachedPacker.webMercatorYGetter;
        terrainEncoding.textureCoordinatesGetter = cachedPacker.textureCoordinatesGetter;
        terrainEncoding.encodedNormalGetter = cachedPacker.encodedNormalGetter;
    }

    var vertexScratch = {
        position: new Cartesian3(),
        textureCoordinates: new Cartesian2(),
        height: 0.0,
        webMercatorY: 0.0,
        encodedNormal: 0.0
    };

    TerrainEncoding.prototype.encode = function(vertexBuffer, vertexIndex, position, uv, height, normalToPack, webMercatorY) {
        createPacker(this);

        if (this.quantization === TerrainQuantization.BITS12) {
            var positionScaledEnu = Matrix4.multiplyByPoint(this.toScaledENU, position, vertexScratch.position);
            positionScaledEnu.x = CesiumMath.clamp(positionScaledEnu.x, 0.0, 1.0);
            positionScaledEnu.y = CesiumMath.clamp(positionScaledEnu.y, 0.0, 1.0);
            positionScaledEnu.z = CesiumMath.clamp(positionScaledEnu.z, 0.0, 1.0);

            var hDim = this.maximumHeight - this.minimumHeight;
            vertexScratch.height = CesiumMath.clamp((height - this.minimumHeight) / hDim, 0.0, 1.0);
        } else {
            Cartesian3.subtract(position, this.center, vertexScratch.position);
            vertexScratch.height = height;
        }

        Cartesian2.clone(uv, vertexScratch.textureCoordinates);
        vertexScratch.webMercatorY = webMercatorY;

        if (this.hasVertexNormals) {
            vertexScratch.encodedNormal = AttributeCompression.octPackFloat(normalToPack);
        }

        this.packer.putVertex(vertexBuffer, vertexIndex, vertexScratch);
    };

    TerrainEncoding.prototype.decodePosition = function(buffer, vertexIndex, result) {
        createPacker(this);

        if (!defined(result)) {
            result = new Cartesian3();
        }

        this.positionGetter(buffer, vertexIndex, result);

        if (this.quantization === TerrainQuantization.BITS12) {
            return Matrix4.multiplyByPoint(this.fromScaledENU, result, result);
        } else {
            return Cartesian3.add(result, this.center, result);
        }
    };

    TerrainEncoding.prototype.decodeTextureCoordinates = function(buffer, vertexIndex, result) {
        createPacker(this);

        if (!defined(result)) {
            result = new Cartesian2();
        }

        return this.textureCoordinatesGetter(buffer, vertexIndex, result);
    };

    TerrainEncoding.prototype.decodeWebMercatorY = function(buffer, vertexIndex) {
        createPacker(this);

        return this.webMercatorYGetter(buffer, vertexIndex);
    };

    TerrainEncoding.prototype.decodeHeight = function(buffer, vertexIndex) {
        createPacker(this);

        var height = this.heightGetter(buffer, vertexIndex);

        if (this.hasVertexHeight && this.quantization === TerrainQuantization.BITS12) {
            height = height * (this.maximumHeight - this.minimumHeight) + this.minimumHeight;
        }

        return height;
    };

    TerrainEncoding.prototype.getOctEncodedNormal = function(buffer, vertexIndex, result) {
        createPacker(this);

        var temp = this.encodedNormalGetter(buffer, vertexIndex) / 256.0;
        var x = Math.floor(temp);
        var y = (temp - x) * 256.0;
        return Cartesian2.fromElements(x, y, result);
    };

    TerrainEncoding.prototype.getStride = function() {
        createPacker(this);
        return this.packer.numberOfFloats;
    };

    TerrainEncoding.prototype.getAttributes = function(buffer) {
        createPacker(this);
        return this.packer.getWebGLAttributeList(buffer);
    };

    var glslAttributeName = 'packedAttributes';

    TerrainEncoding.prototype.getAttributeLocations = function() {
        createPacker(this);
        return this.packer.getWebGLAttributeLocations(glslAttributeName);
    };

    TerrainEncoding.prototype.getGlslAttributeDeclarations = function() {
        createPacker(this);
        return this.packer.getGlslAttributeDeclarations(glslAttributeName);
    };

    TerrainEncoding.prototype.getGlslUnpackingCode = function() {
        createPacker(this);
        return this.packer.getGlslUnpackingCode(glslAttributeName);
    };

    TerrainEncoding.clone = function(encoding, result) {
        if (!defined(result)) {
            result = new TerrainEncoding();
        }

        result.quantization = encoding.quantization;
        result.minimumHeight = encoding.minimumHeight;
        result.maximumHeight = encoding.maximumHeight;
        result.center = Cartesian3.clone(encoding.center);
        result.toScaledENU = Matrix4.clone(encoding.toScaledENU);
        result.fromScaledENU = Matrix4.clone(encoding.fromScaledENU);
        result.matrix = Matrix4.clone(encoding.matrix);
        result.hasVertexNormals = encoding.hasVertexNormals;
        result.hasVertexHeight = encoding.hasVertexHeight;
        result.hasWebMercatorY = encoding.hasWebMercatorY;
        return result;
    };

    return TerrainEncoding;
});
