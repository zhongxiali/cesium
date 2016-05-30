/*global define*/
define([
        './Cartesian2',
        './Cartesian3',
        './Cartesian4',
        './defaultValue',
        './defined',
        './defineProperties',
        './Ellipsoid',
        './Matrix4'
    ], function(
        Cartesian2,
        Cartesian3,
        Cartesian4,
        defaultValue,
        defined,
        defineProperties,
        Ellipsoid,
        Matrix4) {
    'use strict';

    /**
     * The occlusion caused by the (approximated) horizon.  This occluder essentially works in screen space.  For each
     * horizonal pixel on the screen, it tracks the vertical location of the horizon.  When rendering front-to-back, any
     * objects that have all their pixels (e.g. a rasterization of a bounding volume of some kind) below this horizon
     * are occluded and need not be rendered.  For the purpose of horizon occlusion testing, the camera should be assumed
     * to be oriented with the sky up, regardless of its actual orientation.
     *
     * @alias HorizonOccluder
     * @constructor
     * @private
     *
     * @param {Number} options.width The width of the horizon buffer.  Typically, this is the width of the drawing buffer in pixels.
     * @param {Number} options.height The height of the horizon buffer.  Typically, this is the height of the drawing buffer in pixels.
     */
    function HorizonOccluder(options) {
        options = options || {};

        this._ellipsoid = defaultValue(options.ellipsoid, Ellipsoid.WGS84);
        this._horizon = undefined;
        this._worldToClipMatrix = new Matrix4();
    }

    defineProperties(HorizonOccluder.prototype, {
        ellipsoid : {
            get: function() {
                return this._ellipsoid;
            }
        }
    });

    // Test for horizon culling (in 3D only) as follows:
    // Can precompute:
    // - Min/max planes for each tile, taking into account the min/max heights relative to the min/max distance of the tile from the ellipsoid.
    // - Bounding lines from these planes, taking into account the fact that lines of latitude are curved, so the boundaries need to either include or exclude these curves.

    // Must compute for every view:
    // - Determine appropriate projection matrix - use Camera method, which requires a position, a view direction and an “up” direction;
    //     we want to make sure the up direction is “up” relative to the ellipsoid.
    // - Project the edges onto the screen coordinates
    // - Test the lines against a 1D buffer containing the height of the current horizon (relative to the ellipsoid).

    // TODO: Precompute what we can.
    // TODO: Only works if the closest tiles are tested first. Can we guarantee that?
    // TODO: Need to reset horizonMinimumScreenHeight when the view (camera) changes.
    // TODO: Take into account the fact that lines of latitude are curved.
    // TODO: set hasViewChanged to true when view changes, to force recalculation of frameState's normalUpViewMatrix and horizonMinimumScreenHeight.
    // TODO: set hasViewportChanged to true when the canvas dimensions change.

    var rightScratch = new Cartesian3();
    var upScratch = new Cartesian3();

    /**
     * Updates the camera position and clears the horizon.
     *
     * @param {Matrix4} projectionMatrix The matrix defining the perspective transformation of the camera.
     * @param {Cartesian3} position The position of the camera in ECEF coordinates.
     * @param {Cartesian3} direction The look direction of the camera in the ECEF axes.
     */
    HorizonOccluder.prototype.updateCamera = function(projectionMatrix, position, direction, width, height) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(projectionMatrix)) {
            throw new DeveloperError('projectionMatrix is required');
        }
        if (!defined(position)) {
            throw new DeveloperError('position is required');
        }
        if (!defined(direction)) {
            throw new DeveloperError('direction is required');
        }
        if (!defined(width)) {
            throw new DeveloperError('width is required');
        }
        if (!defined(height)) {
            throw new DeveloperError('height is required');
        }
        //>>includeEnd('debug');

        // TODO: what happens when we're looking straight down?
        // TODO: used cached matrix when position/direction don't change.

        this._width = width;
        this._height = height;

        if (!this._horizon || this._horizon.length !== width) {
            this._horizon = new Int16Array(width);
        }

        var surfaceNormal = this._ellipsoid.geodeticSurfaceNormal(position, rightScratch);
        var right = Cartesian3.cross(direction, surfaceNormal, rightScratch);
        var up = Cartesian3.cross(right, direction, upScratch);

        var viewMatrix = Matrix4.computeView(position, direction, up, right, this._worldToClipMatrix);
        this._worldToClipMatrix = Matrix4.multiply(projectionMatrix, viewMatrix, this._worldToClipMatrix);

        this._horizon.fill(0);
    };

    var startClipScratch = new Cartesian2();
    var endClipScratch = new Cartesian2();

    /**
     * Adds a world-space line to the horizon.  Anything below this line will be considered occluded.
     *
     * @param {Cartesian3} startPosition The start position of the line in ECEF coordinates.
     * @param {Cartesian3} endPosition The end position of the line in ECEF coordinates.
     */
    HorizonOccluder.prototype.addWorldSpaceOcclusionLine = function(startPosition, endPosition) {
        var startClip = this.transformWorldCoordinatesToDrawingBuffer(startPosition, startClipScratch);
        var endClip = this.transformWorldCoordinatesToDrawingBuffer(endPosition, endClipScratch);
        this.addScreenSpaceOcclusionLine(startClip.x, startClip.y, endClip.x, endClip.y);
    };

    /**
     * Adds a screen-space line to the horizon.  0,0 is the bottom left and width-1,height-1 is the
     * top right.
     *
     * @param {Number} startX The X coordinate of the start of the line.
     * @param {Number} startY The Y coordinate of the start of the line.
     * @param {Number} endX The X coordinate of the end of the line.
     * @param {Number} endY The Y coordinate of the end of the line.
     */
    HorizonOccluder.prototype.addScreenSpaceOcclusionLine = function(startX, startY, endX, endY) {
        // We want increasing X values.
        if (endX < startX) {
            var tmp = startX;
            startX = endX;
            endX = tmp;
            tmp = startY;
            startY = endY;
            endY = tmp;
        }

        if (endX < 0 || startX >= this._width) {
            // Line is entirely outside the horizon buffer.
            // TODO: test if startY and endY are less than zero, meaning tile is entirely below the screen?
            //       Frustum culling will discard entirely non-visible tiles, but visible tiles might
            //       still have non-visible lines.
            return;
        }

        var yIncrement = calculateYIncrement(startX, endX, startY, endY);

        var x = Math.round(startX) | 0;
        x = Math.max(x, 0);
        x = Math.min(x, this._width - 1);

        var lastX = Math.round(endX) | 0;
        lastX = Math.max(lastX, 0);
        lastX = Math.min(lastX, this._width - 1);

        var horizon = this._horizon;

        var y = startY + (endY - startY) * (x - startX) / (endX - startX);
        for (; x <= lastX; ++x) {
            var rounded = Math.round(y);
            if (rounded > horizon[x]) {
                horizon[x] = rounded;
            }
            y += yIncrement;
        }
    };

    /**
     * Tests a world-space line against the current horizon.
     *
     * @param {Cartesian3} startPosition The start position of the line in ECEF coordinates.
     * @param {Cartesian3} endPosition The end position of the line in ECEF coordinates.
     * @return {Visibility} The visibility status of the line.
     */
    HorizonOccluder.prototype.testWorldSpaceLine = function(startPosition, endPosition) {
        var startClip = this.transformWorldCoordinatesToDrawingBuffer(startPosition, startClipScratch);
        var endClip = this.transformWorldCoordinatesToDrawingBuffer(endPosition, endClipScratch);
        return this.testScreenSpaceOcclusionLine(startClip.x, startClip.y, endClip.x, endClip.y);
    };

    /**
     * Test a screen-space line against the current horizon.  0,0 is the bottom left and width-1,height-1 is the
     * top right.
     *
     * @param {Number} startX The X coordinate of the start of the line.
     * @param {Number} startY The Y coordinate of the start of the line.
     * @param {Number} endX The X coordinate of the end of the line.
     * @param {Number} endY The Y coordinate of the end of the line.
     */
    HorizonOccluder.prototype.testScreenSpaceOcclusionLine = function(startX, startY, endX, endY) {
        var yIncrement = calculateYIncrement(startX, endX, startY, endY);

        var x = Math.round(startX) | 0;
        x = Math.max(x, 0);
        x = Math.min(x, this._width - 1);

        var lastX = Math.round(endX) | 0;
        lastX = Math.max(lastX, 0);
        lastX = Math.min(lastX, this._width - 1);

        var horizon = this._horizon;

        var y = startY + (endY - startY) * (x - startX) / (endX - startX);
        for (; x <= lastX; ++x) {
            if (y > horizon[x]) {
                return true;
            }
            y += yIncrement;
        }

        return false;
    };

    var transformWorldToDrawingBufferScratch = new Cartesian4();

    HorizonOccluder.prototype.transformWorldCoordinatesToDrawingBuffer = function(position, result) {
        // Transform endpoints to clip coordinates
        Cartesian4.fromElements(position.x, position.y, position.z, 1.0, transformWorldToDrawingBufferScratch);
        var startClip = Matrix4.multiplyByVector(this._worldToClipMatrix, transformWorldToDrawingBufferScratch, transformWorldToDrawingBufferScratch);

        // Transform to normalized device coordinates with perspective divide, and transform to drawing buffer coordinates.
        return Cartesian2.fromElements(
            (startClip.x / startClip.w + 1.0) * 0.5 * this._width,
            (startClip.y / startClip.w + 1.0) * 0.5 * this._height,
            result);
    };

    // Interpolating between two points, when x increases by 1, how much does y increase?
    function calculateYIncrement(x1, x2, y1, y2) {
        if (x1 === x2) {
            return 0;
        }
        return (y2 - y1) / (x2 - x1);
    }

    return HorizonOccluder;
});
