"use strict";
const CustomError       = require('custom-error-instance');
const definition        = require('./definition');
const file              = require('../util/file');
const fs                = require('fs');
const is                = require('../util/is');
const log               = require('../log/log');
const logDetails        = require('../log/index').details;
const path              = require('path');
const schemata          = require('object-schemata');

var Err = CustomError('ResourceError');
Err.dne = CustomError(Err, { code: 'EDNE' });

module.exports = Resource;

/**
 * Require resource and sub resource files from the directory specified.
 * @param configuration
 * @returns {Promise}
 */
function Resource(configuration) {
    var config = Resource.schema.normalize(configuration);
    var src = config.src;

    function resourceAllowed(resourceName) {
        var limit = config.srcFilter;
        if (!limit) return true;
        return limit.indexOf(resourceName) !== -1;
    }

    // set up logging
    if (config.srcLogConsole !== 'none') log({ filter: src, path: '', details: config.srcLogConsole });
    if (config.srcLogFile) log({ filter: src, path: config.srcLogFile, details: 'verbose' });

    // validate that the src directory is a directory
    return file.stat(src)

        // validate that the src directory is a directory and get a map of its contents
        .then(function(stat) {
            if (!stat.isDirectory()) {
                throw new Err.dne('Invalid src directory specified for resources: ' + src);
            }
            return file.readdirStats(src, true);
        })

        // populate the resource map
        .then(function(directoryMap) {
            var filePaths = Object.keys(directoryMap);
            var resourceMap = {};
            filePaths.sort();
            filePaths.forEach(function(filePath) {
                var defPath;
                var indexPath;
                var pathParts = path.relative(src, filePath).split(path.sep);
                var resource = pathParts[0];
                var stat = directoryMap[filePath];
                var subResource = pathParts[1];

                if (stat.isDirectory()) {

                    // resource directory
                    if (pathParts.length === 1 && resourceAllowed(resource)) {
                        indexPath = src + path.sep + resource + path.sep + config.srcIndex;
                        defPath = src + path.sep + resource + path.sep + config.def;
                        if (filesExist(directoryMap, [indexPath, defPath])) {
                            try {
                                resourceMap[resource] = {
                                    def: definition(definition.RESOURCE, fs.readFileSync(defPath, 'utf8')),
                                    module: require(indexPath),
                                    subResources: {}
                                };
                            } catch (e) {
                                delete resourceMap[resource];
                                if (!config.srcErrorIgnore) throw e;
                            }
                        }

                    // sub resource directory
                    } else if (pathParts.length === 2 && resourceMap.hasOwnProperty(resource)) {
                        indexPath = src + path.sep + resource + path.sep + subResource + path.sep + config.srcIndex;
                        defPath = src + path.sep + resource + path.sep + subResource + path.sep + config.def;
                        if (filesExist(directoryMap, [indexPath, defPath])) {
                            try {
                                resourceMap[resource].subResources[subResource] = {
                                    def: definition(definition.SUB_RESOURCE, fs.readFileSync(defPath, 'utf8')),
                                    module: require(indexPath)
                                };
                            } catch (e) {
                                delete resourceMap[resource].subResources[subResource];
                                if (!config.srcErrorIgnore) throw e;
                            }
                        }
                    }
                }
            });
            return resourceMap;
        })

        //return the resource factory
        .then(function(resourceMap) {
            var factory = {};

            /**
             * Get a definition object for a resource or a sub resource.
             * @param {string} resourceName
             * @param {string} [subResourceName]
             * @returns {object, undefined}
             */
            factory.definition = function(resourceName, subResourceName) {
                if (!resourceMap.hasOwnProperty(resourceName)) return;
                if (!subResourceName) return JSON.parse(resourceMap[resourceName].def);
                if (resourceMap.subResources.hasOwnProperty(subResourceName)) {
                    return JSON.parse(resourceMap.subResources[subResourceName].def);
                }
            };

            /**
             * Get the module for a resource or sub-resource.
             * @param {string} resourceName
             * @param {string} [subResourceName]
             * @returns {*, undefined}
             */
            factory.get = function(resourceName, subResourceName) {
                if (!resourceMap.hasOwnProperty(resourceName)) return;
                if (!subResourceName) return resourceMap[resourceName].module;
                if (resourceMap[resourceName].subResources.hasOwnProperty(subResourceName)) {
                    return resourceMap[resourceName].subResources[subResourceName].module;
                }
            };

            return factory;
        });
}

Resource.schema = schemata({
    def: {
        help: 'The def must be a string.',
        defaultValue: 'def.json',
        validate: is.string
    },
    src: {
        help: 'The src must be a string.',
        defaultValue: './',
        transform: (value) => path.resolve(process.cwd(), value),
        validate: is.string
    },
    srcErrorIgnore: {
        defaultValue: false,
        transform: (value) => !!value
    },
    srcFilter: {
        help: 'The src filter must be an array of strings.',
        validate: function(value, is) {
            var i;
            if (!Array.isArray(value)) return false;
            for (i = 0; i < value.length; i++) {
                if (!is.string(value[i])) return false;
            }
            return true;
        }
    },
    srcLogConsole: {
        help: 'The src log console value must be one of: ' + logDetails.join(', '),
        validate: (v) => logDetails.indexOf(v) !== -1
    },
    srcLogFile: {
        help: 'The src log file value must be a string.',
        validate: is.string
    },
    srcIndex: {
        help: 'The src must be a string.',
        defaultValue: 'index.js',
        validate: is.string
    }
});

function filesExist(directoryMap, paths) {
    var i;
    var path;
    for (i = 0; i < paths.length; i++) {
        path = paths[i];
        if (!directoryMap.hasOwnProperty(path)) return false;
        if (!directoryMap[path].isFile()) return false;
    }
    return true;
}