/*global define*/
define([
        './defaultValue',
        './defined',
        './DeveloperError',
        '../ThirdParty/when'
    ], function(
        defaultValue,
        defined,
        DeveloperError,
        when) {
    "use strict";

    var argumentsScratch = [];

    /**
     * @private
     */
    var PromiseThrottler = {
        create : function(maximumInFlight) {
            var currentInFlight = 0;

            var f = function() {
                if (currentInFlight >= f.maximumInFlight) {
                    return undefined;
                }

                for (var i = 0; i < arguments.length; ++i) {
                    argumentsScratch[i] = arguments[i];
                }
                argumentsScratch.length = arguments.length;

                if (argumentsScratch.length === 0) {
                    throw new DeveloperError('The function to call to create the promise must be provided as the last argument.');
                }

                var promiseFunction = argumentsScratch.pop();

                ++currentInFlight;

                var promise = promiseFunction.apply(undefined, argumentsScratch);
                return when(promise, function(result) {
                    --currentInFlight;
                    return result;
                }, function(e) {
                    --currentInFlight;
                    throw e;
                });
            };

            Object.defineProperty(f, 'maximumInFlight', {
                get : function() {
                    return maximumInFlight;
                },
                set : function(value) {
                    maximumInFlight = value;
                }
            });

            return f;
        },

        createOrModify : function(existingThrottler, maximumInFlight) {
            if (defined(existingThrottler) && defined(existingThrottler.maximumInFlight)) {
                existingThrottler.maximumInFlight = maximumInFlight;
                return existingThrottler;
            } else {
                return PromiseThrottler.create(maximumInFlight);
            }
        }
    };

    return PromiseThrottler;
});
