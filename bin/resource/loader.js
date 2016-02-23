"use strict";
const CustomError       = require('custom-error-instance');
const definition        = require('./definition');
const file              = require('../util/file');
const fs                = require('fs');
const is                = require('../util/is');
const log               = require('../log/log');
const Logger            = require('../log/index');
const logDetails        = require('../log/index').details();
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

    // set up logging
    Logger.processOption(config.logResource.detail, config.logResource.location, log.BOTH, src);

    // validate that the src directory is a directory
    return file.stat(src)

        // validate that the src directory is a directory and get a map of its contents
        .then(function(stat) {
            if (!stat.isDirectory()) throw Err.dne('Invalid src directory specified for resources: ' + src);
            return file.readdirStats(src, true);
        })

        // populate the resource map
        .then(function(directoryMap) {
            var defPath;
            var filePaths;
            var indexPath;
            var subResourceMap = {};
            var resourceDef;
            var resourceModule;

            // get the file paths and sort them
            filePaths = Object.keys(directoryMap);
            filePaths.sort();

            // get the index path and the definition file path for the resource
            indexPath = src + path.sep + config.srcIndex;
            defPath = src + path.sep + config.def;

            // verify that the index and definition file's exist
            if (filesExist(directoryMap, [indexPath, defPath])) {
                resourceDef = definition(definition.RESOURCE, fs.readFileSync(defPath, 'utf8'));
                resourceModule = require(indexPath);
            }

            // load sub-resource directories
            filePaths.forEach(function(filePath) {
                var defPath;
                var indexPath;
                var pathParts = path.relative(src, filePath).split(path.sep);
                var stat = directoryMap[filePath];
                var subResourceName = pathParts[1];

                if (stat.isDirectory()) {
                    indexPath = src + path.sep + subResourceName + path.sep + config.srcIndex;
                    defPath = src + path.sep + subResourceName + path.sep + config.def;
                    if (filesExist(directoryMap, [indexPath, defPath])) {
                        subResourceMap[subResourceName] = {
                            def: definition(definition.SUB_RESOURCE, fs.readFileSync(defPath, 'utf8')),
                            module: require(indexPath)
                        };
                    }
                }
            });

            return {
                def: resourceDef,
                module: resourceModule,
                subResources: subResourceMap
            };
        })

        //return the resource factory
        .then(function(resourceMap) {
            var factory = {};

            /**
             * Get a definition object for a resource or a sub resource.
             * @param {string} [subResourceName]
             * @returns {object, undefined}
             */
            factory.definition = function(subResourceName) {
                if (!subResourceName) return JSON.parse(resourceMap.def);
                if (resourceMap.subResources.hasOwnProperty(subResourceName)) {
                    return JSON.parse(resourceMap.subResources[subResourceName].def);
                }
            };

            /**
             * Get the module for a resource or sub-resource.
             * @param {string} [subResourceName]
             * @returns {*, undefined}
             */
            factory.get = function(subResourceName) {
                if (!subResourceName) return resourceMap.module;
                if (resourceMap.subResources.hasOwnProperty(subResourceName)) {
                    return resourceMap.subResources[subResourceName].module;
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
    logResource: {
        help: 'The log resource must be an object that specifies the '
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