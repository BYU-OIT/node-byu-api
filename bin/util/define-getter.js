"use strict";
var noop            = require('./noop');

module.exports = function (object, name, callback) {
    Object.defineProperty(object, name, {
        enumerable: true,
        configurable: false,
        get: callback,
        set: noop
    });
};