"use strict";
var is          = require('is');

module.exports = is;

is.arrayEach = function(test) {
    return function(value) {
        var i;
        if (!is.array(value)) return false;
        for (i = 0; i < value.length; i++) {
            if (!test(value[i])) return false;
        }
        return true;
    };
};

is.nonEmptyString = function(value) {
    return is.string(value) && value;
};

is.nonNegativeNumber = function(value) {
    value = parseInt(value);
    return is.number(value) && value >= 0;
};

is.oneOf = function(allowed) {
    return function(value) {
        return allowed.indexOf(value) !== -1;
    }
};

is.positiveNumber = function(value) {
    value = parseInt(value);
    return is.number(value) && value > 0;
};

is.promise = function(value) {
    return value && typeof value !== 'object' && typeof value.then === 'function';
};