"use strict";

module.exports = function (object, name, callback) {
    Object.defineProperty(object, name, {
        enumerable: true,
        configurable: false,
        get: callback,
        set: noop
    });
};

function noop() {};