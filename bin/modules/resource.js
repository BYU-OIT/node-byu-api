var clc                 = require('./clc');
var file                = require('./file');
var path                = require('path');


var resourceMap = {};


/**
 * Load resources from the specified src directory.
 * @param {object} configuration
 */
exports.load = function(configuration) {
    var config = clc.options.normalize(exports.options, configuration, true);

    function resourceAllowed(resourceName) {
        var limit = config['src-limit'];
        if (!limit) return true;
        return limit.indexOf(resourceName) !== -1;
    }

    //validate that the src directory is a directory
    return file.stat(config.src)

        //validate that the src directory is a directory and get a map of its contents
        .then(function(stat) {
            if (!stat.isDirectory()) {
                throw new Error('Invalid src directory specified for resources: ' + config.src);
            }
            return file.readdirStats(config.src, true);
        })

        //populate the resource map
        .then(function(directoryMap) {
            var filePaths = Object.keys(directoryMap);
            filePaths.sort();
            filePaths.forEach(function(filePath) {
                var index;
                var indexPath;
                var pathParts = path.relative(config.src, filePath).split(path.sep);
                var resource = pathParts[0];
                var stat = directoryMap[filePath];
                var subResource = pathParts[1];

                if (stat.isDirectory()) {

                    //resource directory
                    if (pathParts.length === 1 && resourceAllowed(resource)) {
                        indexPath = resource + path.sep + config['src-index'];
                        index = filePaths.indexOf(indexPath);
                        if (index !== -1) {
                            resourceMap[resource] = {
                                index: require(path.resolve(config.src, indexPath)),
                                subResources: {}
                            }
                        }

                    //sub resource directory
                    } else if (pathParts.length === 2 && resourceMap.hasOwnProperty(resource)) {
                        indexPath = resource + path.sep + subResource + path.sep + config['src-index'];
                        index = filePaths.indexOf(indexPath);
                        if (index !== -1) resourceMap[resource][subResource] = require(path.resolve(config.src, indexPath));
                    }
                }
            });
            return resourceMap;
        });
};

exports.options = {
    def: {
        alias: 'f',
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

/**
 * Get the module for a loaded resource.
 * @param {string} resourceName
 * @param {string} [subResourceName]
 * @returns {*}
 */
exports.resource = function(resourceName, subResourceName) {
    if (!resourceMap.hasOwnProperty(resourceName)) return;
    if (!subResourceName) return resourceMap[resourceName].index;
    if (resourceMap.subResources.hasOwnProperty(subResourceName)) return resourceMap.subResources[subResourceName];
};