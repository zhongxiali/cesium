/*global define*/
define([
        './freezeObject'
    ], function(
        freezeObject) {
    'use strict';

    var CompressedAttributeType = {
        /**
         * A plain old 32-bit floating point number.
         * @type {Number}
         * @constant
         * @default 0
         */
        FLOAT : 0,

        /**
         * A number in the range 0-1 represented using 12 bits of precision
         * (4096) discrete values.
         * @type {Number}
         * @constant
         * @default 1
         */
        TWELVE_BITS : 1
    };

    return freezeObject(CompressedAttributeType);
});