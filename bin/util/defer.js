"use strict";
var Promise         = require('bluebird');

/**
 * Get a deferred object.
 * @returns {object}
 */
module.exports = function() {
    var resolve;
    var reject;
    var promise = new Promise(function() {
        resolve = arguments[0];
        reject = arguments[1];
    });
    return {
        resolve: resolve,
        reject: reject,
        promise: promise
    };
}