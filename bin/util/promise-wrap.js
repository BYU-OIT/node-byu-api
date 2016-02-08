"use strict";
var Promise         = require('bluebird');

/**
 * Make a callback return a promise.
 * @param {function} callback
 * @returns {Promise}
 */
module.exports = function (callback) {
    var result;
    try {
        result = callback();
        return !result || typeof result !== 'object' || typeof result.then !== 'function' ?
            Promise.resolve(result) :
            result;
    } catch (e) {
        return Promise.reject(e);
    }
};