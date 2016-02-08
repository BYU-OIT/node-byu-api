"use strict";
var defineGetter    = require('./define-getter');
var Promise         = require('bluebird-settle');

var store = [];
var terminal = false;

/**
 * Add a function to be called if the process begins to exit.
 * @param {function} callback
 */
exports.listen = function(callback) {
    store.push(callback);
};

/**
 * Get whether the process is currently exiting.
 * @type {boolean}
 */
exports.terminal = terminal;
defineGetter(exports, 'terminal', () => terminal);

/**
 * Remove a function from the listeners.
 * @param callback
 */
exports.unlisten = function(callback) {
    var index = store.indexOf(callback);
    if (index !== -1) store.splice(index, 1);
};




//overwrite the process.exit function
process.exit = (function(exit) {
    return function(code) {
        console.log('Process exit invoked');
        var promises = [];
        store.forEach(function(callback) {
            var result = callback();
            promises.push(Promise.resolve(result));
        });
        Promise.settle(promises).then(function(results) {
            results.filter((r) => r.isRejected())
                .forEach((r) => console.error(r));
            exit(code);
        });
    }
})(process.exit);

process.on('SIGINT', function() {
    console.log('SIGINT signal received');
    process.exit(0);
});

process.on('exit', function() {
    console.log('Process exit inevitable');
});