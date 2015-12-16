"use strict";
// This file defines an error type that does not produce a stack trace.

module.exports = NoStackError;

function NoStackError(message) {
    this.name = 'NoStackError';
    this.message = message || 'Error';
    this.stack = message;//(new Error()).stack;
}
NoStackError.prototype = Object.create(Error.prototype);
NoStackError.prototype.constructor = NoStackError;


NoStackError.catch = function(e) {
    console.error('Error: ' + e.message);
};

NoStackError.throw = function(e) {
    throw new NoStackError(e.message);
};