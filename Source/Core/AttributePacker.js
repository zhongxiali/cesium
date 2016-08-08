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

                subAttrNumber: i,
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
                index: i / 4 | 0,
                vertexBuffer: buffer,
                componentDatatype: ComponentDatatype.FLOAT,
                componentsPerAttribute: Math.min(this._numberOfFloats - i, 4),
                offsetInBytes: i * sizeOfFloat,
                strideInBytes: this._numberOfFloats * sizeOfFloat
            });
        }

        return result;
    };

    AttributePacker.prototype.getWebGLAttributeLocations = function(compressedAttributeBaseName) {
        var result = {};
        for (var i = 0; i < this._numberOfVertexAttributes; ++i) {
            result[compressedAttributeBaseName + i] = i;
        }
        return result;
    };

    AttributePacker.prototype.getGlslAttributeDeclarations = function(compressedAttributeBaseName) {
        var result = '';
        for (var i = 0; i < this._numberOfFloats; i += 4) {
            var elementCount = Math.min(this._numberOfFloats - i, 4);
            result += variableSizeNames[elementCount] + ' ' +
                      compressedAttributeBaseName + (i / 4 | 0) + ';\n';
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
                rhs = variableSizeNames[attribute.numberOfElements] + '(' + rhsParts.join(', ') + ')';
            }

            lines.push(variableSizeNames[attribute.numberOfElements] + ' ' + attribute.name + ' = ' + rhs + ';');
        });

        return lines.join('\n');
    };

    AttributePacker.prototype.putVertex = function(buffer, index, vertex) {
        computeStorage(this);
        this._put(AttributeCompression, cartesian2Scratch, buffer, index * this._numberOfFloats, vertex);
    };

    AttributePacker.prototype.getVertex = function(buffer, index, result) {
        computeStorage(this);

        result = result || {};
        return this._get(AttributeCompression, cartesian2Scratch, buffer, index * this._numberOfFloats, result);
    };

    AttributePacker.prototype.createSingleAttributeGetFunction = function(attributeName) {
    };

    function computeStorage(packer) {
        if (packer._get) {
            return;
        }

        var twelveBits = packer._flatAttributes.filter(function(attribute) {
            return attribute.compressedAttributeType === CompressedAttributeType.TWELVE_BITS;
        });

        var getArguments = ['AttributeCompression', 'cartesian2Scratch', 'buffer', 'index', 'result'];
        var putArguments = ['AttributeCompression', 'cartesian2Scratch', 'buffer', 'index', 'vertex'];

        var get = '';
        var put = '';
        var offset = 0;

        var i;
        for (i = 0; i < twelveBits.length; i += 2) {
            twelveBits[i].attributeIndex = (offset / 4) | 0;
            twelveBits[i].elementIndex = offset % 4;
            twelveBits[i].isFirstHalf = true;

            var vertexMember = twelveBits[i].name + (twelveBits[i].parentAttribute.subAttributes.length === 1 ? '' : '.' + elementNames[twelveBits[i].subAttrNumber]);

            get += 'AttributeCompression.decompressTextureCoordinates(buffer[index + ' + offset + '], cartesian2Scratch);\n';
            get += 'result.' + vertexMember + ' = cartesian2Scratch.x;\n';

            var second = i + 1;
            if (second < twelveBits.length) {
                var secondVertexMember = twelveBits[second].name + (twelveBits[second].parentAttribute.subAttributes.length === 1 ? '' : '.' + elementNames[twelveBits[second].subAttrNumber]);
                twelveBits[second].attributeIndex = twelveBits[i].attributeIndex;
                twelveBits[second].elementIndex = twelveBits[i].elementIndex;
                twelveBits[second].isFirstHalf = false;

                get += 'result.' + secondVertexMember + ' = cartesian2Scratch.y;\n';
                put += 'cartesian2Scratch.y = vertex.' + secondVertexMember + ';\n';

            } else {
                put += 'cartesian2Scratch.y = 0.0;\n';
            }

            put += 'cartesian2Scratch.x = vertex.' + vertexMember + ';\n';
            put += 'buffer[index + ' + offset + '] = AttributeCompression.compressTextureCoordinates(cartesian2Scratch);\n';

            ++offset;
        }

        var floats = packer._flatAttributes.filter(function(attribute) {
            return attribute.compressedAttributeType === CompressedAttributeType.FLOAT;
        });

        for (i = 0; i < floats.length; ++i) {
            floats[i].attributeIndex = (offset / 4) | 0;
            floats[i].elementIndex = offset % 4;

            var floatVertexMember = floats[i].name + (floats[i].parentAttribute.subAttributes.length === 1 ? '' : '.' + elementNames[floats[i].subAttrNumber]);

            get += 'result.' + floatVertexMember + ' = buffer[index + ' + offset + '];\n';
            put += 'buffer[index + ' + offset + '] = vertex.' + floatVertexMember + ';\n';

            ++offset;
        }

        // Yes, this is a form of eval.  It's also much faster than the alternatives.
        packer._get = new Function(getArguments, get); // jshint ignore:line
        packer._put = new Function(putArguments, put); // jshint ignore:line

        packer._numberOfFloats = offset;
        packer._numberOfVertexAttributes = Math.ceil(packer._numberOfFloats / 4.0);
    }

    var cartesian2Scratch = new Cartesian2();

    var elementNames = ['x', 'y', 'z', 'w'];
    var variableSizeNames = ['', 'float', 'vec2', 'vec3', 'vec4'];

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
