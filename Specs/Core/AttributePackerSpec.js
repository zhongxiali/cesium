/*global defineSuite*/
defineSuite([
        'Core/AttributePacker',
        'Core/AttributeCompression',
        'Core/Cartesian2',
        'Core/Cartesian3',
        'Core/ComponentDatatype',
        'Core/CompressedAttributeType'
    ], function(
        AttributePacker,
        AttributeCompression,
        Cartesian2,
        Cartesian3,
        ComponentDatatype,
        CompressedAttributeType) {
    'use strict';

    var packer;
    var fakeBuffer;

    beforeEach(function() {
        packer = new AttributePacker();
        fakeBuffer = [];
    });

    describe('addAttribute', function() {
        it('throws if given zero elements', function() {
            expect(function() {
                packer.addAttribute('foo', 0, CompressedAttributeType.FLOAT);
            }).toThrowDeveloperError();
        });

        it('throws if given more than 4 elements', function() {
            expect(function() {
                packer.addAttribute('foo', 5, CompressedAttributeType.FLOAT);
            }).toThrowDeveloperError();
        });
    });

    describe('getWebGLAttributeList', function() {
        it('works with a single float', function() {
            packer.addAttribute('foo', 1, CompressedAttributeType.FLOAT);
            expect(packer.getWebGLAttributeList(fakeBuffer)).toEqual([{
                index: 0,
                vertexBuffer: fakeBuffer,
                componentDatatype: ComponentDatatype.FLOAT,
                componentsPerAttribute: 1,
                offsetInBytes: 0,
                strideInBytes: 4
            }]);
        });

        it('works with two floats', function() {
            packer.addAttribute('foo', 2, CompressedAttributeType.FLOAT);
            expect(packer.getWebGLAttributeList(fakeBuffer)).toEqual([{
                index: 0,
                vertexBuffer: fakeBuffer,
                componentDatatype: ComponentDatatype.FLOAT,
                componentsPerAttribute: 2,
                offsetInBytes: 0,
                strideInBytes: 8
            }]);
        });

        it('works with three floats', function() {
            packer.addAttribute('foo', 3, CompressedAttributeType.FLOAT);
            expect(packer.getWebGLAttributeList(fakeBuffer)).toEqual([{
                index: 0,
                vertexBuffer: fakeBuffer,
                componentDatatype: ComponentDatatype.FLOAT,
                componentsPerAttribute: 3,
                offsetInBytes: 0,
                strideInBytes: 12
            }]);
        });

        it('works with four floats', function() {
            packer.addAttribute('foo', 4, CompressedAttributeType.FLOAT);
            expect(packer.getWebGLAttributeList(fakeBuffer)).toEqual([{
                index: 0,
                vertexBuffer: fakeBuffer,
                componentDatatype: ComponentDatatype.FLOAT,
                componentsPerAttribute: 4,
                offsetInBytes: 0,
                strideInBytes: 16
            }]);
        });

        it('works with two attributes of two floats each', function() {
            packer.addAttribute('foo', 2, CompressedAttributeType.FLOAT);
            packer.addAttribute('bar', 2, CompressedAttributeType.FLOAT);
            expect(packer.getWebGLAttributeList(fakeBuffer)).toEqual([{
                index: 0,
                vertexBuffer: fakeBuffer,
                componentDatatype: ComponentDatatype.FLOAT,
                componentsPerAttribute: 4,
                offsetInBytes: 0,
                strideInBytes: 16
            }]);
        });

        it('works with one attribute of three floats and another of one float', function() {
            packer.addAttribute('foo', 3, CompressedAttributeType.FLOAT);
            packer.addAttribute('bar', 1, CompressedAttributeType.FLOAT);
            expect(packer.getWebGLAttributeList(fakeBuffer)).toEqual([{
                index: 0,
                vertexBuffer: fakeBuffer,
                componentDatatype: ComponentDatatype.FLOAT,
                componentsPerAttribute: 4,
                offsetInBytes: 0,
                strideInBytes: 16
            }]);
        });

        it('works with one attribute of one float and another of three floats', function() {
            packer.addAttribute('foo', 1, CompressedAttributeType.FLOAT);
            packer.addAttribute('bar', 3, CompressedAttributeType.FLOAT);
            expect(packer.getWebGLAttributeList(fakeBuffer)).toEqual([{
                index: 0,
                vertexBuffer: fakeBuffer,
                componentDatatype: ComponentDatatype.FLOAT,
                componentsPerAttribute: 4,
                offsetInBytes: 0,
                strideInBytes: 16
            }]);
        });

        it('works with five total floats', function() {
            packer.addAttribute('foo', 3, CompressedAttributeType.FLOAT);
            packer.addAttribute('bar', 2, CompressedAttributeType.FLOAT);
            expect(packer.getWebGLAttributeList(fakeBuffer)).toEqual([
                {
                    index: 0,
                    vertexBuffer: fakeBuffer,
                    componentDatatype: ComponentDatatype.FLOAT,
                    componentsPerAttribute: 4,
                    offsetInBytes: 0,
                    strideInBytes: 20
                },
                {
                    index: 1,
                    vertexBuffer: fakeBuffer,
                    componentDatatype: ComponentDatatype.FLOAT,
                    componentsPerAttribute: 1,
                    offsetInBytes: 16,
                    strideInBytes: 20
                }
            ]);
        });

        it('works with a single 12 bit', function() {
            packer.addAttribute('foo', 1, CompressedAttributeType.TWELVE_BITS);
            expect(packer.getWebGLAttributeList(fakeBuffer)).toEqual([{
                index: 0,
                vertexBuffer: fakeBuffer,
                componentDatatype: ComponentDatatype.FLOAT,
                componentsPerAttribute: 1,
                offsetInBytes: 0,
                strideInBytes: 4
            }]);
        });

        it('works with two 12 bits', function() {
            packer.addAttribute('foo', 2, CompressedAttributeType.TWELVE_BITS);
            expect(packer.getWebGLAttributeList(fakeBuffer)).toEqual([{
                index: 0,
                vertexBuffer: fakeBuffer,
                componentDatatype: ComponentDatatype.FLOAT,
                componentsPerAttribute: 1,
                offsetInBytes: 0,
                strideInBytes: 4
            }]);
        });

        it('works with three 12 bits', function() {
            packer.addAttribute('foo', 3, CompressedAttributeType.TWELVE_BITS);
            expect(packer.getWebGLAttributeList(fakeBuffer)).toEqual([{
                index: 0,
                vertexBuffer: fakeBuffer,
                componentDatatype: ComponentDatatype.FLOAT,
                componentsPerAttribute: 2,
                offsetInBytes: 0,
                strideInBytes: 8
            }]);
        });

        it('works with four 12 bits', function() {
            packer.addAttribute('foo', 4, CompressedAttributeType.TWELVE_BITS);
            expect(packer.getWebGLAttributeList(fakeBuffer)).toEqual([{
                index: 0,
                vertexBuffer: fakeBuffer,
                componentDatatype: ComponentDatatype.FLOAT,
                componentsPerAttribute: 2,
                offsetInBytes: 0,
                strideInBytes: 8
            }]);
        });
    });

    describe('getGlslUnpackingCode', function() {
        it('works with a single float', function() {
            packer.addAttribute('foo', 1, CompressedAttributeType.FLOAT);
            expect(packer.getGlslUnpackingCode('packed')).toEqual('float foo = packed0;');
        });

        it('works with two floats', function() {
            packer.addAttribute('foo', 2, CompressedAttributeType.FLOAT);
            expect(packer.getGlslUnpackingCode('packed')).toEqual('vec2 foo = packed0;');
        });

        it('works with three floats', function() {
            packer.addAttribute('foo', 3, CompressedAttributeType.FLOAT);
            expect(packer.getGlslUnpackingCode('packed')).toEqual('vec3 foo = packed0;');
        });

        it('works with four floats', function() {
            packer.addAttribute('foo', 4, CompressedAttributeType.FLOAT);
            expect(packer.getGlslUnpackingCode('packed')).toEqual('vec4 foo = packed0;');
        });

        it('works with two attributes of two floats each', function() {
            packer.addAttribute('foo', 2, CompressedAttributeType.FLOAT);
            packer.addAttribute('bar', 2, CompressedAttributeType.FLOAT);
            expect(packer.getGlslUnpackingCode('packed')).toEqual('vec2 foo = packed0.xy;\nvec2 bar = packed0.zw;');
        });

        it('works with one attribute of three floats and another of one float', function() {
            packer.addAttribute('foo', 3, CompressedAttributeType.FLOAT);
            packer.addAttribute('bar', 1, CompressedAttributeType.FLOAT);
            expect(packer.getGlslUnpackingCode('packed')).toEqual('vec3 foo = packed0.xyz;\nfloat bar = packed0.w;');
        });

        it('works with one attribute of one float and another of three floats', function() {
            packer.addAttribute('foo', 1, CompressedAttributeType.FLOAT);
            packer.addAttribute('bar', 3, CompressedAttributeType.FLOAT);
            expect(packer.getGlslUnpackingCode('packed')).toEqual('float foo = packed0.x;\nvec3 bar = packed0.yzw;');
        });

        it('works with two attributes of three floats each', function() {
            packer.addAttribute('foo', 3, CompressedAttributeType.FLOAT);
            packer.addAttribute('bar', 3, CompressedAttributeType.FLOAT);
            expect(packer.getGlslUnpackingCode('packed')).toEqual('vec3 foo = packed0.xyz;\nvec3 bar = vec3(packed0.w, packed1);');
        });

        it('works with a single 12 bit', function() {
            packer.addAttribute('foo', 1, CompressedAttributeType.TWELVE_BITS);
            expect(packer.getGlslUnpackingCode('packed')).toEqual('vec2 twelveBit0x = czm_decompressTextureCoordinates(packed0.x);\nfloat foo = twelveBit0x.x;');
        });

        it('works with two 12 bits', function() {
            packer.addAttribute('foo', 2, CompressedAttributeType.TWELVE_BITS);
            expect(packer.getGlslUnpackingCode('packed')).toEqual('vec2 twelveBit0x = czm_decompressTextureCoordinates(packed0.x);\nvec2 foo = twelveBit0x;');
        });

        it('works with three 12 bits', function() {
            packer.addAttribute('foo', 3, CompressedAttributeType.TWELVE_BITS);
            expect(packer.getGlslUnpackingCode('packed')).toEqual('vec2 twelveBit0x = czm_decompressTextureCoordinates(packed0.x);\nvec2 twelveBit0y = czm_decompressTextureCoordinates(packed0.y);\nvec3 foo = vec3(twelveBit0x, twelveBit0y.x);');
        });
    });

    describe('putVertex', function() {
        it('works with a single float', function() {
            packer.addAttribute('foo', 1, CompressedAttributeType.FLOAT);
            packer.putVertex(fakeBuffer, 0, {
                foo: 1.23
            });
            expect(fakeBuffer[0]).toBe(1.23);
        });

        it('works with a two floats', function() {
            packer.addAttribute('foo', 1, CompressedAttributeType.FLOAT);
            packer.addAttribute('bar', 1, CompressedAttributeType.FLOAT);
            packer.putVertex(fakeBuffer, 0, {
                foo: 1.23,
                bar: 4.56
            });
            expect(fakeBuffer[0]).toBe(1.23);
            expect(fakeBuffer[1]).toBe(4.56);
        });

        it('works with a single Cartesian2', function() {
            packer.addAttribute('foo', 2, CompressedAttributeType.FLOAT);
            packer.putVertex(fakeBuffer, 0, {
                foo: new Cartesian2(1.23, 4.56)
            });
            expect(fakeBuffer[0]).toBe(1.23);
            expect(fakeBuffer[1]).toBe(4.56);
        });

        it('works with a 12 bit Cartesian2', function() {
            packer.addAttribute('foo', 2, CompressedAttributeType.TWELVE_BITS);
            packer.putVertex(fakeBuffer, 0, {
                foo: new Cartesian2(1.23, 4.56)
            });
            expect(fakeBuffer[0]).toBe(AttributeCompression.compressTextureCoordinates(new Cartesian2(1.23, 4.56)));
        });

        it('works with a 12 bit Cartesian3', function() {
            packer.addAttribute('foo', 3, CompressedAttributeType.TWELVE_BITS);
            packer.putVertex(fakeBuffer, 0, {
                foo: new Cartesian3(1.23, 4.56, 7.89)
            });
            expect(fakeBuffer[0]).toBe(AttributeCompression.compressTextureCoordinates(new Cartesian2(1.23, 4.56)));
            expect(fakeBuffer[1]).toBe(AttributeCompression.compressTextureCoordinates(new Cartesian2(7.89, 0.0)));
        });

        it('works with two 12 bit Cartesian2s', function() {
            packer.addAttribute('foo', 2, CompressedAttributeType.TWELVE_BITS);
            packer.addAttribute('bar', 2, CompressedAttributeType.TWELVE_BITS);
            packer.putVertex(fakeBuffer, 0, {
                foo: new Cartesian2(1.23, 4.56),
                bar: new Cartesian2(7.89, 10.11)
            });
            expect(fakeBuffer[0]).toBe(AttributeCompression.compressTextureCoordinates(new Cartesian2(1.23, 4.56)));
            expect(fakeBuffer[1]).toBe(AttributeCompression.compressTextureCoordinates(new Cartesian2(7.89, 10.11)));
        });

        it('works with two 12 bit Cartesian3s', function() {
            packer.addAttribute('foo', 3, CompressedAttributeType.TWELVE_BITS);
            packer.addAttribute('bar', 3, CompressedAttributeType.TWELVE_BITS);
            packer.putVertex(fakeBuffer, 0, {
                foo: new Cartesian3(1.23, 4.56, 7.89),
                bar: new Cartesian3(10.11, 12.13, 14.15)
            });
            expect(fakeBuffer[0]).toBe(AttributeCompression.compressTextureCoordinates(new Cartesian2(1.23, 4.56)));
            expect(fakeBuffer[1]).toBe(AttributeCompression.compressTextureCoordinates(new Cartesian2(7.89, 10.11)));
            expect(fakeBuffer[2]).toBe(AttributeCompression.compressTextureCoordinates(new Cartesian2(12.13, 14.15)));
        });
    });

    describe('everything', function() {
        it('works with a typical terrain vertex structure', function() {
            packer.addAttribute('position', 3, CompressedAttributeType.TWELVE_BITS);
            packer.addAttribute('textureCoordinates', 2, CompressedAttributeType.TWELVE_BITS);
            packer.addAttribute('height', 1, CompressedAttributeType.TWELVE_BITS);
            packer.addAttribute('webMercatorY', 1, CompressedAttributeType.TWELVE_BITS);
            packer.addAttribute('normal', 1, CompressedAttributeType.FLOAT);

            expect(packer.getWebGLAttributeList(fakeBuffer)).toEqual([
                {
                    index: 0,
                    vertexBuffer: fakeBuffer,
                    componentDatatype: ComponentDatatype.FLOAT,
                    componentsPerAttribute: 4,
                    offsetInBytes: 0,
                    strideInBytes: 20
                },
                {
                    index: 1,
                    vertexBuffer: fakeBuffer,
                    componentDatatype: ComponentDatatype.FLOAT,
                    componentsPerAttribute: 1,
                    offsetInBytes: 16,
                    strideInBytes: 20
                }
            ]);

            expect(packer.getGlslUnpackingCode('packed')).toBe(
                'vec2 twelveBit0x = czm_decompressTextureCoordinates(packed0.x);\n' +
                'vec2 twelveBit0y = czm_decompressTextureCoordinates(packed0.y);\n' +
                'vec3 position = vec3(twelveBit0x, twelveBit0y.x);\n' +
                'vec2 twelveBit0z = czm_decompressTextureCoordinates(packed0.z);\n' +
                'vec2 textureCoordinates = vec2(twelveBit0y.y, twelveBit0z.x);\n' +
                'float height = twelveBit0z.y;\n' +
                'vec2 twelveBit0w = czm_decompressTextureCoordinates(packed0.w);\n' +
                'float webMercatorY = twelveBit0w.x;\n' +
                'float normal = packed1;');

            packer.putVertex(fakeBuffer, 0, {
                position: new Cartesian3(0.12, 0.34, 0.45),
                textureCoordinates: new Cartesian2(0.67, 0.89),
                height: 0.910,
                webMercatorY: 0.1112,
                normal: AttributeCompression.octPackFloat(new Cartesian2(0.1314, 0.1516))
            });

            packer.putVertex(fakeBuffer, 1, {
                position: new Cartesian3(0.89, 0.76, 0.54),
                textureCoordinates: new Cartesian2(0.32, 0.10),
                height: 0.123,
                webMercatorY: 0.456,
                normal: AttributeCompression.octPackFloat(new Cartesian2(0.789, 0.1011))
            });

            var vertex = {
                position: new Cartesian3(),
                textureCoordinates: new Cartesian2(),
                height: 0.0,
                webMercatorY: 0.0,
                normal: 0.0
            };

            packer.getVertex(fakeBuffer, 0, vertex);
            expect(vertex.position).toEqualEpsilon(new Cartesian3(0.12, 0.34, 0.45), 1/4096);
        });
    });
});