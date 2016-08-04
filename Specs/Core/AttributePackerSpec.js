/*global defineSuite*/
defineSuite([
        'Core/AttributePacker',
        'Core/Cartesian2',
        'Core/ComponentDatatype',
        'Core/CompressedAttributeType'
    ], function(
        AttributePacker,
        Cartesian2,
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
            expect(fakeBuffer[0]).toBe(AttributeCompression.compressTextureCoordinates(1.23, 4.56));
        });
    });
});