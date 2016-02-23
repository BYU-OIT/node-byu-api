"use strict";
var is              = require('./is');
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
        return !is.promise(result) ? Promise.resolve(result) : result;
    } catch (e) {
        return Promise.reject(e);
    }
};