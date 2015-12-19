"use strict";
// This file provides a function that allows another function to use either a callback
// paradigm or a Promise paradigm.

var Promise             = require('bluebird');

module.exports = promiseOption;

/**
 * Enable a function to use either a callback paradigm or a promise paradigm.
 * @param {object} [scope] The scope to call the function with.
 * @param {function} callback The function to wrap with an optional promise paradigm. This
 * function must accept a callback function as it's last parameter.
 * @returns {Function}
 */
function promiseOption(scope, callback) {
    if (arguments.length === 1 && typeof arguments[0] === 'function') {
        callback = arguments[0];
        scope = global;
    }

    return function() {
        var args = [];
        var lastArg;
        var i;

        //convert arguments into an array
        for (i = 0; i < arguments.length; i++) {
            args.push(arguments[i]);
        }

        //get the last argument
        lastArg = args[args.length - 1];

        //if using callback paradigm
        if (typeof lastArg === 'function') {
            return callback.apply(scope, args);

        //using the promise paradigm
        } else {
            return new Promise(function(resolve, reject) {
                args.push(function(err, data) {
                    if (err) return reject(err);
                    return resolve(data);
                });
                return callback.apply(scope, args);
            });
        }
    }
}