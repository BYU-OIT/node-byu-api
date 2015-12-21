"use strict";
// This file defines an error type that does not produce a stack trace.

/*
Usage Example:

var customError = require('./custom-error');        //include the custom error module
var MyError = customError('MyError', {
    terminated: 'term'
};
throw new MyError.terminated('Process has terminated');     //output error as - MyError Error ETERM: Process has terminated
throw new MyError.terminated('Process has terminated', 5);  //throw an error with 5 lines in the stack trace
 */

var defaultStackLimit = 10;
var store = {};

/**
 * Generate a set of error types that fall under the specified name space.
 * @param {string} name
 * @param {object} [map]
 * @returns {object}
 */
module.exports = function(name, map) {
    var result = {};
    if (store.hasOwnProperty(name)) throw new Error('A custom error with this name already exists: ' + name);
    if (typeof map === 'object') {
        Object.keys(map).forEach(function (key) {
            result[key] = module.exports.add(name, map[key]);
        });
    }
    return result;
};

/**
 * Add another error type to the specified name space.
 * @param {string} name
 * @param {string} code
 * @returns {Error}
 */
module.exports.add = function(name, code) {
    if (!store.hasOwnProperty(name)) store[name] = {};
    code = 'E' + code.toUpperCase();
    if (!store[name].hasOwnProperty(code)) store[name][code] = getCustomError(name, code);
    return store[name][code];
};

/**
 * Get or set the default stack trace size.
 */
Object.defineProperty(module.exports, 'stackTraceLimit', {
    enumerable: true,
    configurable: false,
    get: function() {
        return defaultStackLimit;
    },
    set: function(value) {
        if (isValidLimit(value)) defaultStackLimit = value;
    }
});

function getCustomError(name, code) {
    function CustomError(message, stackLimit) {
        var err;
        var limit = Error.stackTraceLimit;
        var stack;
        if (!message) message = '';

        if (!isValidLimit(stackLimit)) stackLimit = defaultStackLimit;

        //create an error that we can get the stack from
        Error.stackTraceLimit = stackLimit + 1;
        err = new Error();
        Error.stackTraceLimit = limit;

        //split the stack on new lines
        stack = err.stack.split('\n');

        //replace the first line in the stack with custom error message
        stack[0] = name + 'Error ' + code + ': ' + message;

        //remove second line in the stack (because it just points to this file)
        stack.splice(1, 1);

        this.name = name;
        this.code = code;
        this.message = message;
        this.stack = stack.join('\n');
    }
    CustomError.prototype = Object.create(Error.prototype);
    CustomError.prototype.constructor = CustomError;

    return CustomError;
}

function isValidLimit(value) {
    return typeof value === 'number' && !isNaN(value) && value >= 0;
}