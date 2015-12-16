"use strict";
// This file has some file helper utilities.
var fs                  = require('fs');
var p                   = require('path');
var Promise             = require('bluebird');


//
/**
 * Read a directory and return directory paths (no file paths) for that directory
 * @param {string} path
 * @param {boolean} [recursive=false]
 * @returns {Promise} with an object that maps full directory paths to stat objects.
 */
exports.readdirStats = function(path, recursive) {
    return exports.readdir(path)
        .then(function(fileNames) {
            var promises = [];
            var results = {};

            //check each file
            fileNames.forEach(function(fileName) {
                var fullPath = p.resolve(path, fileName);
                var promise = exports.stat(fullPath)
                    .then(function(stat) {
                        results[fullPath] = stat;
                        if (!recursive || !stat.isDirectory()) return;
                        return exports.readdirStats(fullPath, true)
                            .then(function(map) {
                                Object.assign(results, map);
                            });
                    });
                promise.catch(function(err) {});
                promises.push(promise);
            });

            //return results
            return Promise.all(promises)
                .then(function() {
                    return results;
                });
        })
        .catch(function(err) {
            return {};
        });
};


/**
 * Make a directory
 * @param {string} path
 * @param {string} mode
 * @param {function} [callback]
 * @returns {Promise|undefined} A promise if no callback was supplied, otherwise undefined.
 */
exports.mkdir = function(path, mode, callback) {
    return fsPromise('mkdir', arguments, 1);
};

/**
 * Read a directory
 * @param path
 * @param [callback]
 * @returns {Promise|undefined} A promise if no callback was supplied, otherwise undefined.
 */
exports.readdir = function(path, callback) {
    return fsPromise('readdir', arguments, null);
};

/**
 * Read a file
 * @param {string} file
 * @param {object|string} options
 * @param {function} [callback]
 * @returns {Promise|undefined} A promise if no callback was supplied, otherwise undefined.
 */
exports.readFile = function(file, options, callback) {
    return fsPromise('readFile', arguments, 1);
};

/**
 * Remove a directory
 * @param {string} path
 * @param {function} [callback]
 * @returns {Promise|undefined} A promise if no callback was supplied, otherwise undefined.
 */
exports.rmdir = function(path, callback) {
    return fsPromise('rmdir', arguments, null);
};

/**
 * Get file stat data.
 * @param {string} path
 * @param {function} [callback]
 * @returns {Promise|undefined} A promise if no callback was supplied, otherwise undefined.
 */
exports.stat = function(path, callback) {
    return fsPromise('stat', arguments, null);
};

/**
 * Write to a file.
 * @param {string} path
 * @param {string} data
 * @param {function} [callback]
 * @param [callback]
 * @returns {Promise|undefined} A promise if no callback was supplied, otherwise undefined.
 */
exports.writeFile = function(path, data, options, callback) {
    return fsPromise('writeFile', arguments, 2);
};

/**
 * Unlink a file.
 * @param {string} path
 * @param {function} [callback]
 * @returns {Promise|undefined} A promise if no callback was supplied, otherwise undefined.
 */
exports.unlink = function(path, callback) {
    return fsPromise('mkdir', arguments, null);
};



function fsPromise(method, args, opIndex) {
    var params = Array.prototype.slice.call(args, 0, opIndex || void 0);

    if (opIndex && args.length === opIndex + 1 && typeof args[opIndex] !== 'function') {
        params.push(args[opIndex]);
    }

    if (typeof args[args.length - 1] === 'function') {
        fs[method].apply(fs, params);
    } else {
        return new Promise(function(resolve, reject) {
            params.push(function(err, data) {
                if (err) return reject(err);
                return resolve(data);
            });
            fs[method].apply(fs, params);
        });
    }
}