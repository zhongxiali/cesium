/*global define*/
define([
        './AttributeCompression',
        './Cartesian2',
        './ComponentDatatype',
        './CompressedAttributeType',
        './DeveloperError'
    ], function(
        AttributeCompression,
        Cartesian2,
        ComponentDatatype,
        CompressedAttributeType,
        DeveloperError
    ) {
    'use strict';

    /**
     * @private
     */
    function AttributePacker() {
        this._attributes = [];
        this._flatAttributes = [];
        this._numberOfVertexAttributes = -1;
        this._numberOfFloats = -1;
        this._get = undefined;
        this._put = undefined;
    }

    AttributePacker.prototype.addAttribute = function(name, numberOfElements, compressedAttributeType) {
        //>>includeStart('debug', pragmas.debug);
        if (this._get) {
            throw new DeveloperError('Attributes cannot be added after accessing the attribute list or unpacking code, or getting or putting a value.');
        }
        if (numberOfElements < 1 || numberOfElements > 4) {
            throw new DeveloperError('numberOfElements must be between 1 and 4.');
        }
        //>>includeEnd('debug');

        var parent = {
            name: name,
            numberOfElements: numberOfElements,
            compressedAttributeType: compressedAttributeType,

            attributeIndex: -1,
            elementIndex: -1,
            isFirstHalf: undefined,

            parentAttribute: undefined,
            subAttributes: []
        };

        this._attributes.push(parent);

        for (var i = 0; i < numberOfElements; ++i) {
            var child = {
                name: name,
                numberOfElements: 1,
                compressedAttributeType: compressedAttributeType,

                attributeIndex: -1,
                elementIndex: -1,
                isFirstHalf: undefined,

                parentAttribute: parent,
                subAttributes: undefined
            };

            this._flatAttributes.push(child);
            parent.subAttributes.push(child);
        }
    };

    AttributePacker.prototype.getWebGLAttributeList = function(buffer) {
        computeStorage(this);

        var result = [];

        var sizeOfFloat = ComponentDatatype.getSizeInBytes(ComponentDatatype.FLOAT);

        for (var i = 0; i < this._numberOfFloats; i += 4) {
            result.push({
                index: i,
                vertexBuffer: buffer,
                componentDatatype: ComponentDatatype.FLOAT,
                componentsPerAttribute: Math.min(this._numberOfFloats - i, 4),
                offsetInBytes: i * sizeOfFloat,
                strideInBytes: this._numberOfFloats * sizeOfFloat
            });
        }

        return result;
    };

    AttributePacker.prototype.getGlslUnpackingCode = function(compressedAttributeBaseName) {
        computeStorage(this);

        var that = this;

        var lines = [];

        var attributes = this._attributes;
        attributes.forEach(function(attribute) {
            var subAttributes = attribute.subAttributes;

            subAttributes.forEach(function(subAttr) {
                if (subAttr.isFirstHalf) {
                    lines.push('vec2 twelveBit' + subAttr.attributeIndex + elementNames[subAttr.elementIndex] +
                        ' = czm_decompressTextureCoordinates(' + compressedAttributeBaseName +
                        subAttr.attributeIndex + '.' +
                        elementNames[subAttr.elementIndex] + ');');
                }
            });

            var rhsParts = [];

            var lastSourceVariable = getSubAttributeSourceVariableName(compressedAttributeBaseName, subAttributes[0]);
            var lastSourceVariableWidth = getSubAttributeSourceVariableWidth(that, subAttributes[0]);
            var lastAttrElements = getSubAttributeSourceVariableElement(subAttributes[0]);

            for (var i = 1; i < subAttributes.length; ++i) {
                var subAttr = subAttributes[i];
                var sourceVariable = getSubAttributeSourceVariableName(compressedAttributeBaseName, subAttr);
                if (sourceVariable !== lastSourceVariable) {
                    if (lastAttrElements.length === lastSourceVariableWidth) {
                        rhsParts.push(lastSourceVariable);
                    } else {
                        rhsParts.push(lastSourceVariable + '.' + lastAttrElements);
                    }
                    lastSourceVariable = sourceVariable;
                    lastSourceVariableWidth = getSubAttributeSourceVariableWidth(that, subAttr);
                    lastAttrElements = '';
                }

                lastAttrElements += getSubAttributeSourceVariableElement(subAttr);
            }

            if (lastAttrElements.length === lastSourceVariableWidth) {
                rhsParts.push(lastSourceVariable);
            } else {
                rhsParts.push(lastSourceVariable + '.' + lastAttrElements);
            }

            var rhs;
            if (rhsParts.length === 1) {
                rhs = rhsParts[0];
            } else {
                rhs = elementSizeNames[attribute.numberOfElements] + '(' + rhsParts.join(', ') + ')';
            }

            lines.push(elementSizeNames[attribute.numberOfElements] + ' ' + attribute.name + ' = ' + rhs + ';');
        });

        return lines.join('\n');
    };

    AttributePacker.prototype.putVertex = function(buffer, index, values) {
        computeStorage(this);

        var put = this._put;
        for (var i = 0; i < put.length; ++i) {
            put[i](buffer, index, values);
        }
    };

    AttributePacker.prototype.getVertex = function(buffer, index, result) {
        computeStorage(this);

        result = result || {};

        var get = this._get;
        for (var i = 0; i < get.length; ++i) {
            get[i](buffer, index, result);
        }
    };

    function computeStorage(packer) {
        if (packer._get) {
            return;
        }

        var get = packer._get = [];
        var put = packer._put = [];

        var twelveBits = packer._flatAttributes.filter(function(attribute) {
            return attribute.compressedAttributeType === CompressedAttributeType.TWELVE_BITS;
        });

        var putArguments = ['AttributeCompression', 'cartesian2Scratch', 'buffer', 'index', 'vertex'];
        var put = '';
        var offset = 0;

        for (var i = 0; i < twelveBits.length; i += 2) {
            twelveBits[i].attributeIndex = twelveBits[i + 1].attributeIndex = (offset / 4) | 0;
            twelveBits[i].elementIndex = twelveBits[i + 1].elementIndex = offset % 4;
            twelveBits[i].isFirstHalf = true;
            twelveBits[i + 1].isFirstHalf = false;

            put += 'cartesian2Scratch.x = vertex.' + twelveBits[i].name + (twelveBits[i].parentAttribute.subAttributes.length == 1 ? '' : '.' + elementNames[twelveBits[i].elementIndex]) + ';\n';
            put += 'cartesian2Scratch.y = vertex.' + twelveBits[i + 1].name + (twelveBits[i + 1].parentAttribute.subAttributes.length == 1 ? '' : '.' + elementNames[twelveBits[i + 1].elementIndex]) + ';\n';
            put += 'var twelveBits' + offset + ' = AttributeCompression.compressTextureCoordinates(' + ');\n';
            put += 'buffer[index + ' + offset + '] = twelveBits' + offset + ';\n';
        }

        console.log(put);

        var floats = packer._flatAttributes.filter(function(attribute) {
            return attribute.compressedAttributeType === CompressedAttributeType.FLOAT;
        });

        var offset = 0;

        var pairs = (twelveBits.length >> 1) << 1;
        for (var i = 0; i < pairs; i += 2) {
            put.push(putTwelveBitPair.bind(undefined, offset, twelveBits[i].name, twelveBits[i + 1].name));
            get.push(getTwelveBitPair.bind(undefined, offset, twelveBits[i].name, twelveBits[i + 1].name));
            twelveBits[i].attributeIndex = twelveBits[i + 1].attributeIndex = (offset / 4) | 0;
            twelveBits[i].elementIndex = twelveBits[i + 1].elementIndex = offset % 4;
            twelveBits[i].isFirstHalf = true;
            twelveBits[i + 1].isFirstHalf = false;
            ++offset;
        }

        if (pairs !== twelveBits.length) {
            put.push(putFloat.bind(undefined, offset, twelveBits[pairs].name));
            get.push(getFloat.bind(undefined, offset, twelveBits[pairs].name));
            twelveBits[pairs].attributeIndex = (offset / 4) | 0;
            twelveBits[pairs].elementIndex = offset % 4;
            twelveBits[pairs].isFirstHalf = true;
            ++offset;
        }

        for (var j = 0; j < floats.length; ++j) {
            put.push(putFloat.bind(undefined, offset, floats[j].name));
            get.push(getFloat.bind(undefined, offset, floats[j].name));
            floats[j].attributeIndex = (offset / 4) | 0;
            floats[j].elementIndex = offset % 4;
            ++offset;
        }

        packer._numberOfFloats = offset;
        packer._numberOfVertexAttributes = Math.ceil(packer._numberOfFloats / 4.0);
    }

    var cartesian2Scratch = new Cartesian2();

    function putTwelveBitPair(offset, firstName, secondName, buffer, index, values) {
        cartesian2Scratch.x = values[firstName];
        cartesian2Scratch.y = values[secondName];
        buffer[index + offset] = AttributeCompression.compressTextureCoordinates(cartesian2Scratch);
    }

    function getTwelveBitPair(offset, firstName, secondName, buffer, index, result) {
        AttributeCompression.decompressTextureCoordinates(buffer[index + offset], cartesian2Scratch);
        result[firstName] = cartesian2Scratch.x;
        result[secondName] = cartesian2Scratch.y;
    }

    function putFloat(offset, name, buffer, index, values) {
        buffer[index + offset] = values[name];
    }

    function getFloat(offset, name, buffer, index, result) {
        result[name] = buffer[index + offset];
    }

    var elementNames = ['x', 'y', 'z', 'w'];
    var elementSizeNames = ['', 'float', 'vec2', 'vec3', 'vec4'];

    function getSubAttributeSourceVariableName(compressedAttributeBaseName, attribute) {
        if (attribute.compressedAttributeType === CompressedAttributeType.TWELVE_BITS) {
            return 'twelveBit' + attribute.attributeIndex + elementNames[attribute.elementIndex];
        } else {
            return compressedAttributeBaseName + attribute.attributeIndex;
        }
    }

    function getSubAttributeSourceVariableWidth(packer, attribute) {
        if (attribute.compressedAttributeType === CompressedAttributeType.TWELVE_BITS) {
            return 2;
        } else {
            return attribute.attributeIndex === packer._numberOfVertexAttributes - 1 ? (packer._numberOfFloats % 4 || 4) : 4;
        }
    }

    function getSubAttributeSourceVariableElement(attribute) {
        if (attribute.compressedAttributeType === CompressedAttributeType.TWELVE_BITS) {
            return attribute.isFirstHalf ? 'x' : 'y';
        } else {
            return elementNames[attribute.elementIndex];
        }
    }

    return AttributePacker;
});
