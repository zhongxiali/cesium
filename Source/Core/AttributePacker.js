/*global define*/
define([
        './AttributeCompression',
        './Cartesian2',
        './CompressedAttributeType',
        './DeveloperError'
    ], function(
        AttributeCompression,
        Cartesian2,
        CompressedAttributeType,
        DeveloperError
    ) {
    'use strict';

    /**
     * @private
     */
    function AttributePacker() {
        this._attributes = [];
        this._get = undefined;
        this._put = undefined;
    }

    AttributePacker.prototype.addAttribute = function(name, compressedAttributeType) {
        //>>includeStart('debug', pragmas.debug);
        if (this._get) {
            throw new DeveloperError('Attributes cannot be added after accessing the attribute list or getting/storing a value.');
        }
        //>>includeEnd('debug');

        this._attributes.push({
            name: name,
            compressedAttributeType: compressedAttributeType
        });
    };

    AttributePacker.prototype.getWebGLAttributeList = function() {
        computeStorage(this);
    };

    AttributePacker.prototype.putVertex = function(buffer, index, values) {
        computeStorage(this);

        var put = this._put;
        for (var i = 0; i < put.length; ++i) {
            put(buffer, index, values);
        }
    };

    AttributePacker.prototype.getVertex = function(buffer, index) {
        computeStorage(this);
    };

    function computeStorage(packer) {
        if (!packer._get) {
            return;
        }

        var get = packer._get = [];
        var put = packer._put = [];

        var twelveBits = packer._attributes.filter(function(attribute) {
            return attribute.compressedAttributeType === CompressedAttributeType.TWELVE_BITS;
        });

        var floats = packer._attributes.filter(function(attribute) {
            return attribute.compressedAttributeType === CompressedAttributeType.FLOAT;
        });

        var offset = 0;

        var pairs = (floats.length >> 1) << 1;
        for (var i = 0; i < pairs; i += 2) {
            put.push(putTwelveBitPair.bind(undefined, offset++, twelveBits[i].name, twelveBits[i + 1].name));
        }

        if (pairs !== twelveBits.length) {
            put.push(putFloat.bind(undefined, offset++, twelveBits[pairs].name));
        }

        for (var j = 0; j < floats.length; ++j) {
            put.push(putFloat.bind(undefined, offset++, floats[j].name));
        }
    }

    var cartesian2Scratch = new Cartesian2();

    function putTwelveBitPair(offset, firstName, secondName, buffer, index, values) {
        cartesian2Scratch.x = values[firstName];
        cartesian2Scratch.y = values[secondName];
        buffer[index + offset] = AttributeCompression.compressTextureCoordinates(cartesian2Scratch);
    }

    function putFloat(offset, name, buffer, index, values) {
        buffer[index + offset] = values[name];
    }

    return AttributePacker;
});
