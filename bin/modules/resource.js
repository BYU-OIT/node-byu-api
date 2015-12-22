"use strict";
// This file does the work of gathering resources.

var clc                 = require('../cli/clc');
var customError         = require('./custom-error');
var file                = require('./file');
var fs                  = require('fs');
var path                = require('path');

var ResourceErr = customError('Resource', {
    notDirectory: 'NODIR'
});

module.exports = resource;

/**
 * Require resource and sub resource files from the directory specified.
 * @param configuration
 * @returns {Promise}
 */
function resource(configuration) {
    var config = clc.options.normalize(resource.options, configuration, true);
    var src = path.resolve(process.cwd(), config.src);

    function resourceAllowed(resourceName) {
        var limit = config['src-limit'];
        if (!limit) return true;
        return limit.indexOf(resourceName) !== -1;
    }

    //validate that the src directory is a directory
    return file.stat(src)

        //validate that the src directory is a directory and get a map of its contents
        .then(function(stat) {
            if (!stat.isDirectory()) {
                throw new ResourceErr.notDirectory('Invalid src directory specified for resources: ' + src);
            }
            return file.readdirStats(src, true);
        })

        //populate the resource map
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

                    //resource directory
                    if (pathParts.length === 1 && resourceAllowed(resource)) {
                        indexPath = resource + path.sep + config['src-index'];
                        defPath = resource + path.sep + config.def;
                        if (filesExist(indexPath, defPath)) {
                            resourceMap[resource] = {
                                def: fs.readFileSync(defPath, 'utf8'),
                                module: require(path.resolve(src, indexPath)),
                                subResources: {}
                            }
                        }

                    //sub resource directory
                    } else if (pathParts.length === 2 && resourceMap.hasOwnProperty(resource)) {
                        indexPath = resource + path.sep + subResource + path.sep + config['src-index'];
                        defPath = resource + path.sep + subResource + path.sep + config.def;
                        if (filesExist(indexPath, defPath)) {
                            resourceMap[resource][subResource] = {
                                def: fs.readFileSync(defPath, 'utf8'),
                                module: require(path.resolve(src, indexPath))
                            };
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
             * @returns {*}
             */
            factory.get = function(resourceName, subResourceName) {
                if (!resourceMap.hasOwnProperty(resourceName)) return;
                if (!subResourceName) return resourceMap[resourceName].module;
                if (resourceMap.subResources.hasOwnProperty(subResourceName)) {
                    return resourceMap.subResources[subResourceName].module;
                }
            };

            return factory;
        });
}

resource.options = {
    def: {
        type: String,
        description: 'The name of each resource definition file.',
        defaultValue: 'def.json',
        group: 'resource'
    },
    src: {
        alias: 's',
        type: String,
        description: 'The directory that has the code to handle the request.',
        defaultValue: './',
        group: 'resource'
    },
    'src-limit': {
        type: String,
        description: 'The resource name to limit loaded resources to.',
        help: 'The greatest benefit of this option is to reduce the initial startup time of the application.',
        group: 'resource'
    },
    'src-index': {
        type: String,
        description: 'The name of the file to call for each resource or sub-resource to bootstrap the functionality ' +
        'for that resource or sub-resource.',
        help: 'The file specified must be executable as JavaScript.',
        defaultValue: 'index.js',
        group: 'resource'
    }
};

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