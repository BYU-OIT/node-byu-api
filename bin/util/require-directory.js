"use strict";
/**
 * This file provides a function that will do a NodeJS require on all JavaScript files found in the connector directory.
 * Those files loaded have the responsibility to use the connector interface to define connectors.
 */
var file            = require('./file');
var path            = require('path');
var Promise         = require('bluebird');

var loadedDirectories = [];

module.exports = requireDirectory;

/**
 * Require all JavaScript files in a directory.
 * @param {string} dirPath
 * @param {number} [depth=-1] Set to 0 (zero) to only read the directory specified, and not sub-directories.
 * @param {function} [filter] A function to run each file path through to determine if it should be required.
 * @returns {Promise}
 */
function requireDirectory(dirPath, depth, filter) {
    var absPath = path.resolve(__dirname, '..', dirPath);
    if (typeof filter !== 'function') filter = function() { return true; };
    if (loadedDirectories.indexOf(absPath) !== -1) return Promise.resolve();
    return file.readdirStats(absPath)
        .then(function(statMap) {
            var promises = [];
            loadedDirectories.push(absPath);
            Object.keys(statMap).forEach(function(filePath) {
                var stat = statMap[filePath];
                var module;
                if (stat.isFile() && /\.js$/.test(filePath) && filter(filePath)) {
                    require(filePath);
                } else if (stat.isDirectory() && depth !== 0) {
                    promises.push(requireDirectory(filePath, depth - 1));
                }
            });
            return Promise.all(promises);
        });
}