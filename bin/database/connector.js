"use strict";
// The purpose of this file is to load connectors and store connectors.
var CustomError     = require('custom-error-instance');
var file            = require('../util/file');
var is              = require('../util/is');
var schemata        = require('object-schemata');
var path            = require('path');
var Promise         = require('bluebird');
var vm              = require('vm');

var ConnectorError = CustomError('ConnectorError');
ConnectorError.exists = CustomError(ConnectorError, { code: 'EEXIST' });
ConnectorError.create = CustomError(ConnectorError, { code: 'ECREATE' });
ConnectorError.undefined = CustomError(ConnectorError, { code: 'EUDEF' });
ConnectorError.config = CustomError(ConnectorError, { code: "ECNFG" }, function() {
    this.message = 'The connector has an invalid configuration: ' + this.message;
});
ConnectorError.noimp = CustomError(ConnectorError, { code: 'ENIMP' });

var connectorsLoadPromise;
var defineSchema;
var store = {};


Object.defineProperty(exports, 'error', {
    enumerable: false,
    configurable: true,
    value: ConnectorError,
    writable: false
});

/**
 * Define a connector.
 * @param {object} configuration The connector configuration.
 * @returns {object} The stored configuration.
 */
exports.define = function(configuration) {
    var config = defineSchema.normalize(configuration);
    if (exports.exists(config.name)) throw new ConnectorError.exists('A Connector with this name already exists: ' + config.name);
    config.schema = schemata(config.options);
    store[config.name] = config;
    return store[config.name];
};

/**
 * Determine if a connector is defined.
 * @param {string} name The name of the connector.
 * @returns {boolean}
 */
exports.exists = function(name) {
    return store.hasOwnProperty(name);
};

/**
 * Get a copy of an existing connector object.
 * @param {string} name The name of the connector to get.
 * @returns {object}
 */
exports.get = function(name) {
    if (!store.hasOwnProperty(name)) throw new ConnectorError.undefined('Connector not defined: ' + name);
    return Object.assign({}, store[name]);
};

/**
 * List all of the connectors that have been defined.
 * @returns {string[]}
 */
exports.list = function() {
    return Object.keys(store);
};

/**
 * Require all scripts from the connectors directory.
 * @param {object} config
 * @returns {Promise}
 */
exports.load = function(config) {

    // define a private recursive load function
    function load(fullFilePath) {
        return file.stat(fullFilePath)
            .then(function(stats) {
                if (stats.isFile() && /\.js$/.test(fullFilePath)) {
                    const configuration = require(fullFilePath);
                    exports.define(configuration);
                } else if (stats.isDirectory()) {
                    return file.readdir(fullFilePath)
                        .then(function(filePaths) {
                            const promises = [];
                            filePaths.forEach(function (filePath) {
                                const fullFilePath = path.resolve(fullFilePath, filePath);
                                promises.push(load(fullFilePath));
                            });
                            return Promise.all(promises);
                        })
                }
            });
    }

    if (!connectorsLoadPromise) {
        const promises = [];

        // add the connectors directory to the list of connector paths
        if (!config.connector) config.connector = [];
        config.connector.unshift(path.resolve(__dirname, '../connectors'));

        // start adding connectors
        config.connector.forEach(function (filePath) {
            const fullFilePath = path.resolve(process.cwd(), filePath);
            promises.push(load(fullFilePath));
        });

        connectorsLoadPromise = Promise.all(promises);
    }

    return connectorsLoadPromise;
};

/**
 * Delete an existing connector.
 * @param {string} name
 */
exports.remove = function(name) {
    if (!store.hasOwnProperty(name)) throw new ConnectorError.undefined('Connector not defined: ' + name);
    delete store[name];
};


defineSchema = schemata({
    connect: {
        description: 'The function to call to get a database connection.',
        required: true,
        validate: is.function,
        help: 'The connect must be a function.'
    },
    name: {
        description: 'The unique name for the connector.',
        required: true,
        validate: is.nonEmptyString,
        help: 'The name must be a non-empty string.'
    },
    options: {
        description: 'The default configuration options.',
        defaultValue: {},
        validate: is.object,
        help: 'The options must be an object.'
    },
    pool: {
        description: 'Whether to use the connection pool or not.',
        defaultValue: false
    }
});

/**
 * Require all JavaScript files in the directory specified.
 * @param dirPath
 * @returns {Promise}
 */
function requireDirectory(dirPath) {
    return file.readdirStats(dirPath)
        .then(function(statMap) {
            var promises = [];
            Object.keys(statMap).forEach(function(filePath) {
                var stat = statMap[filePath];
                if (stat.isFile() && /\.js$/.test(filePath)) {
                    require(filePath);
                } else if (stat.isDirectory()) {
                    promises.push(requireDirectory(filePath, depth - 1));
                }
            });
            return Promise.all(promises);
        });
}