"use strict";
var defineGetter    = require('./define-getter');
var log             = require('../log/log');
var Promise         = require('bluebird-settle');

var exiting = false;
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
    if (exiting) return;
    exiting = true;
    return function(code) {
        log.info('exit', '');
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
    log.info('SIGINT', '');
    process.exit(0);
});

process.on('exit', function() {
    process.exit(0);
});