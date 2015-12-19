"use strict";
// This file defines an error type that does not produce a stack trace.

/*
Usage Example:

var customError = require('./custom-error');        //include the custom error module
var MyError = customError('MyError');               //define a error group
var InputError = MyError('input');                  //create an error code classification for the group
throw new InputError('Bad input');                  //throw an error
throw new InputError('Bad input', 5);               //throw an error with 5 lines in the stack trace
 */

var defaultStackLimit = 10;
var store = {};

module.exports = function(name, stackLimit) {
    if (store.hasOwnProperty(name)) throw new Error('A custom error with this name already exists: ' + name);
    store[name] = {};
    return function(code) {
        code = 'E' + code.toUpperCase();
        if (!store[name].hasOwnProperty(code)) store[name][code] = getCustomError(name, code);
        return store[name][code];
    };
};

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